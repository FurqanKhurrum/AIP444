import { processImage } from "./imageProcessor";
import { runAgent } from "./agent";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "..", "..", ".env");
dotenv.config({ path: envPath });
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error("Usage: npm start <path-to-screenshot> [optional prompt]");
    console.error('Example: npm start error.png "What is wrong here?"');
    process.exit(1);
  }

  const imagePath = args[0];
  const userPrompt = args[1] ?? "Analyze this screenshot and help me fix the error.";

  try {
    console.error(`[vis-fix] Processing image: ${imagePath}`);
    const base64Image = await processImage(imagePath);

    console.error(`[vis-fix] Running agent...`);
    const result = await runAgent(base64Image, userPrompt);

    // Final answer goes to stdout only
    console.log("\n" + result);
  } catch (err) {
    console.error(`[vis-fix] Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();