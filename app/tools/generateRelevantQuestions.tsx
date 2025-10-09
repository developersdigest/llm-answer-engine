
import { config } from '../config';
import { OpenAI } from 'openai';


function getOpenAIClient(provider: 'ollama' | 'openai' | 'groq' = 'openai') {
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

interface SearchResult {
    title: string;
    link: string;
    favicon: string;
}

export const relevantQuestions = async (sources: SearchResult[], userMessage: String): Promise<any> => {
    // Always use OpenAI for follow-up questions, since Ollama does not support this
    const client = getOpenAIClient('openai');
    return await client.chat.completions.create({
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
        model: 'gpt-3.5-turbo',
        response_format: { type: "json_object" },
    });
};