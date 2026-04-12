// src/shared/web-search.ts
// Tavily search tool — definition for OpenAI tool calling + executor.

import { fileURLToPath } from 'url';
import path from 'path';
import { config } from 'dotenv';
import { logger } from './logger.js';

// Resolve .env at monorepo root (4 levels up from src/shared/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '..', '..', '..', '..', '.env');
config({ path: envPath });

if (!process.env.TAVILY_API_KEY) {
  process.stderr.write('ERROR: TAVILY_API_KEY not found in .env file\n');
  process.stderr.write(`Looking at: ${envPath}\n`);
  process.exit(1);
}

// ─── Tool definition (OpenAI tools format) ───────────────────────────────────

export const webSearchTool = {
  type: 'function' as const,
  function: {
    name: 'web_search',
    description:
      'Search the web for company info, recent news, job market trends, or technical documentation.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
      },
      required: ['query'],
    },
  },
};

// ─── Executor ────────────────────────────────────────────────────────────────

interface TavilyResult {
  title:   string;
  url:     string;
  content: string;
  score:   number;
}

interface TavilyResponse {
  results: TavilyResult[];
}

export async function runWebSearch(query: string): Promise<string> {
  logger.debug(`Tool call: web_search("${query}")`);

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:        process.env.TAVILY_API_KEY,
      query,
      max_results:    5,
      search_depth:   'basic',
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`);
  }

  const data = (await response.json()) as TavilyResponse;
  logger.debug(`Search returned ${data.results.length} results`);

  // Serialize results into a compact string for the LLM
  return data.results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`)
    .join('\n\n---\n\n');
}