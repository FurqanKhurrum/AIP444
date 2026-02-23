// ============================================================
// reviewers.ts - Reviewer logic with tool-calling loop
// ============================================================

import OpenAI from "openai";
import { toolDefinitions, ReviewResult, ReviewFinding } from "./types.js";
import { executeTool } from "./tools.js";
import { log } from "./logger.js";
import { getClient } from "./client.js";

// --- Configuration ---

export const DEFAULT_MODEL = "openai/gpt-4o-mini";
const MAX_TOOL_ROUNDS = 10; // Prevent infinite tool-calling loops
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

// --- Retry Logic ---

/**
 * Delays execution for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps an OpenRouter API call with exponential backoff retry logic.
 * Handles 429 (rate limit) and 5xx (server error) responses.
 */
async function callWithRetry(
  reviewerName: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  temperature: number,
  model: string = DEFAULT_MODEL
): Promise<OpenAI.Chat.ChatCompletionMessage> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await getClient().chat.completions.create({
        model,
        messages,
        tools: toolDefinitions,
        tool_choice: "auto",
        temperature,
      });

      if (!response.choices || !response.choices[0]?.message) {
        throw new Error("Empty response from API (no choices returned)");
      }

      return response.choices[0].message;
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      const isRetryable = status === 429 || (status >= 500 && status < 600);

      if (isRetryable && attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        log(
          `[${reviewerName}] Rate limited or server error (${status}). ` +
          `Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`
        );
        await sleep(delay);
        continue;
      }

      throw new Error(
        `[${reviewerName}] API call failed after ${attempt + 1} attempts: ${error.message}`
      );
    }
  }

  throw new Error(`[${reviewerName}] Exhausted all ${MAX_RETRIES} retry attempts.`);
}

// --- JSON Extraction ---

/**
 * Extracts a JSON array from the LLM's text response.
 * Handles cases where the model wraps JSON in markdown code fences.
 */
function extractFindings(text: string): ReviewFinding[] {
  // Try to find JSON within code fences first
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonString = fenceMatch ? fenceMatch[1].trim() : text.trim();

  try {
    const parsed = JSON.parse(jsonString);

    // Handle both a raw array and an object with a "findings" key
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed.findings && Array.isArray(parsed.findings)) {
      return parsed.findings;
    }

    log(`Warning: Parsed JSON is not an array or {findings: []}. Wrapping in array.`);
    return [parsed];
  } catch (error: any) {
    log(`Warning: Failed to parse JSON from LLM response. Raw text:\n${text}`);
    return [];
  }
}

// --- Main Reviewer Runner ---

/**
 * Runs a single reviewer through the tool-calling loop.
 *
 * 1. Sends the system prompt + code input to the LLM
 * 2. If the LLM requests tool calls, executes them and feeds results back
 * 3. Repeats until the LLM returns a final text response (or hits the round limit)
 * 4. Parses the structured JSON findings from the response
 */
export async function runReviewer(
  reviewerName: string,
  systemPrompt: string,
  codeInput: string,
  model: string = DEFAULT_MODEL
): Promise<ReviewResult> {
  log(`[${reviewerName}] Starting review (model: ${model})...`);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: codeInput },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    log(`[${reviewerName}] Round ${round + 1}...`);

    // Determine temperature: Security Auditor = low, Maintainability Critic = slightly higher
    const temperature = reviewerName === "Security Auditor" ? 0.1 : 0.3;

    const message = await callWithRetry(reviewerName, messages, temperature, model);

    // Check if the model wants to call tools
    if (message.tool_calls && message.tool_calls.length > 0) {
      log(`[${reviewerName}] Model requested ${message.tool_calls.length} tool call(s)`);

      // Add the assistant's message (with tool_calls) to the conversation
      messages.push(message);

      // Execute each tool call and add the results
      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== "function") continue;
        const toolName = toolCall.function.name;
        const toolArgs = toolCall.function.arguments;

        log(`[${reviewerName}] Calling ${toolName}(${toolArgs})`);

        const result = executeTool(toolName, toolArgs);

        log(
          `[${reviewerName}] ${toolName} returned: ${result.substring(0, 300)}` +
          (result.length > 300 ? "..." : "")
        );

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Continue the loop — send tool results back to the LLM
      continue;
    }

    // No tool calls — this is the final response
    const responseText = message.content || "";
    log(`[${reviewerName}] Received final response (${responseText.length} chars)`);

    const findings = extractFindings(responseText);
    log(`[${reviewerName}] Parsed ${findings.length} findings`);

    return {
      reviewer: reviewerName,
      findings,
    };
  }

  // If we exhausted all rounds, return whatever we have
  log(`[${reviewerName}] Warning: Hit max tool rounds (${MAX_TOOL_ROUNDS}). Returning empty.`);
  return {
    reviewer: reviewerName,
    findings: [],
  };
}