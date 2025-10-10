// --------------------------------------
// 1. Import necessary modules
// --------------------------------------
import express from "express";
import bodyParser from "body-parser";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { BraveSearch } from "@langchain/community/tools/brave_search";
import OpenAI from "openai";
import cheerio from "cheerio";
import dotenv from "dotenv";

dotenv.config();

// --------------------------------------
// 2. Initialize Express
// --------------------------------------
const app = express();
const port = 3005;
app.use(bodyParser.json());

// --------------------------------------
// 3. Initialize OpenAI + Embeddings
// --------------------------------------
const openai = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

const embeddings = new OpenAIEmbeddings();

// --------------------------------------
// 4. Helper: Rephrase user input
// --------------------------------------
async function rephraseInput(input) {
  try {
    const response = await openai.chat.completions.create({
      model: "mixtral-8x7b-32768",
      messages: [
        {
          role: "system",
          content:
            "You are a rephraser. Always reply with a concise version of the input, optimized for a search engine query.",
        },
        { role: "user", content: input },
      ],
    });
    return response.choices[0].message.content;
  } catch (err) {
    console.error("Error rephrasing input:", err);
    return input;
  }
}

// --------------------------------------
// 5. Helper: Extract main text from a web page
// --------------------------------------
function extractMainContent(html, link) {
  const $ = cheerio.load(html);
  $("script, style, head, nav, footer, iframe, img").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

// --------------------------------------
// 6. Helper: Generate Follow-Up Questions
// --------------------------------------
async function generateFollowUpQuestions(answer) {
  try {
    const groqResponse = await openai.chat.completions.create({
      model: "mixtral-8x7b-32768",
      messages: [
        {
          role: "system",
          content:
            "Generate 3 relevant follow-up questions based on the provided text. Return them as a JSON array.",
        },
        {
          role: "user",
          content: `Generate 3 follow-up questions for: ${answer}`,
        },
      ],
    });

    return JSON.parse(groqResponse.choices[0].message.content);
  } catch (err) {
    console.error("Error generating follow-up questions:", err);
    return ["Can you explain more?", "Why is that important?", "Tell me more about this topic."];
  }
}

// --------------------------------------
// 7. Helper: Custom Domain Knowledge
// --------------------------------------
function getCustomKnowledge(message) {
  const text = message.toLowerCase();

  const facts = {
    "pm of india": "🇮🇳 The current Prime Minister of India is **Narendra Modi**, serving since May 2014.",
    dog: "🐶 Dogs are loyal domestic animals known as human’s best friends.",
    cat: "🐱 Cats are independent and curious animals, loved for their agility and affection.",
    tiger: "🐯 Tigers are the largest wild cats and apex predators found mostly in Asia.",
    space: "🚀 Space is a vast expanse beyond Earth’s atmosphere, filled with stars, galaxies, and planets.",
    ocean: "🌊 Oceans cover over 70% of Earth’s surface and are home to millions of species.",
  };

  for (const key in facts) {
    if (text.includes(key)) return facts[key];
  }

  return null;
}

// --------------------------------------
// 8. Main POST Route
// --------------------------------------
app.post("/", async (req, res) => {
  const startTime = Date.now();
  const {
    message,
    textChunkSize = 800,
    textChunkOverlap = 200,
    numberOfSimilarityResults = 2,
    numberOfPagesToScan = 4,
  } = req.body;

  console.log("\n📩 New query:", message);

  try {
    // Check for quick domain knowledge
    const predefined = getCustomKnowledge(message);
    if (predefined) {
      return res.json({
        answer: predefined,
        sources: [],
        followUpQuestions: await generateFollowUpQuestions(predefined),
      });
    }

    // Rephrase query
    const rephrasedMessage = await rephraseInput(message);
    console.log("🔁 Rephrased:", rephrasedMessage);

    // Initialize Brave Search
    const loader = new BraveSearch({ apiKey: process.env.BRAVE_SEARCH_API_KEY });
    const docs = await loader.call(rephrasedMessage, { count: numberOfPagesToScan });
    const normalized = JSON.parse(docs)
      .filter((d) => d.title && d.link)
      .slice(0, numberOfPagesToScan);

    console.log(`🔍 Found ${normalized.length} relevant web pages.`);

    // Fetch, chunk, and vectorize
    const sources = await Promise.all(
      normalized.map(async ({ title, link }) => {
        try {
          const response = await fetch(link);
          const html = await response.text();
          const content = extractMainContent(html, link);
          const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: textChunkSize,
            chunkOverlap: textChunkOverlap,
          });
          const chunks = await splitter.splitText(content);
          const store = await MemoryVectorStore.fromTexts(chunks, { link, title }, embeddings);
          return await store.similaritySearch(message, numberOfSimilarityResults);
        } catch (err) {
          console.error("Error processing link:", link, err);
          return [];
        }
      })
    );

    // Prepare LLM summary
    const chat = await openai.chat.completions.create({
      model: "mixtral-8x7b-32768",
      messages: [
        {
          role: "system",
          content: `You are an intelligent assistant. Respond with an informative and structured summary for the query: "${message}" using context below.`,
        },
        { role: "user", content: `Sources: ${JSON.stringify(sources)}` },
      ],
    });

    const finalAnswer = chat.choices[0].message.content;

    // Return response
    res.json({
      answer: finalAnswer,
      sources,
      followUpQuestions: await generateFollowUpQuestions(finalAnswer),
      responseTime: `${(Date.now() - startTime) / 1000}s`,
    });

    console.log("✅ Response sent in", (Date.now() - startTime) / 1000, "seconds");
  } catch (error) {
    console.error("❌ Error in processing:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// --------------------------------------
// 9. Start Server
// --------------------------------------
app.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});
