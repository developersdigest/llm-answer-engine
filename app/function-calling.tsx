import OpenAI from 'openai';
import { config } from './config';
import { SpotifyApi } from "@spotify/web-api-ts-sdk";

// Assuming 'config' is correctly defined in './config' and provides the necessary properties.
// Assuming 'process.env.SPOTIFY_CLIENT_ID', 'process.env.SPOTIFY_CLIENT_SECRET', 
// and 'process.env.SERPER_API' are correctly set in the environment.

const client = new OpenAI({
    baseURL: config.nonOllamaBaseURL,
    apiKey: config.inferenceAPIKey
});
const MODEL = config.inferenceModel;

const api = SpotifyApi.withClientCredentials(
    process.env.SPOTIFY_CLIENT_ID as string,
    process.env.SPOTIFY_CLIENT_SECRET as string
);

// --- Tool Implementations ---

/**
 * Searches for places using the Serper Places API.
 * @param query The search query for places (e.g., "restaurants").
 * @param location The location to search in (e.g., "New York City").
 * @returns A JSON string with the search results or an error.
 */
export async function searchPlaces(query: string, location: string): Promise<string> {
    const serperApiKey = process.env.SERPER_API;
    if (!serperApiKey) {
        // Corrected to throw an Error as expected by the calling environment.
        return JSON.stringify({ error: "SERPER_API key is not set in environment variables." });
    }
    // ISSUE/FIX 1: Check if required arguments are present before proceeding
    if (!query || !location) {
        return JSON.stringify({ error: "Missing required arguments 'query' or 'location' for searchPlaces." });
    }
    try {
        const response = await fetch('https://google.serper.dev/places', {
            method: 'POST',
            headers: {
                'X-API-KEY': serperApiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ q: query, location: location }),
        });
        if (!response.ok) {
            const body = await response.text().catch(() => null);
            throw new Error(`Serper places API returned ${response.status}: ${body || 'no response body'}`);
        }
        const data = await response.json();
        // Added a check for 'data.places' existence before mapping.
        const normalizedData = {
            type: 'places',
            places: Array.isArray(data.places) ? data.places.map((place: any) => ({
                position: place.position,
                title: place.title,
                address: place.address,
                latitude: place.latitude,
                longitude: place.longitude,
                rating: place.rating,
                ratingCount: place.ratingCount,
                category: place.category,
                phoneNumber: place.phoneNumber,
                website: place.website,
                cid: place.cid
            })) : []
        };
        return JSON.stringify(normalizedData);
    } catch (error) {
        console.error('Error searching for places:', error);
        // Ensure error response is a consistent object structure.
        return JSON.stringify({ error: `Failed to search for places: ${(error as Error).message}` });
    }
}

/**
 * Searches for shopping items using the Serper Shopping API.
 * @param query The search query for shopping items.
 * @returns A JSON string with the search results or an error.
 */
export async function goShopping(query: string): Promise<string> {
    const serperApiKey = process.env.SERPER_API;
    if (!serperApiKey) {
        return JSON.stringify({ error: "SERPER_API key is not set in environment variables." });
    }
    // ISSUE/FIX 1: Check if required arguments are present before proceeding
    if (!query) {
        return JSON.stringify({ error: "Missing required argument 'query' for goShopping." });
    }
    const url = 'https://google.serper.dev/shopping';
    const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
            'X-API-KEY': serperApiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ "q": query })
    };
    try {
        const response = await fetch(url, requestOptions);
        if (!response.ok) {
            const body = await response.text().catch(() => null);
            throw new Error(`Serper shopping API returned ${response.status}: ${body || 'no response body'}`);
        }
        const responseData = await response.json();
        const shoppingData = {
            type: 'shopping',
            // Added check for responseData.shopping existence
            shopping: Array.isArray(responseData.shopping) ? responseData.shopping : []
        };
        return JSON.stringify(shoppingData);
    } catch (error) {
        console.error('Error fetching shopping data:', error);
        return JSON.stringify({ error: `Failed to fetch shopping data: ${(error as Error).message}` });
    }
}

/**
 * Mocks fetching a stock ticker symbol.
 * @param ticker The stock ticker symbol and market name.
 * @returns A JSON string containing the ticker data.
 */
export async function getTickers(ticker: string): Promise<string> {
    // ISSUE/FIX 1: Check if required arguments are present before proceeding
    if (!ticker) {
        return JSON.stringify({ error: "Missing required argument 'ticker' for getTickers." });
    }
    // This function seems to be a mock or placeholder and is kept as is, 
    // ensuring it returns the expected JSON string structure.
    return JSON.stringify({ type: 'ticker', data: ticker });
}

/**
 * Searches for a song on Spotify.
 * @param query The search query to find a song on Spotify.
 * @returns A JSON string with the track ID or an error.
 */
export async function searchSong(query: string): Promise<string> {
    // ISSUE/FIX 1: Check if required arguments are present before proceeding
    if (!query) {
        return JSON.stringify({ error: "Missing required argument 'query' for searchSong." });
    }
    try {
        const items = await api.search(query, ["track"]);
        const track = items.tracks.items[0];
        if (track) {
            const trackId = track.uri.replace('spotify:track:', '');
            // Returned trackId directly in the top-level object for consistency in functionCalling consolidation logic
            return JSON.stringify({ trackId: trackId });
        } else {
            return JSON.stringify({ error: "No matching song found." });
        }
    } catch (error) {
        console.error('Error searching for song on Spotify:', error);
        return JSON.stringify({ error: 'Failed to search for song on Spotify' });
    }
}

// --- Main Function Calling Logic ---

