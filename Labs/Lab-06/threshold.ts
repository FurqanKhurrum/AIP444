import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { loadDatabase, dotProduct } from "./utils.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("ERROR: OPENROUTER_API_KEY not found");
  process.exit(1);
}

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey,
});

async function testQuery(query: string, products: any[]) {
  const embeddingResponse = await client.embeddings.create({
    model: "openai/text-embedding-3-small",
    input: [query],
  });
  const queryVector = embeddingResponse.data[0].embedding;

  const scored = products
    .map((p) => ({ title: p.title, score: dotProduct(queryVector, p.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  console.log(`\nQuery: "${query}"`);
  scored.forEach((r, i) => {
    console.log(`  ${i + 1}. [Score: ${r.score.toFixed(4)}] ${r.title}`);
  });
}

async function main() {
  console.log("Loading database...");
  const products = await loadDatabase();

  // Good match — product exists
  //await testQuery("oral hygiene care products", products);
  await testQuery("I want to buy a luxury boat", products);
    await testQuery("Do you have any vegan cat food?", products);
    await testQuery("I want to cook a healthy high protein dinner tonight", products);
  // Bad match — product does not exist
  // await testQuery("car seat covers", products);
}

main();