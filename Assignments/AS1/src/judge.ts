// ============================================================
// judge.ts - Lead Developer synthesis (the "Judge")
// ============================================================

import OpenAI from "openai";
import { ReviewResult } from "./types.js";
import { log } from "./logger.js";
import { getClient } from "./client.js";

const MODEL = "openai/gpt-4o-mini";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

// --- Retry Logic ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callWithRetry(
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await getClient().chat.completions.create({
        model: MODEL,
        messages,
        temperature: 0.2,
      });

      return response.choices[0].message.content || "";
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      const isRetryable = status === 429 || (status >= 500 && status < 600);

      if (isRetryable && attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        log(
          `[Lead Developer] Rate limited (${status}). ` +
            `Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`
        );
        await sleep(delay);
        continue;
      }

      throw new Error(
        `[Lead Developer] API call failed after ${attempt + 1} attempts: ${error.message}`
      );
    }
  }

  throw new Error(`[Lead Developer] Exhausted all ${MAX_RETRIES} retry attempts.`);
}

// --- System Prompt ---

const leadDevSystemPrompt = `You are the "Lead Developer," an extremely experienced, pragmatic, and empathetic senior engineer. Your job is to review the findings from two code review assistants and produce a single, clean, actionable Markdown report for the developer.

## Your Responsibilities

1. **De-duplicate:** If both reviewers flagged the same issue, merge them into one entry. Do not repeat issues.
2. **Filter:** Remove any findings that appear to be hallucinated, inaccurate, or too minor/nitpicky to be worth mentioning. Only include issues that are real and actionable.
3. **Clarify:** If any finding is poorly worded or hard to understand, rewrite it clearly.
4. **Resolve Conflicts:** If the two reviewers disagree about something, use your judgment to decide the correct assessment.
5. **Format:** Produce a well-structured Markdown report.

## Output Format

Produce a Markdown report with this structure:

# Code Review Report

## Summary
A brief 2-3 sentence overview of the code quality and the most important findings.

## Critical Issues
Issues that must be fixed before merging. Use this format for each:
- **[File:Line]** — Description of the issue and how to fix it.

## Warnings  
Issues that should be addressed but are not blockers:
- **[File:Line]** — Description and recommendation.

## Suggestions
Minor improvements and best-practice recommendations:
- **[File:Line]** — Description and suggestion.

## Final Notes
A brief closing statement with overall recommendations.

---

If there are no issues in a category, omit that section entirely.
Be direct and actionable. Developers should be able to read your report and know exactly what to fix.
Do NOT invent new issues — only synthesize what the reviewers reported.`;

// --- Main Judge Function ---

/**
 * Takes the structured findings from both reviewers and sends them
 * to the Lead Developer LLM for synthesis into a final Markdown report.
 * The judge has NO tools — it only reads the reviewer outputs.
 */
export async function runJudge(
  review1: ReviewResult,
  review2: ReviewResult
): Promise<string> {
  log("[Lead Developer] Starting synthesis...");

  const userMessage = `Here are the findings from two code reviewers. Please synthesize them into a single Markdown report.

## Reviewer 1: ${review1.reviewer}
Findings:
${JSON.stringify(review1.findings, null, 2)}

## Reviewer 2: ${review2.reviewer}
Findings:
${JSON.stringify(review2.findings, null, 2)}`;

  log(`[Lead Developer] Sending ${review1.findings.length + review2.findings.length} total findings for synthesis`);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: leadDevSystemPrompt },
    { role: "user", content: userMessage },
  ];

  const report = await callWithRetry(messages);

  log(`[Lead Developer] Generated report (${report.length} chars)`);

  return report;
}