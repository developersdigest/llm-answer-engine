import axios from "axios";

export async function searchWithSerper(query: string): Promise<any[]> {
  const apiKey = process.env.SERPER_API;
  const response = await axios.post("https://google.serper.dev/search", {
    q: query
  }, {
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json"
    }
  });

  return response.data.organic || [];
}