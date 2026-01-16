console.log("Git Scribe - Developed by Furqan Khurrum - 151694239");
console.log("--------------------------------------------------------------");

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "..", "..", ".env");

dotenv.config({ path: envPath });

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error("ERROR: OPENROUTER_API_KEY not found");
  process.exit(1);
}
