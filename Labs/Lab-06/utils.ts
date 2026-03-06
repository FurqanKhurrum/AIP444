import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.resolve(__dirname, "output");

export function serializeProduct(product: any): string {
  const tags = product.tags?.join(", ") ?? "";

  return [
    `Title: ${product.title}`,
    `Category: ${product.category}`,
    `Description: ${product.description}`,
    `Tags: ${tags}`,
    `Brand: ${product.brand}`,
  ].join(" | ");
}

export function dotProduct(vecA: number[], vecB: number[]): number {
  return vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
}

export async function loadDatabase() {
  const productsData = await readFile(
    path.join(OUTPUT_DIR, "products.json"),
    "utf-8"
  );
  const products = JSON.parse(productsData);

  const vectorsData = await readFile(
    path.join(OUTPUT_DIR, "vectors.tsv"),
    "utf-8"
  );
  const lines = vectorsData.trim().split("\n");

  const productsWithEmbeddings = products.map((product: any, index: number) => {
    const vector = lines[index].split("\t").map(Number);
    return { ...product, embedding: vector };
  });

  return productsWithEmbeddings;
}

export async function searchProducts(
  query: string,
  products: any[],
  client: OpenAI,
  minScore: number = 0.30
): Promise<any[]> {
  // 1. Embed the query
  const embeddingResponse = await client.embeddings.create({
    model: "openai/text-embedding-3-small",
    input: [query],
  });
  const queryVector = embeddingResponse.data[0].embedding;

  // 2. Score all products
  const scored = products.map((product) => ({
    ...product,
    score: dotProduct(queryVector, product.embedding),
  }));

  // 3. Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // 4. Filter below threshold and return top 5
  return scored.filter((p) => p.score >= minScore).slice(0, 5);
}