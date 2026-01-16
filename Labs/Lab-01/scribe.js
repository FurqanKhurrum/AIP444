console.log("Git Scribe - Developed by Furqan Khurrum - 151694239");
console.log("--------------------------------------------------------------");

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "..", "..", ".env");

dotenv.config({ path: envPath });

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error("ERROR: OPENROUTER_API_KEY not found");
  process.exit(1);
}



// Run: git diff --staged
let diff = "";
try {
  diff = execSync("git diff --staged", { encoding: "utf8" });
} catch (err) {
  // If git fails (not a repo, git not installed, etc.)
  console.error("ERROR: Failed to run 'git diff --staged'");
  process.exit(1);
}

if (!diff.trim()) {
  console.error("❌ No staged changes found");
  process.exit(1);
}

console.log(`✅ Diff found: ${diff.length} characters`);
