import express from 'express';
import bodyParser from 'body-parser';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { BraveSearch } from '@langchain/community/tools/brave_search';
import OpenAI from 'openai';
import cheerio from 'cheerio';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = 3005;

app.use(bodyParser.json());

const openai = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});
const embeddings = new OpenAIEmbeddings();

app.post('/', async (req, res) => {
  try {
    console.log('1. Received POST request');
    const {
      message,
      returnSources = true,
      returnFollowUpQuestions = true,
      embedSourcesInLLMResponse = false,
      textChunkSize = 800,
      textChunkOverlap = 200,
      numberOfSimilarityResults = 2,
      numberOfPagesToScan = 4,
    } = req.body;

    console.log('2. Destructured request data');

    // Rephrase function
    async function rephraseInput(inputString) {
      console.log('4. Rephrasing input');
      const groqResponse = await openai.chat.completions.create({
        model: 'mixtral-8x7b-32768',
        messages: [
          {
            role: 'system',
            content:
              'You are a rephraser and always respond with a rephrased version of the input that is given to a search engine API. Always be succinct and use the same words. ONLY RETURN THE REPHRASED VERSION.',
          },
          { role: 'user', content: inputString },
        ],
      });
      console.log('5. Rephrased input and got answer from Groq');
      const reply = groqResponse.choices[0].message.content;
      return reply;
    }

    // Search & fetch
    async function searchEngineForSources(text) {
      console.log('3. Initializing search engine process');
      const loader = new BraveSearch({ apiKey: process.env.BRAVE_SEARCH_API_KEY });

      const rephrased = await rephraseInput(text);
      console.log('6. Rephrased message for search');

      const docs = await loader.call(rephrased, { count: numberOfPagesToScan });
      console.log('7. Retrieved search documents:', docs);

      const normalized = normalizeData(docs);
      console.log('8. Normalized docs:', normalized);

      // Fetch & vectorize
      const processed = await Promise.all(normalized.map(fetchAndProcess));
      // Filter out nulls
      return processed.filter((item) => item != null);
    }

    function normalizeData(docs) {
      // If docs is already an array
      let arr = docs;
      if (typeof docs === 'string') {
        try {
          arr = JSON.parse(docs);
        } catch (e) {
          console.error('normalizeData: JSON parse failed', e);
          arr = [];
        }
      }
      return arr
        .filter((doc) => doc.title && doc.link && !doc.link.includes('brave.com'))
        .slice(0, numberOfPagesToScan)
        .map(({ title, link }) => ({ title, link }));
    }

    async function fetchPageContent(link) {
      console.log('7. Fetching page content for', link);
      try {
        const resp = await fetch(link);
        if (!resp.ok) {
          console.warn('Failed fetch:', link, resp.status);
          return '';
        }
        const html = await resp.text();
        return extractMainContent(html);
      } catch (err) {
        console.error('Error fetching:', link, err);
        return '';
      }
    }

    function extractMainContent(html) {
      if (!html) return '';
      const $ = cheerio.load(html);
      $('script, style, head, nav, footer, iframe, img').remove();
      return $('body')
        .text()
        .replace(/\s+/g, ' ')
        .trim();
    }

    let vectorCount = 0;
    async function fetchAndProcess(item) {
      if (!item || !item.link) return null;
      const content = await fetchPageContent(item.link);
      if (!content || content.length < 250) {
        return null;
      }
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: textChunkSize,
        chunkOverlap: textChunkOverlap,
      });
      const splitText = await splitter.splitText(content);
      const vectorStore = await MemoryVectorStore.fromTexts(
        splitText,
        { link: item.link, title: item.title },
        embeddings
      );
      vectorCount++;
      console.log(`9. Processed ${vectorCount} source: ${item.link}`);
      return vectorStore.similaritySearch(message, numberOfSimilarityResults);
    }

    const sources = await searchEngineForSources(message);
    // sources is array of arrays of docs
    const sourcesParsed = sources.map((group) =>
      group
        .map((doc) => {
          const title = doc.metadata.title;
          const link = doc.metadata.link;
          return { title, link };
        })
        .filter((doc, idx, arr) => arr.findIndex((d) => d.link === doc.link) === idx)
    );

    console.log('10. RAG complete sources:', sourcesParsed);

    // Build messages for LLM
    const systemPrompt = `
      - Query: "${message}". Provide a detailed answer using the sources if available.
      ${embedSourcesInLLMResponse
        ? 'Include source annotations in your response.'
        : ''}
      If no relevant results, answer: "No relevant results found."
    `.trim();

    const userPrompt = `Here are top similarity results: ${JSON.stringify(sourcesParsed)}`;

    const chatCompletion = await openai.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
    });

    console.log('11. Sent content to Groq for chat completion.');
    let fullAnswer = '';
    console.log('12. Streaming response:');

    for await (const chunk of chatCompletion) {
      const delta = chunk.choices[0].delta;
      if (delta && chunk.choices[0].finish_reason !== 'stop') {
        const content = delta.content || '';
        process.stdout.write(content);
        fullAnswer += content;
      } else {
        // End of stream
        const responseObj = {
          answer: fullAnswer,
        };
        if (returnSources) responseObj.sources = sourcesParsed;
        if (returnFollowUpQuestions) {
          responseObj.followUpQuestions = await generateFollowUpQuestions(fullAnswer);
        }
        console.log(
          '\n\n13. Generated follow-up questions:',
          responseObj.followUpQuestions
        );
        res.status(200).json(responseObj);
      }
    }
  } catch (err) {
    console.error('Error in / handler:', err);
    res.status(500).json({ error: 'Internal server error', details: err.toString() });
  }
});

async function generateFollowUpQuestions(responseText) {
  try {
    const groqResponse = await openai.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [
        {
          role: 'system',
          content:
            'You are a question generator. Generate 3 follow-up questions based on the provided text. Return as JSON array.',
        },
        {
          role: 'user',
          content: `Generate 3 follow-up questions based on this:\n\n${responseText}\nReturn as JSON like ["Q1", "Q2", "Q3"]`,
        },
      ],
    });
    const content = groqResponse.choices[0].message.content;
    return JSON.parse(content);
  } catch (e) {
    console.error('Error generating follow-ups:', e);
    return [];
  }
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
