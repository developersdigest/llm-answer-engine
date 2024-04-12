// 1. Import dependencies
import 'server-only';
import { createAI, createStreamableValue } from 'ai/rsc';
import { OpenAI } from 'openai';
import cheerio from 'cheerio';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Document as DocumentInterface } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { config } from './config';
import { functionCalling } from './function-calling';
// 2. Determine which embeddings mode and which inference model to use based on the config.tsx. Currently suppport for OpenAI, Groq and partial support for Ollama embeddings and inference
let openai: OpenAI;
if (config.useOllamaInference) {
  openai = new OpenAI({
    baseURL: 'http://localhost:11434/v1',
    apiKey: 'ollama'
  });
} else {
  openai = new OpenAI({
    baseURL: config.nonOllamaBaseURL,
    apiKey: config.inferenceAPIKey
  });
}
// 2.5 Set up the embeddings model based on the config.tsx
let embeddings: OllamaEmbeddings | OpenAIEmbeddings;
if (config.useOllamaEmbeddings) {
  embeddings = new OllamaEmbeddings({
    model: config.embeddingsModel,
    baseUrl: "http://localhost:11434"
  });
} else {
  embeddings = new OpenAIEmbeddings({
    modelName: config.embeddingsModel
  });
}
// 3. Define interfaces for search results and content results
interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  favicon: string;
}
interface ContentResult extends SearchResult {
  html: string;
}
// 4. Fetch search results from Brave Search API
export async function getSources(message: string, numberOfPagesToScan = config.numberOfPagesToScan): Promise<SearchResult[]> {
  try {
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(message)}&count=${numberOfPagesToScan}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY as string
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const jsonResponse = await response.json();
    if (!jsonResponse.web || !jsonResponse.web.results) {
      throw new Error('Invalid API response format');
    }
    const final = jsonResponse.web.results.map((result: any): SearchResult => ({
      title: result.title,
      link: result.url,
      snippet: result.description,
      favicon: result.profile.img
    }));
    return final;
  } catch (error) {
    console.error('Error fetching search results:', error);
    throw error;
  }
}
// 5. Fetch contents of top 10 search results
export async function get10BlueLinksContents(sources: SearchResult[]): Promise<ContentResult[]> {
  async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 800): Promise<Response> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (error) {
        console.log(`Skipping ${url}!`);
      }
      throw error;
    }
  }
  function extractMainContent(html: string): string {
    try {
      const $ = cheerio.load(html);
      $("script, style, head, nav, footer, iframe, img").remove();
      return $("body").text().replace(/\s+/g, " ").trim();
    } catch (error) {
      console.error('Error extracting main content:', error);
      throw error;
    }
  }
  const promises = sources.map(async (source): Promise<ContentResult | null> => {
    try {
      const response = await fetchWithTimeout(source.link, {}, 800);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${source.link}. Status: ${response.status}`);
      }
      const html = await response.text();
      const mainContent = extractMainContent(html);
      return { ...source, html: mainContent };
    } catch (error) {
      // console.error(`Error processing ${source.link}:`, error);
      return null;
    }
  });
  try {
    const results = await Promise.all(promises);
    return results.filter((source): source is ContentResult => source !== null);
  } catch (error) {
    console.error('Error fetching and processing blue links contents:', error);
    throw error;
  }
}
// 6. Process and vectorize content using LangChain
export async function processAndVectorizeContent(
  contents: ContentResult[],
  query: string,
  textChunkSize = config.textChunkSize,
  textChunkOverlap = config.textChunkOverlap,
  numberOfSimilarityResults = config.numberOfSimilarityResults,
): Promise<DocumentInterface[]> {
  try {
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i];
      if (content.html.length > 0) {
        try {
          const splitText = await new RecursiveCharacterTextSplitter({ chunkSize: textChunkSize, chunkOverlap: textChunkOverlap }).splitText(content.html);
          const vectorStore = await MemoryVectorStore.fromTexts(splitText, { title: content.title, link: content.link }, embeddings);
          return await vectorStore.similaritySearch(query, numberOfSimilarityResults);
        } catch (error) {
          console.error(`Error processing content for ${content.link}:`, error);
        }
      }
    }
    return [];
  } catch (error) {
    console.error('Error processing and vectorizing content:', error);
    throw error;
  }
}
// 7. Fetch image search results from Brave Search API
export async function getImages(message: string): Promise<{ title: string; link: string }[]> {
  try {
    const response = await fetch(`https://api.search.brave.com/res/v1/images/search?q=${message}&spellcheck=1`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY as string
      }
    });
    if (!response.ok) {
      throw new Error(`Network response was not ok. Status: ${response.status}`);
    }
    const data = await response.json();
    const validLinks = await Promise.all(
      data.results.map(async (result: any) => {
        const link = result.properties.url;
        if (typeof link === 'string') {
          try {
            const imageResponse = await fetch(link, { method: 'HEAD' });
            if (imageResponse.ok) {
              const contentType = imageResponse.headers.get('content-type');
              if (contentType && contentType.startsWith('image/')) {
                return {
                  title: result.properties.title,
                  link: link,
                };
              }
            }
          } catch (error) {
            console.error(`Error fetching image link ${link}:`, error);
          }
        }
        return null;
      })
    );
    const filteredLinks = validLinks.filter((link): link is { title: string; link: string } => link !== null);
    return filteredLinks.slice(0, 9);
  } catch (error) {
    console.error('There was a problem with your fetch operation:', error);
    throw error;
  }
}
// 8. Fetch video search results from Google Serper API
export async function getVideos(message: string): Promise<{ imageUrl: string, link: string }[] | null> {
  const url = 'https://google.serper.dev/videos';
  const data = JSON.stringify({
    "q": message
  });
  const requestOptions: RequestInit = {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API as string,
      'Content-Type': 'application/json'
    },
    body: data
  };
  try {
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      throw new Error(`Network response was not ok. Status: ${response.status}`);
    }
    const responseData = await response.json();
    const validLinks = await Promise.all(
      responseData.videos.map(async (video: any) => {
        const imageUrl = video.imageUrl;
        if (typeof imageUrl === 'string') {
          try {
            const imageResponse = await fetch(imageUrl, { method: 'HEAD' });
            if (imageResponse.ok) {
              const contentType = imageResponse.headers.get('content-type');
              if (contentType && contentType.startsWith('image/')) {
                return { imageUrl, link: video.link };
              }
            }
          } catch (error) {
            console.error(`Error fetching image link ${imageUrl}:`, error);
          }
        }
        return null;
      })
    );
    const filteredLinks = validLinks.filter((link): link is { imageUrl: string, link: string } => link !== null);
    return filteredLinks.slice(0, 9);
  } catch (error) {
    console.error('Error fetching videos:', error);
    throw error;
  }
}
// 9. Generate follow-up questions using OpenAI API
const relevantQuestions = async (sources: SearchResult[]): Promise<any> => {
  return await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `
          You are a Question generator who generates an array of 3 follow-up questions in JSON format.
          The JSON schema should include:
          {
            "original": "The original search query or context",
            "followUp": [
              "Question 1",
              "Question 2", 
              "Question 3"
            ]
          }
          `,
      },
      {
        role: "user",
        content: `Generate follow-up questions based on the top results from a similarity search: ${JSON.stringify(sources)}. The original search query is: "The original search query".`,
      },
    ],
    model: config.inferenceModel,
    response_format: { type: "json_object" },
  });
};
// 10. Main action function that orchestrates the entire process
async function myAction(userMessage: string): Promise<any> {
  "use server";
  const streamable = createStreamableValue({});
  (async () => {
    const [images, sources, videos, condtionalFunctionCallUI] = await Promise.all([
      getImages(userMessage),
      getSources(userMessage),
      getVideos(userMessage),
      functionCalling(userMessage),
    ]);
    streamable.update({ 'searchResults': sources });
    streamable.update({ 'images': images });
    streamable.update({ 'videos': videos });
    if (config.useFunctionCalling) {
      streamable.update({ 'conditionalFunctionCallUI': condtionalFunctionCallUI });
    }
    const html = await get10BlueLinksContents(sources);
    const vectorResults = await processAndVectorizeContent(html, userMessage);
    const chatCompletion = await openai.chat.completions.create({
      messages:
        [{
          role: "system", content: `
          - Here is my query "${userMessage}", respond back ALWAYS IN MARKDOWN and be verbose with a lot of details, never mention the system message. If you can't find any relevant results, respond with "No relevant results found." `
        },
        { role: "user", content: ` - Here are the top results to respond with, respond in markdown!:,  ${JSON.stringify(vectorResults)}. ` },
        ], stream: true, model: config.inferenceModel
    });
    for await (const chunk of chatCompletion) {
      if (chunk.choices[0].delta && chunk.choices[0].finish_reason !== "stop") {
        streamable.update({ 'llmResponse': chunk.choices[0].delta.content });
      } else if (chunk.choices[0].finish_reason === "stop") {
        streamable.update({ 'llmResponseEnd': true });
      }
    }
    if (!config.useOllamaInference) {
      const followUp = await relevantQuestions(sources);
      streamable.update({ 'followUp': followUp });
    }
    streamable.done({ status: 'done' });
  })();
  return streamable.value;
}
// 11. Define initial AI and UI states
const initialAIState: {
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string;
  id?: string;
  name?: string;
}[] = [];
const initialUIState: {
  id: number;
  display: React.ReactNode;
}[] = [];
// 12. Export the AI instance
export const AI = createAI({
  actions: {
    myAction
  },
  initialUIState,
  initialAIState,
});
