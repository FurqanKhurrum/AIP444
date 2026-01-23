console.log("AI FLASHCARD MAKER - Developed by Furqan Khurrum - 151694239");
console.log("--------------------------------------------------------------");

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { readFile } from "node:fs/promises";
import OpenAI from "openai";

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

// Step 3: Read INSTRUCTIONS & Notes File
async function getFileContents(filePath, description) {
    try {
      return await readFile(filePath, "utf-8");
    } catch (err) {
      console.error(`❌ Error: ${description} not found or unreadable: ${filePath}`);
      console.error(`   ${err.message}`);
      process.exit(1);
    }
}

// Step 5: Build the User Prompt
function buildUserPrompt(notesContent, count) {
    return `
  You are generating study flashcards from course notes.
  
  TASK:
  - Generate EXACTLY ${count} SQR flashcards.
  - Use ONLY the information contained in the notes below.
  - If there is not enough information to generate all ${count} cards, generate as many as possible and then output the required ERROR message.
  
  CRITICAL RULES (DO NOT IGNORE):
  - Every card MUST include a REFERENCE that is a DIRECT QUOTE from the notes.
  - Do NOT invent facts, definitions, or explanations.
  - Expand all acronyms in the QUESTION field.
  - COMMON MISTAKE must sound like a real confused student quote.
  - Follow the exact SQR card format defined in the system prompt.
  
  NOTES (SOURCE OF TRUTH):
  <<<BEGIN NOTES>>>
  ${notesContent}
  <<<END NOTES>>>
  
  FINAL REMINDER:
  - Stay fully grounded in the notes.
  - Follow the exact card structure.
  - Output ONLY the flashcards (no extra text).
  `;
}
  
// Step 6: Make the API call
const client = new OpenAI({
    apiKey: apiKey, // already loaded via dotenv
    baseURL: "https://openrouter.ai/api/v1",
});
  
async function generateFlashcards(systemPrompt, userPrompt) {
    try {
      const completion = await client.chat.completions.create({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2, // LOW temperature to reduce hallucination
      });
  
      return completion.choices[0].message.content;
  
    } catch (err) {
      console.error("❌ Error calling OpenRouter API");
      console.error(err.message);
      process.exit(1);
    }
}

// Step 7: Extracting and Displaying the Output
function extractAndDisplayCards(output, count) {
    const cardRegex = /=== CARD \d+ ===.*?===/gs;
    const cards = output.match(cardRegex) || [];
  
    // Edge case: model returned no cards (empty notes / too little content)
    if (cards.length === 0) {
      // If the model already returned an ERROR line, show it; otherwise show our own
      const modelError = output.match(/^ERROR:.*$/m);
      if (modelError) {
        console.error(modelError[0]);
      } else {
        console.error("ERROR: Notes are empty or unreadable.");
      }
      process.exit(1);
    }
  
    console.log(`\n✅ Generated ${cards.length} flashcard(s):\n`);
    cards.forEach((card) => {
      console.log(card);
      console.log(); // blank line between cards
    });
  
    // Edge case: insufficient grounded concepts for requested count
    if (cards.length < count) {
      const remaining = count - cards.length;
  
      // Prefer model's own insufficiency message if present
      const modelInsufficient = output.match(
        /ERROR: Insufficient notes to generate the remaining cards \(need \d+ more\)\./
      );
  
      if (modelInsufficient) {
        console.error(modelInsufficient[0]);
      } else {
        console.error(
          `ERROR: Insufficient notes to generate the remaining cards (need ${remaining} more).`
        );
      }
    }
  }
  
  

async function main() {
    const systemPrompt = await getFileContents(
      "INSTRUCTIONS.md",
      "System prompt file"
    );
  
    const notesContent = await getFileContents(
      notesPath,
      "Notes file"
    );

    const userPrompt = buildUserPrompt(notesContent, count);
    const output = await generateFlashcards(systemPrompt, userPrompt);
    
    extractAndDisplayCards(output, count);
  }
  
  main();