import axios from "axios";

export async function searchWithBrave(query: string): Promise<any[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  const response = await axios.get("https://api.search.brave.com/res/v1/web/search", {
    headers: { "X-Subscription-Token": apiKey },
    params: { q: query }
  });
  return response.data.web?.results || [];
}