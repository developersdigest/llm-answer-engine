"use server";
import { SearchResult } from '@/components/answer/SearchResultsComponent';
import { config } from '../config';

export async function getSearchResults(userMessage: string): Promise<any> {
    try {
        switch (config.searchProvider) {
            case "brave":
                return await braveSearch(userMessage);
            case "serper":
                return await serperSearch(userMessage);
            case "google":
                return await googleSearch(userMessage);
            default:
                console.error(`Unsupported search provider: ${config.searchProvider}`);
                return [];
        }
    } catch (error) {
        console.error('Error in getSearchResults:', error);
        return [];
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
            console.log('Issue with response from Brave Search API');
            return [];
        }
        const jsonResponse = await response.json();
        if (!jsonResponse.web || !jsonResponse.web.results) {
            console.error('Invalid API response format from Brave Search API');
            return [];
        }
        const final = jsonResponse.web.results.map((result: any): SearchResult => ({
            title: result.title,
            link: result.url,
            favicon: result.profile?.img || ''
        }));
        return final;
    } catch (error) {
        console.error('Error fetching search results:', error);
        return [];
    }
}

export async function googleSearch(message: string, numberOfPagesToScan = config.numberOfPagesToScan): Promise<SearchResult[]> {
    try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_SEARCH_API_KEY}&cx=${process.env.GOOGLE_CX}&q=${encodeURIComponent(message)}&num=${numberOfPagesToScan}`;
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            return [];
        }
        const jsonResponse = await response.json();
        if (!jsonResponse.items) {
            console.error('Invalid API response format from Google Search API');
            return [];
        }
        const final = jsonResponse.items.map((result: any): SearchResult => ({
            title: result.title,
            link: result.link,
            favicon: result.pagemap?.cse_thumbnail?.[0]?.src || ''
        }));
        return final;
    } catch (error) {
        console.error('Error fetching search results:', error);
        return [];
    }
}

export async function serperSearch(message: string, numberOfPagesToScan = config.numberOfPagesToScan): Promise<SearchResult[]> {
    const url = 'https://google.serper.dev/search';
    const data = JSON.stringify({
        "q": message
    });
    const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
            'X-API-KEY': process.env.SERPER_API as string,
            'Content-Type': 'application/json'
        },
        body: data
    };
    try {
        const response = await fetch(url, requestOptions);
        if (!response.ok) {
            console.error(`Network response was not ok. Status: ${response.status}`);
            return [];
        }
        const responseData = await response.json();
        if (!responseData.organic) {
            console.error('Invalid API response format from Serper API');
            return [];
        }
        const final = responseData.organic.map((result: any): SearchResult => ({
            title: result.title,
            link: result.link,
            favicon: result.favicons?.[0] || ''
        }));
        return final
    } catch (error) {
        console.error('Error fetching search results:', error);
        return [];
    }
}

export async function getImages(message: string): Promise<{ title: string; link: string }[]> {
    try {
        const url = 'https://google.serper.dev/images';
        const data = JSON.stringify({
            "q": message
        });
        const requestOptions: RequestInit = {
            method: 'POST',
            headers: {
                'X-API-KEY': process.env.SERPER_API as string,
                'Content-Type': 'application/json'
            },
            body: data
        };
        const response = await fetch(url, requestOptions);
        if (!response.ok) {
            console.error(`Network response was not ok. Status: ${response.status}`);
            return [];
        }
        const responseData = await response.json();
        if (!responseData.images) {
            console.error('Invalid API response format from Serper Images API');
            return [];
        }
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
        return [];
    }
}

export async function getVideos(message: string): Promise<{ imageUrl: string, link: string }[] | null> {
    try {
        const url = 'https://google.serper.dev/videos';
        const data = JSON.stringify({
            "q": message
        });
        const requestOptions: RequestInit = {
            method: 'POST',
            headers: {
                'X-API-KEY': process.env.SERPER_API as string,
                'Content-Type': 'application/json'
            },
            body: data
        };
        const response = await fetch(url, requestOptions);
        if (!response.ok) {
            console.error(`Network response was not ok. Status: ${response.status}`);
            return [];
        }
        const responseData = await response.json();
        if (!responseData.videos) {
            console.error('Invalid API response format from Serper Videos API');
            return [];
        }
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
        return [];
    }
}

