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

// Step 2: Command-Line Arguments
import fs from "fs";
import { parseArgs } from "node:util";

function parseArguments() {
  const { values, positionals } = parseArgs({
    options: {
      count: { type: "string", short: "c", default: "3" },
    },
    allowPositionals: true,
  });

  // 1) Must have notes path
  if (positionals.length === 0) {
    console.error("❌ Error: Missing notes file path.");
    console.error("Usage: node flashcard-gen.js Lab-02/notes.md [--count N]");
    process.exit(1);
  }

  const notesPath = positionals[0];

  // 2) File must exist
  if (!fs.existsSync(notesPath)) {
    console.error(`❌ Error: File not found: ${notesPath}`);
    process.exit(1);
  }

  // 3) Count must be 1–5 (default 3 already handled)
  const count = Number.parseInt(values.count, 10);
  if (!Number.isInteger(count) || count < 1 || count > 5) {
    console.error("❌ Error: --count must be an integer between 1 and 5.");
    process.exit(1);
  }

  return { notesPath, count };
}

const { notesPath, count } = parseArguments();
