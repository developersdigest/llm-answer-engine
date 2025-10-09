
import { config } from '../config';
import cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
// Use Mozilla Readability to extract main content from HTML
function extractReadableContent(html: string): string {
    try {
        const dom = new JSDOM(html);
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        return article?.textContent || '';
    } catch (e) {
        return '';
    }
}

// Query decomposition: generate multiple search queries for complex questions
export async function decomposeQuery(userQuery: string): Promise<string[]> {
    // Use your LLM or a prompt to generate decomposed queries
    // Example prompt:
    // "Your role is to generate a few short and specific search queries to answer the QUERY below. List 3 options, 1 per line. QUERY: ..."
    // For now, return a simple split for demonstration
    // Replace with LLM call for production
    return userQuery.split(/[.,;\n]/).map(q => q.trim()).filter(q => q.length > 0);
}
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Document as DocumentInterface } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";

function getEmbeddingsProvider(provider: 'ollama' | 'openai' = 'ollama') {
    if (provider === 'ollama') {
        return new OllamaEmbeddings({
            model: config.embeddingsModel,
            baseUrl: config.ollamaBaseURL.replace('/v1','')
        });
    } else {
        return new OpenAIEmbeddings({
            modelName: config.embeddingsModel
        });
    }
}

let embeddings: OllamaEmbeddings | OpenAIEmbeddings;
try {
    if (config.useOllamaEmbeddings) {
        embeddings = getEmbeddingsProvider('ollama');
    } else {
        embeddings = getEmbeddingsProvider('openai');
    }
} catch (err) {
    // fallback to OpenAI if Ollama fails
    embeddings = getEmbeddingsProvider('openai');
}

interface SearchResult {
    title: string;
    link: string;
    favicon: string;
}
interface ContentResult extends SearchResult {
    html: string;
}


//  Fetch contents of top 10 search results
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
        // Use Readability for better extraction
        const readable = extractReadableContent(html);
        if (readable && readable.length > 100) return readable;
        // fallback to cheerio
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
// rocess and vectorize content using LangChain
export async function processAndVectorizeContent(
    contents: ContentResult[],
    query: string,
    textChunkSize = config.textChunkSize,
    textChunkOverlap = config.textChunkOverlap,
    numberOfSimilarityResults = config.numberOfSimilarityResults,
): Promise<DocumentInterface[]> {
    const allResults: DocumentInterface[] = [];
    try {
        for (let i = 0; i < contents.length; i++) {
            const content = contents[i];
            if (content.html.length > 0) {
                try {
                    const splitText = await new RecursiveCharacterTextSplitter({ chunkSize: textChunkSize, chunkOverlap: textChunkOverlap }).splitText(content.html);
                    const vectorStore = await MemoryVectorStore.fromTexts(splitText, { title: content.title, link: content.link }, embeddings);
                    const contentResults = await vectorStore.similaritySearch(query, numberOfSimilarityResults);
                    allResults.push(...contentResults);
                } catch (error) {
                    console.error(`Error processing content for ${content.link}:`, error);
                }
            }
        }
        return allResults;
    } catch (error) {
        console.error('Error processing and vectorizing content:', error);
        throw error;
    }
}