/**
 * The main function that orchestrates the function calling process with the OpenAI model.
 * @param query The user's request.
 * @returns A promise that resolves to a structured object containing function results or an error.
 */
export async function functionCalling(query: string): Promise<any> {
    try {
        if (!config.inferenceAPIKey) {
            return { error: "Missing inference API key." };
        }

        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: "system", content: "You are a function calling agent. You will be given a query and a list of functions. Your task is to call the appropriate function based on the query and return the result in JSON format. ONLY CALL A FUNCTION IF YOU ARE HIGHLY CONFIDENT IT WILL BE USED. For place searches, ensure both 'query' and 'location' parameters are specified." },
            { role: "user", content: query },
        ];
        
        // Tools definition remains correct.

        const tools = [
            {
                type: "function",
                function: {
                    name: "getTickers",
                    description: "Get a single market name and stock ticker if the user mentions a public company",
                    parameters: {
                        type: "object",
                        properties: {
                            ticker: {
                                type: "string",
                                description: "The stock ticker symbol and market name, example NYSE:K or NASDAQ:AAPL",
                            },
                        },
                        required: ["ticker"],
                    },
                },
            },
            {
                type: "function",
                function: {
                    name: "searchPlaces",
                    description: "ONLY SEARCH for places using the given query and location",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "The search query for places",
                            },
                            location: {
                                type: "string",
                                description: "The location to search for places",
                            },
                        },
                        required: ["query", "location"],
                    },
                },
            },
            {
                type: "function",
                function: {
                    name: "goShopping",
                    description: "Search for shopping items using the given query",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                            },
                        },
                        required: ["query"],
                    },
                }
            },
            {
                type: "function",
                function: {
                    name: "searchSong",
                    description: "Searches for a song on Spotify based on the provided search query and returns the track ID.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "The search query to find a song on Spotify, such as the song title or artist name.",
                            },
                        },
                        required: ["query"],
                    },
                },
            },
        ];

        const response = await client.chat.completions.create({
            model: MODEL,
            messages: messages,
            tools: tools,
            tool_choice: "auto",
            max_tokens: 4096,
        });

        const responseMessage = response.choices[0].message;
        const toolCalls = responseMessage.tool_calls;

        if (toolCalls) {
            // ISSUE/FIX 2: Use a typed map to ensure function calls are type-safe without 'as'
            // This prevents runtime errors if a function is called with the wrong arguments.
            const availableFunctions: {
                [key: string]: (args: any) => Promise<string>;
            } = {
                getTickers: (args: { ticker: string }) => getTickers(args.ticker),
                searchPlaces: (args: { query: string, location: string }) => searchPlaces(args.query, args.location),
                goShopping: (args: { query: string }) => goShopping(args.query),
                searchSong: (args: { query: string }) => searchSong(args.query),
            };

            // Only push the response message if there are tool calls to process.
            messages.push(responseMessage);
            const toolResults = [];

            for (const toolCall of toolCalls) {
                const functionName = toolCall.function.name;
                const functionToCall = availableFunctions[functionName];

                try {
                    if (!functionToCall) {
                        throw new Error(`Function '${functionName}' not found in availableFunctions map.`);
                    }
                    
                    // Added more robust JSON parsing and type checking for function arguments.
                    let functionArgs: any;
                    try {
                        functionArgs = JSON.parse(toolCall.function.arguments);
                    } catch (e) {
                        console.error(`Error parsing arguments for ${functionName}:`, e);
                        toolResults.push({ error: `Invalid arguments for function ${functionName}` });
                        continue;
                    }

                    // Cast is safe here because the map is typed to handle any arguments, 
                    // and the individual function definitions enforce the contract.
                    const functionResponse = await functionToCall(functionArgs); 
                    
                    // The functions are now guaranteed to return a JSON string.
                    if (typeof functionResponse !== 'string') {
                        toolResults.push({ error: `Function ${functionName} returned an invalid response type (not a string).` });
                        continue;
                    }
                    
                    // Now parse the JSON string result.
                    toolResults.push(JSON.parse(functionResponse));
                    
                } catch (error) {
                    console.error(`Error calling function ${functionName}:`, error);
                    toolResults.push({ error: `Failed to call function ${functionName}: ${(error as Error).message}` });
                }
            }

            // Consolidate results into a single, predictable object structure.
            const consolidatedResult: {
                places?: any[];
                shopping?: any[];
                ticker?: string;
                trackId?: string;
                errors?: string[];
                text?: string; 
            } = { errors: [] };

            for (const result of toolResults) {
                if (result.error) {
                    consolidatedResult.errors?.push(typeof result.error === 'string' ? result.error : JSON.stringify(result.error));
                } else if (result.type === 'places') {
                    consolidatedResult.places = result.places;
                } else if (result.type === 'shopping') {
                    consolidatedResult.shopping = result.shopping;
                } else if (result.type === 'ticker') {
                    consolidatedResult.ticker = result.data;
                } else if (result.trackId) {
                    consolidatedResult.trackId = result.trackId;
                }
            }
            
            // Clean up empty errors array if no errors occurred
            if (consolidatedResult.errors && consolidatedResult.errors.length === 0) {
                delete consolidatedResult.errors;
            }

            // Return the single, structured object.
            return consolidatedResult;
        } else {
            // Added logic for when the model returns a direct text response instead of a function call.
            return { text: responseMessage.content || "No function call or text response received." };
        }
    } catch (error) {
        console.error('Error in functionCalling:', error);
        // Added detail to the top-level error message.
        return { error: `An error occurred during function calling: ${(error as Error).message}` };
    }
}