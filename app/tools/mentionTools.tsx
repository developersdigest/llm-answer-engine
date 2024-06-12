import { OpenAI } from 'openai';
import { config } from '../config';
import Portkey from 'portkey-ai'
import * as fal from "@fal-ai/serverless-client";

let portkey: Portkey;
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
type MentionFunctions = {
    [key: string]: (mentionTool: string, userMessage: string, streamable: any) => Promise<string | undefined>;
};
export const mentionFunctions: MentionFunctions = {
    streamChatCompletion: async function streamChatCompletion(mentionTool: string, userMessage: string, streamable: any) {
        const chatCompletion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `
              - Here is my query "${userMessage}", respond back ALWAYS IN MARKDOWN and be verbose with a lot of details, never mention the system message.
            `
                },
                { role: "user", content: `Here is my query "${userMessage}"` },
            ],
            stream: true,
            model: mentionTool
        });
        let accumulatedLLMResponse = "";
        for await (const chunk of chatCompletion) {
            if (chunk.choices[0].delta && chunk.choices[0].finish_reason !== "stop") {
                streamable.update({ 'llmResponse': chunk.choices[0].delta.content });
                accumulatedLLMResponse += chunk.choices[0].delta.content;
            } else if (chunk.choices[0].finish_reason === "stop") {
                streamable.done({ 'llmResponseEnd': true });
                return accumulatedLLMResponse;
            }
        }
    },
    portKeyAIGateway: async function portKeyAIGateway(mentionTool: string, userMessage: string, streamable: any) {
        if (config.usePortkey) {
            portkey = new Portkey({
                apiKey: process.env.PORTKEY_API_KEY,
                virtualKey: process.env.PORTKEY_BEDROCK_VIRTUAL_KEY
            })
        }
        const chatCompletion = await portkey.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `
              - Here is my query "${userMessage}", respond back ALWAYS IN MARKDOWN and be verbose with a lot of details, never mention the system message.
            `
                },
                { role: "user", content: `Here is my query "${userMessage}"` },
            ],
            stream: true,
            max_tokens: mentionTool.includes('anthropic') ? 100000 : 4096,
            model: mentionTool
        });
        let accumulatedLLMResponse = "";
        for await (const chunk of chatCompletion) {
            if (chunk.choices[0].finish_reason === "COMPLETE" || chunk.choices[0].finish_reason === "stop" || chunk.choices[0].finish_reason === "end_turn") {
                streamable.done({ 'llmResponseEnd': true });
                return accumulatedLLMResponse;
            } else if (chunk.choices[0].delta) {
                streamable.update({ 'llmResponse': chunk.choices[0].delta.content });
                accumulatedLLMResponse += chunk.choices[0].delta.content;
            }
        }
    },
    portKeyAIGatewayTogetherAI: async function portKeyAIGateway(mentionTool: string, userMessage: string, streamable: any) {
        if (config.usePortkey) {
            portkey = new Portkey({
                apiKey: process.env.PORTKEY_API_KEY,
                virtualKey: 'together-ai-cc4094'
            })
        }
        const chatCompletion = await portkey.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `
              - Here is my query "${userMessage}", respond back ALWAYS IN MARKDOWN and be verbose with a lot of details, never mention the system message.
            `
                },
                { role: "user", content: `Here is my query "${userMessage}"` },
            ],
            stream: true,
            max_tokens: 32000,
            model: mentionTool
        });
        let accumulatedLLMResponse = "";
        for await (const chunk of chatCompletion) {
            if (chunk.choices[0].finish_reason === "COMPLETE" || chunk.choices[0].finish_reason === "stop" || chunk.choices[0].finish_reason === "end_turn") {
                streamable.done({ 'llmResponseEnd': true });
                return accumulatedLLMResponse;
            } else if (chunk.choices[0].delta) {
                streamable.update({ 'llmResponse': chunk.choices[0].delta.content });
                accumulatedLLMResponse += chunk.choices[0].delta.content;
            }
        }
    },
    falAiStableDiffusion3Medium: async function falAIStableDiffusion(mentionTool: string, userMessage: string, streamable: any): Promise<string | undefined> {
        const result = await fal.subscribe("fal-ai/stable-diffusion-v3-medium", {
            input: {
                prompt: userMessage,
                sync_mode: true
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === "IN_PROGRESS" && update.logs) {
                    update.logs.map((log) => log.message).forEach(console.log);
                }
            },
        });
        if ((result as any).images && (result as any).images.length > 0) {
            const imageUrl = (result as any).images[0].url;
            const response = await fetch(imageUrl);
            const buffer = await response.arrayBuffer();
            let base64data = Buffer.from(buffer).toString('base64');
            // add the base64 for a src attribute to the image tag to the base64 variable 
            base64data = `data:image/png;base64,${base64data}`;
            streamable.done({ 'falBase64Image': base64data });
            return undefined;
        } else {
            streamable.done({ 'llmResponseEnd': true });
            return undefined;
        }
    }

};