// src/shared/llm.ts
import OpenAI from 'openai';
import { fileURLToPath } from 'url';
import path from 'path';
import { config } from 'dotenv';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../../.env') });

if (!process.env.OPENROUTER_API_KEY) {
  process.stderr.write('❌ Error: OPENROUTER_API_KEY not found\n');
  process.exit(1);
}

export const openai = new OpenAI({
  apiKey:  process.env.OPENROUTER_API_KEY,
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
  const tokens = res.usage?.total_tokens ?? 'unknown';
  const text = res.choices[0]?.message?.content ?? '';
  logger.debug(`LLM tokens: ${tokens}, response length: ${text.length} chars`);
  return text;
}