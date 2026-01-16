console.log("Git Scribe - Developed by Furqan Khurrum - 151694239");
console.log("--------------------------------------------------------------");

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import OpenAI from "openai";

const is_creative = process.argv.includes("--creative");
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

// --- OpenRouter via OpenAI SDK ---
const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });
  
  const systemPromptDefault =
  "You are an assistant in a CLI tool that writes semantic Git commit messages. " +
  "You will be given a git diff of staged changes. " +
  "Return ONLY ONE commit message line in Conventional Commits format " +
  "(e.g., feat: add logging). No markdown, no quotes, no explanation.";
  
  const systemPromptCreative =
  "You are a 17th Century Pirate living inside a Git CLI tool. " +
  "You will be given a git diff of staged changes. " +
  "Return ONLY ONE SINGLE-LINE commit message. " +
  "It MUST still start with a Conventional Commits type like feat:, fix:, docs:, refactor:, test:, chore:. " +
  "After the type, write the rest in pirate slang (arr!, matey, etc.). " +
  "No markdown, no quotes, no extra lines.";

  const systemPrompt = is_creative ? systemPromptCreative : systemPromptDefault;
  const temperature = is_creative ? 1.2 : 0.1; // creative mode 0.9–2.0

  try {
    const response = await client.chat.completions.create({
      model: "google/gemini-2.0-flash-exp:free",
      //model: "meta-llama/llama-3.2-3b-instruct:free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: diff },
      ],
      temperature,
    });
  
    const commitMsg = response.choices?.[0]?.message?.content?.trim();
  
    if (!commitMsg) {
      console.error("❌ Error: LLM returned an empty response");
      process.exit(1);
    }
  
    // Print only the commit message (after the diff status line)
    console.log(commitMsg);
  } catch (err) {
    console.error("❌ Error: Failed to generate commit message via OpenRouter");
    console.error(String(err?.message || err));
    process.exit(1);
  }