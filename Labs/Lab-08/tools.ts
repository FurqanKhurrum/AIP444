import { z } from "zod";
import { tavily } from "@tavily/core";
import * as dotenv from "dotenv";

import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "..", "..", ".env");
dotenv.config({ path: envPath });

// Zod schema for the tool parameters
export const WebSearchSchema = z.object({
  query: z.string().describe("The search query based on the error in the screenshot"),
});

// Tool definition in OpenAI format for the API call
export const tools = [
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description:
        "Searches the web for technical documentation, coding errors, and other details to help with debugging.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to use based on the screenshot",
          },
        },
        required: ["query"],
      },
    },
  },
];

// Actually executes the Tavily search when the model calls the tool
export async function executeTool(
  toolName: string,
  toolArgs: unknown
): Promise<string> {
  if (toolName !== "web_search") {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const parsed = WebSearchSchema.parse(toolArgs);

  console.error(`[Tool Call] web_search → "${parsed.query}"`);

  const client = tavily({ apiKey: process.env.TAVILY_API_KEY! });

  const response = await client.search(parsed.query, {
    maxResults: 5,
    searchDepth: "advanced",
  });

  // Format results into a readable string for the model
  const formatted = response.results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`)
    .join("\n\n");

  console.error(`[Tool Result] ${response.results.length} results found`);

  return formatted;
}