import { OpenAI } from 'openai';
import { config } from '../../config';


function getOpenAIClient(provider: 'ollama' | 'openai' | 'groq' = 'ollama') {
    if (provider === 'ollama') {
        return new OpenAI({
            baseURL: config.ollamaBaseURL,
            apiKey: config.ollamaAPIKey
        });
    } else if (provider === 'openai') {
        return new OpenAI({
            baseURL: config.openaiBaseURL,
            apiKey: config.openaiAPIKey
        });
    } else {
        return new OpenAI({
            baseURL: config.groqBaseURL,
            apiKey: config.groqAPIKey
        });
    }
}

export async function streamChatCompletion(mentionTool: string, userMessage: string, streamable: any): Promise<void> {
    let client = getOpenAIClient('ollama');
    let chatCompletion;
    try {
        chatCompletion = await client.chat.completions.create({
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
    } catch (err) {
        // Fallback to OpenAI if Ollama fails
        client = getOpenAIClient('openai');
        chatCompletion = await client.chat.completions.create({
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
            model: 'gpt-3.5-turbo', // fallback model
        });
    }
    let accumulatedLLMResponse = "";
    for await (const chunk of chatCompletion) {
        if (chunk.choices[0].delta && chunk.choices[0].finish_reason !== "stop") {
            streamable.update({ 'llmResponse': chunk.choices[0].delta.content });
            accumulatedLLMResponse += chunk.choices[0].delta.content;
        } else if (chunk.choices[0].finish_reason === "stop") {
            streamable.done({ 'llmResponseEnd': true });
            return;
        }
    }
    return;
}