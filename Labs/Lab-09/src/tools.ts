import { tool } from "@openai/agents";
import { tavily } from "@tavily/core";
import { writeFile, mkdir } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { CredibilityEvaluationSchema } from "./types.js";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
if (!TAVILY_API_KEY) {
  console.error("❌ Missing TAVILY_API_KEY in .env");
  process.exit(1);
}

const tavilyClient = tavily({ apiKey: TAVILY_API_KEY });

// ── Tool 1: Read URL ──────────────────────────────────────────────────────────
export const readUrlTool = tool({
  name: "read_url",
  description:
    "Fetches a webpage and returns its content as Markdown. Use this to read the source being evaluated, author bios, About pages, and editorial policies.",
  parameters: z.object({
    url: z.string().describe("The URL to fetch and read"),
  }),
  execute: async ({ url }) => {
    try {
      console.error(`🔍 Reading URL: ${url}`);
      const response = await fetch(`https://r.jina.ai/${url}`);
      if (!response.ok) {
        return `Error fetching URL: ${response.status} ${response.statusText}`;
      }
      const text = await response.text();
      return text.slice(0, 10000);
    } catch (err) {
      return `Failed to read URL: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

// ── Tool 2: Web Search ────────────────────────────────────────────────────────
export const webSearchTool = tool({
  name: "web_search",
  description:
    "Searches the web for information. Use this to investigate authors, publication reputation, verify claims, find corroborating sources, or look for fact-checks.",
  parameters: z.object({
    query: z.string().describe("The search query"),
  }),
  execute: async ({ query }) => {
    try {
      console.error(`🔎 Searching: ${query}`);
      const results = await tavilyClient.search(query, {
        maxResults: 5,
      });
      return results.results
        .map((r) => `[${r.title}](${r.url})\n${r.content}`)
        .join("\n\n---\n\n");
    } catch (err) {
      return `Search failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

// ── Tool 3: Evaluate Credibility (Think Tool) ─────────────────────────────────
export const evaluateCredibilityTool = tool({
  name: "evaluate_credibility",
  description:
    "Record a structured credibility evaluation after completing your investigation. Call this BEFORE writing the final report. Every field must be based on evidence you actually found — do not guess or hallucinate.",
  parameters: CredibilityEvaluationSchema,
  execute: async (evaluation) => {
    console.error(`📋 Credibility evaluation recorded for: ${evaluation.source_url}`);
    return {
      status: "evaluation_recorded",
      evaluation,
    };
  },
});

// ── Tool 4: Write File ────────────────────────────────────────────────────────
export const writeFileTool = tool({
  name: "write_file",
  description:
    "Writes the final credibility report as a Markdown file to the reports/ folder.",
  parameters: z.object({
    filename: z
      .string()
      .describe(
        "The filename for the report, e.g. 'bbc-article-report.md'. Must end in .md"
      ),
    content: z.string().describe("The full Markdown content of the report"),
  }),
  execute: async ({ filename, content }) => {
    try {
      const reportsDir = resolve(__dirname, "../reports");
      await mkdir(reportsDir, { recursive: true });
      const filepath = resolve(reportsDir, filename);
      await writeFile(filepath, content, "utf-8");
      console.error(`✅ Report written to: reports/${filename}`);
      return `Report successfully written to reports/${filename}`;
    } catch (err) {
      return `Failed to write file: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});