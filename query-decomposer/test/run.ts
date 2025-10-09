import dotenv from "dotenv";
import fs from "fs";

dotenv.config();
console.log("🔑 SERPER_API from env:", process.env.SERPER_API);

import { decomposeQuery } from "../queries/decompose";
import { searchWithSerper } from "../search/serper";
import { dedupeResults } from "../utils/dedupe";

async function run(query: string) {
  console.log("🧠 Original Query:", query);

  // Decompose query into subqueries
  const variations = decomposeQuery(query);
  console.log("🔍 Subqueries:", variations);

  // Search each subquery with error handling
  const tasks = variations.map(async (q: string) => {
    console.log(`🌐 Searching: ${q}`);
    try {
      const results = await searchWithSerper(q);
      console.log(`✅ Results for "${q}":`, results.length);
      return results;
    } catch (err) {
      console.error(`❌ Failed search for "${q}":`, err);
      return [];
    }
  });

  const results = await Promise.all(tasks);

  // Deduplicate all results
  const unique = dedupeResults(results);

  if (unique.length === 0) {
    console.log("⚠️ No results returned. Check your API key or query.");
    return;
  }

  // Clean results to avoid undefined fields
  const cleanResults = unique.map(r => ({
    title: r.title || "No title",
    url: r.link || r.url || "No URL",
    snippet: r.snippet || r.description || "No snippet available"
  }));

  // Print clean results
  console.log("🔍 Final Results:");
  cleanResults.forEach((r, i) => {
    console.log(`${i + 1}. ${r.title} — ${r.url} — ${r.snippet}`);
  });

  // Optional: save to JSON
  fs.writeFileSync("results.json", JSON.stringify(cleanResults, null, 2));
  console.log("✅ Results saved to results.json");
}

// Run the script with your query
run("LangChain architecture");
