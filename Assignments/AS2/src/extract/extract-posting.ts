// src/extract/extract-posting.ts
// Extracts structured data from a single job posting PDF.
// Runs a tool-calling loop so the LLM can call web_search to research the company.

import { openai, MODELS } from '../shared/llm.js';
import { webSearchTool, runWebSearch } from '../shared/web-search.js';
import { JobPostingSchema, type JobPosting } from '../shared/schemas.js';
import { logger } from '../shared/logger.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';

const SYSTEM_PROMPT = `You are an expert job market analyst. You will receive the raw text of a job posting.

Your job:
1. Extract ALL structured fields from the posting. Use null or "not listed" when a field is absent — NEVER invent values.
2. Use the web_search tool to research the company. Search for: company size, industry, recent news, culture signals.
3. Once you have sufficient research, output ONLY a valid JSON object matching the schema. No markdown fences, no explanation.

Schema fields: title, company, location, remoteStatus, requiredSkills, preferredSkills, experienceYears, seniorityLevel, educationRequired, salaryRange (min/max/currency), keyResponsibilities, companyResearch (size/industry/recentNews/culture).

remoteStatus must be one of: "remote", "hybrid", "onsite", "not listed"
seniorityLevel must be one of: "junior", "mid", "senior", "lead", "not listed"`;

export async function extractPosting(rawText: string): Promise<JobPosting> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user',   content: `<job_posting>\n${rawText}\n</job_posting>` },
  ];

  // Tool-calling loop (max 5 iterations)
  for (let i = 0; i < 5; i++) {
    const response = await openai.chat.completions.create({
      model: MODELS.extract,
      messages,
      tools: [webSearchTool],
      tool_choice: 'auto',
    });

    const msg = response.choices[0].message;
    messages.push(msg as ChatCompletionMessageParam);

    // No tool calls → final answer
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const content = msg.content ?? '';
      logger.debug(`Parsing structured output (${content.length} chars)`);

      // Strip any accidental markdown fences
      const clean = content.replace(/```json\n?|```\n?/g, '').trim();
      const parsed = JSON.parse(clean);
      const validated = JobPostingSchema.parse(parsed);
      logger.debug(`Structured output validation: passed`);
      return validated;
    }

    // Execute each tool call
    for (const toolCall of msg.tool_calls) {
      if (toolCall.function.name === 'web_search') {
        const args = JSON.parse(toolCall.function.arguments) as { query: string };
        const result = await runWebSearch(args.query);
        messages.push({
          role:         'tool',
          tool_call_id: toolCall.id,
          content:      result,
        });
      }
    }
  }

  throw new Error('Extraction loop exceeded max iterations');
}