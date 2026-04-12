// src/shared/llm.ts
// Central OpenRouter client. All LLM calls go through here.

import OpenAI from 'openai';
import { fileURLToPath } from 'url';
import path from 'path';
import { config } from 'dotenv';
import { logger } from './logger.js';

// Resolve .env at monorepo root (4 levels up from src/shared/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '..', '..', '..', '..', '.env');
config({ path: envPath });

if (!process.env.OPENROUTER_API_KEY) {
  process.stderr.write('ERROR: OPENROUTER_API_KEY not found in .env file\n');
  process.stderr.write(`Looking at: ${envPath}\n`);
  process.exit(1);
}

export const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});


export const MODELS = {
    extract: 'google/gemini-2.0-flash-001',
    analyze: 'google/gemini-2.0-flash-001',
    advise:  'google/gemini-2.0-flash-001',
  } as const;

export async function chat(model: string, system: string, user: string): Promise<string> {
    logger.debug(`LLM call: ${model}`);
    const res = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
    });
    const text = res.choices[0]?.message?.content ?? '';
    logger.debug(`LLM tokens: ${res.usage?.total_tokens ?? 'unknown'}`);
    return text;
  }