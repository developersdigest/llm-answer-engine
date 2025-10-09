// - The below are going to be the default values, eventually this will move to a UI component so it can be easily changed by the user
// - To enable + use Ollama models, ensure inference and/or embeddings model are downloaded and ollama is running https://ollama.com/library 
// - Icons within UI are not yet dynamic, to change currently, you must change the img src path in the UI component
// - IMPORTANT: when Ollama Embeddings + Ollama inference enabled at the same time, this can cause time-to-first-token to be quite long
// - IMPORTANT: Follow-up questions are not yet implrmented with Ollama models, only OpenAI compatible models that use  {type: "json_object"}

export const config = {
    // Enable Ollama as primary inference and embeddings
    useOllamaInference: true,
    useOllamaEmbeddings: true,
    searchProvider: 'serper', // 'serper', 'google' // 'serper' is the default
    // Set your local Ollama model name here (e.g., 'gemma3:4b')
    inferenceModel: 'gemma3:4b',
    // API key for OpenAI (fallback)
    openaiAPIKey: process.env.OPENAI_API_KEY,
    // API key for Groq
    groqAPIKey: process.env.GROQ_API_KEY,
    // API key for Ollama (not required, but set to 'ollama' for compatibility)
    ollamaAPIKey: 'ollama',
    // Embeddings model (Ollama or OpenAI)
    embeddingsModel: 'gemma3:4b',
    textChunkSize: 400, // Lower for local models for faster response
    textChunkOverlap: 100, // Lower for local models for faster response
    numberOfSimilarityResults: 4,
    numberOfPagesToScan: 5, // Lower for local models for faster response
    // Fallback base URL for OpenAI
    openaiBaseURL: 'https://api.openai.com/v1',
    // Groq base URL
    groqBaseURL: 'https://api.groq.com/openai/v1',
    // Ollama base URL
    ollamaBaseURL: 'http://host.docker.internal:11434/v1', // Docker can reach Ollama via host.docker.internal
    useFunctionCalling: true,
    useRateLimiting: false,
    useSemanticCache: false,
    usePortkey: false,
    // Fallback logic: if Ollama fails, use OpenAI
    fallbackProvider: 'openai',
}
