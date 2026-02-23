// ============================================================
// client.ts - Shared OpenRouter client (lazy initialization)
// ============================================================

import OpenAI from "openai";

let client: OpenAI | null = null;

/**
 * Returns the OpenAI client configured for OpenRouter.
 * Lazily initialized so it runs AFTER dotenv has loaded the API key.
 */
export function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return client;
}