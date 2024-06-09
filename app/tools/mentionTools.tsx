import { OpenAI } from 'openai';
import { config } from '../config';
import Portkey from 'portkey-ai'

let portkey: Portkey;
if (config.usePortkey) {
    portkey = new Portkey({
        apiKey: process.env.PORTKEY_API_KEY,
        virtualKey: process.env.PORTKEY_BEDROCK_VIRTUAL_KEY
    })
}
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
    }
};