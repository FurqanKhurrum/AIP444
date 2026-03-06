import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";
import OpenAI from "openai";
import { loadDatabase, searchProducts } from "./utils.ts";

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

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log("Loading database...");
  const products = await loadDatabase();
  console.log(`Loaded ${products.length} products.\n`);
  console.log("Welcome to the Semantic Product Search!");
  console.log('Type "exit" to quit.\n');

  while (true) {
    const query = await prompt("What are you looking for? ");

    if (query.toLowerCase() === "exit") {
      console.log("Goodbye! hope you found what you were looking for.");
      rl.close();
      break;
    }

    if (!query.trim()) continue;

    console.log("\nSearching...");
    const results = await searchProducts(query, products, client);

    if (results.length === 0) {
      console.log("I'm sorry, we don't have anything like that in stock.\n");
    } else {
      console.log(`\nFound ${results.length} match${results.length > 1 ? "es" : ""}:`);
      results.forEach((product, index) => {
        console.log(
          `  ${index + 1}. [Score: ${product.score.toFixed(4)}] ${product.title} - $${product.price}`
        );
      });
      console.log();
    }
  }
}

main();