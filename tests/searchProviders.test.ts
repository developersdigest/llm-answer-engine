import { getSearchResults, getImages, getVideos } from '../app/tools/searchProviders';
import { config } from '../app/config';

// Mock fetch globally
global.fetch = jest.fn();

describe('Search Providers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(() => {
    // Mock environment variables for API keys
    process.env.SERPER_API = 'test-serper-api-key';
    process.env.BRAVE_SEARCH_API_KEY = 'test-brave-api-key';
    process.env.GOOGLE_SEARCH_API_KEY = 'test-google-api-key';
    process.env.GOOGLE_CX = 'test-google-cx';
  });

  describe('getSearchResults', () => {
    test('returns empty array for unsupported provider', async () => {
      const originalProvider = config.searchProvider;
      config.searchProvider = 'unsupported';
      const results = await getSearchResults('test query');
      expect(results).toEqual([]);
      config.searchProvider = originalProvider;
    });

    test('handles API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API failure'));
      const results = await getSearchResults('test query');
      expect(results).toEqual([]);
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('getImages', () => {
    test('returns empty array on API error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      const images = await getImages('test query');
      expect(images).toEqual([]);
    });

    test('returns empty array on bad response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: jest.fn().mockResolvedValue({}),
      });
      const images = await getImages('test query');
      expect(images).toEqual([]);
    });
  });

  describe('getVideos', () => {
    test('returns empty array on API error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      const videos = await getVideos('test query');
      expect(videos).toEqual([]);
    });

    test('returns empty array on bad response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: jest.fn().mockResolvedValue({}),
      });
      const videos = await getVideos('test query');
      expect(videos).toEqual([]);
    });
  });
});
