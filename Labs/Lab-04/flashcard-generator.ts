import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { readFile } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

// Import your Zod schema
import { flashcardsResponseSchema, type FlashcardsResponse } from './schemas.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from parent directory
const envPath = resolve(__dirname, '..', '..', '.env');
dotenv.config({ path: envPath });

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error('ERROR: OPENROUTER_API_KEY not found in .env file');
  console.error('Looking at:', envPath);
  process.exit(1);
}

console.log('✅ API key loaded successfully');

/**
 * Generates flashcards from the provided notes using Structured Outputs.
 * @param notes - The raw text of the course notes
 * @param count - The number of cards to generate
 * @returns A Promise resolving to the structured flashcard data
 */
export async function generateFlashcards(
    notes: string,
    count: number
  ): Promise<FlashcardsResponse> {
    // 1. Load system prompt from INSTRUCTIONS.md
    const instructionsPath = join(__dirname, 'INSTRUCTIONS.md');
    const systemPrompt = await readFile(instructionsPath, 'utf-8');
  
    // 2. Initialize OpenAI client for OpenRouter
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  
    // 3. Call OpenAI with structured output
    const completion = await openai.chat.completions.create({
      model: 'openai/gpt-4o-2024-08-06',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Generate exactly ${count} flashcards from these course notes:\n\n${notes}`,
        },
      ],
      response_format: zodResponseFormat(flashcardsResponseSchema, 'flashcards'),
    });
  
    // 4. Extract and parse the response
    const messageContent = completion.choices[0]?.message?.content;
  
    if (!messageContent) {
      throw new Error('No response content received from the model');
    }
  
    // Parse the JSON response and validate against schema
    try {
      const parsedData = JSON.parse(messageContent);
      const validatedData = flashcardsResponseSchema.parse(parsedData);
      return validatedData;
    } catch (error) {
      console.error('Failed to parse response:', messageContent);
      throw new Error(`Failed to parse flashcards: ${error}`);
    }
}


 
