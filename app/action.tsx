"use server";

import { createAI, createStreamableValue } from 'ai/rsc';
import { config } from './config';
import { functionCalling } from './function-calling';
import { getSearchResults, getImages, getVideos } from './tools/searchProviders';
import { get10BlueLinksContents, processAndVectorizeContent } from './tools/contentProcessing';
import { setInSemanticCache, clearSemanticCache, initializeSemanticCache, getFromSemanticCache } from './tools/semanticCache';
import { relevantQuestions } from './tools/generateRelevantQuestions';
import { streamingChatCompletion } from './tools/streamingChatCompletion';
import { checkRateLimit } from './tools/rateLimiting';
import { lookupTool } from './tools/mentionTools';

async function myAction(userMessage: string, mentionTool: string | null, logo: string | null, file: string): Promise<any> {
  "use server";
  const streamable = createStreamableValue({});

  (async () => {
    if (!(await checkRateLimit(streamable))) {
      return;
    }

    await initializeSemanticCache();

    const cachedData = await getFromSemanticCache(userMessage);
    if (cachedData) {
      streamable.update({ cachedData });
      return;
    }

    if (mentionTool) {
      // If a mention tool is used, we don't want to proceed with the rest of the flow.
      return await lookupTool(mentionTool, userMessage, streamable, file);
    }

    // Call external providers in parallel but handle failures individually.
    // A non-OK response from any provider should not crash the whole flow.
    const promises: Promise<any>[] = [
      getImages(userMessage),
      getSearchResults(userMessage),
      getVideos(userMessage),
    ];
    if (config.useFunctionCalling) {
      promises.push(functionCalling(userMessage));
    }
    const settledResults = await Promise.allSettled(promises);
    const [imagesResult, searchResultsResult, videosResult] = settledResults;

    let images: any[] = [];
    let sources: any[] = [];
    let videos: any[] = [];
    let conditionalFunctionCallUI: any = null;

    // Helper to normalize reason into string
    const reasonToString = (reason: any) => {
      if (typeof reason === 'string') return reason;
      if (reason instanceof Error) return reason.message;
      try {
        return JSON.stringify(reason);
      } catch (e) {
        return 'An unknown error occurred';
      }
    };

    // images
    if (imagesResult.status === 'fulfilled') {
      images = imagesResult.value || [];
    } else {
      const details = reasonToString(imagesResult.reason);
      console.error('getImages failed:', details);
      streamable.update({ status: `An error occurred while fetching images: ${details}` });
    }

    // search results
    if (searchResultsResult.status === 'fulfilled') {
      sources = searchResultsResult.value || [];
    } else {
      const details = reasonToString(searchResultsResult.reason);
      console.error('getSearchResults failed:', details);
      streamable.update({ status: `An error occurred while fetching search results: ${details}` });
    }

    // videos
    if (videosResult.status === 'fulfilled') {
      videos = videosResult.value || [];
    } else {
      const details = reasonToString(videosResult.reason);
      console.error('getVideos failed:', details);
      streamable.update({ status: `An error occurred while fetching videos: ${details}` });
    }

    // function calling (UI helper)
    if (config.useFunctionCalling) {
      const functionCallingResult = settledResults[3];
      if (functionCallingResult && functionCallingResult.status === 'fulfilled') {
        conditionalFunctionCallUI = functionCallingResult.value;
      } else if (functionCallingResult) {
        const details = reasonToString(functionCallingResult.reason);
        console.error('functionCalling failed:', details);
        streamable.update({ status: `An error occurred during function calling: ${details}` });
      }
    }

    streamable.update({ 
      searchResults: sources,
      images,
      videos,
      conditionalFunctionCallUI: conditionalFunctionCallUI, 
    });

    const html = await get10BlueLinksContents(sources);
    const vectorResults = await processAndVectorizeContent(html, userMessage);
    const accumulatedLLMResponse = await streamingChatCompletion(userMessage, vectorResults, streamable);
    const followUpResponse = await relevantQuestions(sources, userMessage);

    let followUp = null;
    if (followUpResponse && !followUpResponse.error && followUpResponse.choices?.[0]?.message?.content) {
      try {
        // The response is a JSON string, so we need to parse it.
        const parsedFollowUp = JSON.parse(followUpResponse.choices[0].message.content);
        followUp = { choices: [{ message: { content: parsedFollowUp } }] };
        streamable.update({ followUp });
      } catch (e) {
        console.error("Failed to parse follow-up questions:", e);
      }
    } else if (followUpResponse.error) {
      streamable.update({ status: `An error occurred while generating follow-up questions: ${followUpResponse.error}` });
    }

    if (accumulatedLLMResponse.trim().length > 0) {
      setInSemanticCache(userMessage, {
        searchResults: sources,
        images,
        videos,
        conditionalFunctionCallUI: conditionalFunctionCallUI, 
        llmResponse: accumulatedLLMResponse,
        followUp,
        semanticCacheKey: userMessage
      });
    }

    streamable.done({ status: 'done' });
  })();

  return streamable.value;
}

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

export const AI = createAI({
  actions: {
    myAction,
    clearSemanticCache
  },
  initialUIState,
  initialAIState,
});