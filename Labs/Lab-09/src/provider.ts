import OpenAI from "openai";
import { OpenAIChatCompletionsModel } from "@openai/agents";
import type { ModelProvider, Model } from "@openai/agents-core";
import dotenv from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error("❌ Missing OPENROUTER_API_KEY in .env");
  process.exit(1);
}

const openrouterClient = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export class OpenRouterModelProvider implements ModelProvider {
  getModel(modelName: string): Model {
    return new OpenAIChatCompletionsModel(openrouterClient, modelName);
  }
}

export const MODEL = "anthropic/claude-haiku-4-5";