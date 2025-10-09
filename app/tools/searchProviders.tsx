"use server";
import { SearchResult } from '@/components/answer/SearchResultsComponent';
import { config } from '../config';

export async function getSearchResults(userMessage: string): Promise<any> {
    switch (config.searchProvider) {
        case "brave":
            return braveSearch(userMessage);
        case "serper":
            return serperSearch(userMessage);
        case "google":
            return googleSearch(userMessage);
        default:
            return Promise.reject(new Error(`Unsupported search provider: ${config.searchProvider}`));
    }
}

export async function braveSearch(message: string, numberOfPagesToScan = config.numberOfPagesToScan): Promise<SearchResult[]> {
    try {
        const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(message)}&count=${numberOfPagesToScan}`, {
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY as string
            }
        });
        if (!response.ok) {
            const body = await response.text().catch(() => null);
            throw new Error(`Brave Search API returned ${response.status}: ${body || 'no response body'}`);
        }
        const jsonResponse = await response.json();
        if (!jsonResponse.web || !jsonResponse.web.results) {
            throw new Error('Invalid API response format');
        }
        const final = jsonResponse.web.results.map((result: any): SearchResult => ({
            title: result.title,
            link: result.url,
            favicon: result.profile.img
        }));
        return final;
    } catch (error) {
        console.error('Error fetching search results:', error);
        throw error;
    }
}

export async function googleSearch(message: string, numberOfPagesToScan = config.numberOfPagesToScan): Promise<SearchResult[]> {
    try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_SEARCH_API_KEY}&cx=${process.env.GOOGLE_CX}&q=${encodeURIComponent(message)}&num=${numberOfPagesToScan}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const jsonResponse = await response.json();
        if (!jsonResponse.items) {
            throw new Error('Invalid API response format');
        }
        const final = jsonResponse.items.map((result: any): SearchResult => ({
            title: result.title,
            link: result.link,
            favicon: result.pagemap?.cse_thumbnail?.[0]?.src || ''
        }));
        return final;
    } catch (error) {
        console.error('Error fetching search results:', error);
        throw error;
    }
}

export async function serperSearch(message: string, numberOfPagesToScan = config.numberOfPagesToScan): Promise<SearchResult[]> {
    const serperApiKey = process.env.SERPER_API;
    if (!serperApiKey) {
        throw new Error("SERPER_API key is not set in environment variables.");
    }
    const url = 'https://google.serper.dev/search';
    const data = JSON.stringify({
        "q": message
    });
    const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
            'X-API-KEY': serperApiKey,
            'Content-Type': 'application/json'
        },
        body: data
    };
    try {
        const response = await fetch(url, requestOptions);
        if (!response.ok) {
            const body = await response.text().catch(() => null);
            throw new Error(`Serper search API returned ${response.status}: ${body || 'no response body'}`);
        }
        const responseData = await response.json();
        if (!responseData.organic) {
            throw new Error('Invalid API response format');
        }
        const final = responseData.organic.map((result: any): SearchResult => ({
            title: result.title,
            link: result.link,
            favicon: result.favicons?.[0] || ''
        }));
        return final
    } catch (error) {
        console.error('Error fetching search results:', error);
        throw error;
    }
}

export async function getImages(message: string): Promise<{ title: string; link: string }[]> {
    const serperApiKey = process.env.SERPER_API;
    if (!serperApiKey) {
        throw new Error("SERPER_API key is not set in environment variables.");
    }
    const url = 'https://google.serper.dev/images';
    const data = JSON.stringify({
        "q": message
    });
    const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
            'X-API-KEY': serperApiKey,
            'Content-Type': 'application/json'
        },
        body: data
    };
    try {
        const response = await fetch(url, requestOptions);
        if (!response.ok) {
            const body = await response.text().catch(() => null);
            throw new Error(`Serper images API returned ${response.status}: ${body || 'no response body'}`);
        }
        const responseData = await response.json();
        const validLinks = await Promise.all(
            responseData.images.map(async (image: any) => {
                const link = image.imageUrl;
                if (typeof link === 'string') {
                    try {
                        const imageResponse = await fetch(link, { method: 'HEAD' });
                        if (imageResponse.ok) {
                            const contentType = imageResponse.headers.get('content-type');
                            if (contentType && contentType.startsWith('image/')) {
                                return {
                                    title: image.title,
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
        console.error('Error fetching images:', error);
        throw error;
    }
}

export async function getVideos(message: string): Promise<{ imageUrl: string, link: string }[] | null> {
    const serperApiKey = process.env.SERPER_API;
    if (!serperApiKey) {
        throw new Error("SERPER_API key is not set in environment variables.");
    }
    const url = 'https://google.serper.dev/videos';
    const data = JSON.stringify({
        "q": message
    });
    const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
            'X-API-KEY': serperApiKey,
            'Content-Type': 'application/json'
        },
        body: data
    };
    try {
        const response = await fetch(url, requestOptions);
        if (!response.ok) {
            const body = await response.text().catch(() => null);
            throw new Error(`Serper videos API returned ${response.status}: ${body || 'no response body'}`);
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