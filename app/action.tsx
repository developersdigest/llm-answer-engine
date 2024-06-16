// 1. Import dependencies
import 'server-only';
import { createAI, createStreamableValue } from 'ai/rsc';
import { OpenAI } from 'openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { config } from './config';
import { functionCalling } from './function-calling';
// OPTIONAL: Use Upstash rate limiting to limit the number of requests per user
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from 'next/headers'
import { braveSearch, googleSearch, serperSearch, getImages, getVideos } from './tools/searchProviders';
import { get10BlueLinksContents, processAndVectorizeContent } from './tools/contentProcessing';
// Mention Tools
import { mentionFunctions } from './tools/mentionTools';
import { mentionToolConfig } from './tools/mentionToolConfig';
let ratelimit: Ratelimit | undefined;
if (config.useRateLimiting) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "10 m") // 10 requests per 10 minutes
  });
}
// Optional: Use Upstash semantic cache to store and retrieve data for faster response times
import { SemanticCache } from "@upstash/semantic-cache";
import { Index } from "@upstash/vector";
let semanticCache: SemanticCache | undefined;
if (config.useSemanticCache) {
  const index = new Index();
  semanticCache = new SemanticCache({ index, minProximity: 0.95 });
}
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
  favicon: string;
}
interface ContentResult extends SearchResult {
  html: string;
}
// 9. Generate follow-up questions using OpenAI API
const relevantQuestions = async (sources: SearchResult[], userMessage: String): Promise<any> => {
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
        content: `Generate follow-up questions based on the top results from a similarity search: ${JSON.stringify(sources)}. The original search query is: "${userMessage}".`,
      },
    ],
    model: config.inferenceModel,
    response_format: { type: "json_object" },
  });
};
async function lookupTool(mentionTool: string, userMessage: string, streamable: any) {
  const toolInfo = mentionToolConfig.mentionTools.find(tool => tool.id === mentionTool);
  if (toolInfo) {
    return await mentionFunctions[toolInfo.functionName](mentionTool, userMessage, streamable);
  }
}
// 10. Main action function that orchestrates the entire process
async function myAction(userMessage: string, mentionTool: string | null, logo: string | null, file: string): Promise<any> {
  "use server";
  const streamable = createStreamableValue({});
  (async () => {
    if (config.useRateLimiting && ratelimit) {
      const identifier = headers().get('x-forwarded-for') || headers().get('x-real-ip') || headers().get('cf-connecting-ip') || headers().get('client-ip') || "";
      const { success } = await ratelimit.limit(identifier)
      if (!success) {
        return streamable.done({ 'status': 'rateLimitReached' });
      }
    }
    if (mentionTool) {
      // add decoded file to userMessage 
      //  convert file base64 to string
      if (file) {
        // remove the base64 prefix
        const decodedFile = await Buffer.from(file, 'base64').toString('utf-8').replace(/^data:image\/\w+;base64,/, '');
        await lookupTool(mentionTool, userMessage + "File Content: " + decodedFile, streamable);
      } else {
        await lookupTool(mentionTool, userMessage, streamable);
        return
      }
    }
    if (config.useSemanticCache && semanticCache && !mentionTool) {
      const cachedData = await semanticCache.get(userMessage);
      if (cachedData) {
        streamable.update({ 'cachedData': cachedData });
        return;
      }
    }
    const [images, sources, videos, condtionalFunctionCallUI] = await Promise.all([
      getImages(userMessage),
      config.searchProvider === "brave" ? braveSearch(userMessage) :
        config.searchProvider === "serper" ? serperSearch(userMessage) :
          config.searchProvider === "google" ? googleSearch(userMessage) :
            Promise.reject(new Error(`Unsupported search provider: ${config.searchProvider}`)),
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
    let accumulatedLLMResponse = ""
    for await (const chunk of chatCompletion) {
      if (chunk.choices[0].delta && chunk.choices[0].finish_reason !== "stop" && chunk.choices[0].delta.content !== null) {
        streamable.update({ 'llmResponse': chunk.choices[0].delta.content });
        accumulatedLLMResponse += chunk.choices[0].delta.content;
      } else if (chunk.choices[0].finish_reason === "stop") {
        streamable.update({ 'llmResponseEnd': true });
      }
    }
    let followUp;
    if (!config.useOllamaInference) {
      followUp = await relevantQuestions(sources, userMessage);
      streamable.update({ 'followUp': followUp });
    }
    const dataToCache = {
      searchResults: sources,
      images,
      videos,
      conditionalFunctionCallUI: config.useFunctionCalling ? condtionalFunctionCallUI : undefined,
      llmResponse: accumulatedLLMResponse,
      followUp,
      condtionalFunctionCallUI,
      semanticCacheKey: userMessage
    };
    if (config.useSemanticCache && semanticCache && dataToCache.llmResponse.length > 0) {
      await semanticCache.set(userMessage, JSON.stringify(dataToCache));
    }
    streamable.done({ status: 'done' });
  })();
  return streamable.value;
}
async function clearSemanticCache(userMessage: string): Promise<any> {
  "use server";
  console.log('Clearing semantic cache for user message:', userMessage);
  if (!config.useSemanticCache || !semanticCache) return;
  await semanticCache.delete(userMessage);
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
    myAction,
    clearSemanticCache
  },
  initialUIState,
  initialAIState,
});
