import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { writeFile, mkdir } from "fs/promises";
import OpenAI from "openai";
import { serializeProduct } from "./utils.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "..", "..", ".env");
dotenv.config({ path: envPath });

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error("ERROR: OPENROUTER_API_KEY not found in", envPath);
  process.exit(1);
}

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey,
});

const OUTPUT_DIR = path.resolve(__dirname, "output");

async function main() {
  // Create output folder if it doesn't exist
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Step 1: Fetch products
  console.log("Fetching products...");
  const response = await fetch("https://dummyjson.com/products?limit=200");
  const data = await response.json();
  const products = data.products;
  console.log(`Fetched ${products.length} products.`);

  // Step 2: Save products.json
  await writeFile(
    path.join(OUTPUT_DIR, "products.json"),
    JSON.stringify(products, null, 2),
    "utf-8"
  );
  console.log("Saved products.json");

  // Step 3: Serialize products
  const serialized = products.map(serializeProduct);

  // Step 4: Embed all serialized products in one API call
  console.log("Generating embeddings...");
  const embeddingResponse = await client.embeddings.create({
    model: "openai/text-embedding-3-small",
    input: serialized,
  });
  const embeddings = embeddingResponse.data.map((e) => e.embedding);
  console.log(`Generated ${embeddings.length} embeddings.`);

  // Step 5: Save vectors.tsv
  const vectorLines = embeddings.map((vec) => vec.join("\t"));
  await writeFile(
    path.join(OUTPUT_DIR, "vectors.tsv"),
    vectorLines.join("\n"),
    "utf-8"
  );
  console.log("Saved vectors.tsv");

  // Step 6: Save metadata.tsv
  const metadataLines = ["Title\tCategory"];
  for (const product of products) {
    const title = product.title.replace(/\t|\n/g, " ");
    const category = product.category.replace(/\t|\n/g, " ");
    metadataLines.push(`${title}\t${category}`);
  }
  await writeFile(
    path.join(OUTPUT_DIR, "metadata.tsv"),
    metadataLines.join("\n"),
    "utf-8"
  );
  console.log("Saved metadata.tsv");

  console.log("\nDone! All files saved to /output");
}

main();
