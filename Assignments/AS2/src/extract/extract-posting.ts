// src/extract/extract-posting.ts
import { openai, MODELS } from '../shared/llm.js';
import { webSearchTool, runWebSearch } from '../shared/web-search.js';
import { JobPostingSchema, type JobPosting } from '../shared/schemas.js';
import { logger } from '../shared/logger.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';

const SYSTEM_PROMPT = `Extract structured data from the job posting below.

Steps:
1. Read the posting carefully and extract every field listed in the schema.
2. Use the web_search tool to look up the company — find its size, industry, recent news, and culture signals.
3. Once research is complete, output ONLY a valid JSON object. No markdown fences, no explanation.

Field rules:
- Use null or "not listed" when a field is absent. Never invent values.
- remoteStatus: one of "remote", "hybrid", "onsite", "not listed"
- seniorityLevel: one of "junior", "mid", "senior", "lead", "not listed"
- experienceYears: a number (e.g. 3) or null — if the posting says "3-5 years" use 3
- salaryRange: extract min, max, currency if present, otherwise null

Schema fields: title, company, location, remoteStatus, requiredSkills, preferredSkills,
experienceYears, seniorityLevel, educationRequired, salaryRange (min/max/currency),
keyResponsibilities, companyResearch (size/industry/recentNews/culture).`;

export async function extractPosting(rawText: string): Promise<JobPosting> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user',   content: `<job_posting>\n${rawText}\n</job_posting>` },
  ];

  for (let i = 0; i < 5; i++) {
    logger.debug(`LLM call: ${MODELS.extract} (extraction loop iteration ${i + 1})`);

    const response = await openai.chat.completions.create({
      model: MODELS.extract,
      messages,
      tools: [webSearchTool],
      tool_choice: 'auto',
    });

    const msg = response.choices[0].message;
    logger.debug(`LLM tokens: ${response.usage?.total_tokens ?? 'unknown'}`);
    messages.push(msg as ChatCompletionMessageParam);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const content = msg.content ?? '';
      const clean = content.replace(/```json\n?|```\n?/g, '').trim();

      try {
        const parsed = JSON.parse(clean);
        const validated = JobPostingSchema.parse(parsed);

        // Detailed extraction decisions log
        logger.debug(`Extracted: "${validated.title}" @ ${validated.company}`);
        logger.debug(`Required skills: ${validated.requiredSkills.length}, Preferred: ${validated.preferredSkills.length}`);
        logger.debug(`Salary: ${validated.salaryRange.min ?? 'not found'} – ${validated.salaryRange.max ?? 'not found'} ${validated.salaryRange.currency ?? ''}`);
        logger.debug(`Experience: ${validated.experienceYears ?? 'not found'} yrs, Seniority: ${validated.seniorityLevel}`);
        logger.debug(`Remote status: ${validated.remoteStatus}`);
        logger.debug(`Structured output validation: passed`);

        return validated;
      } catch (err) {
        logger.debug(`Structured output validation: failed — ${(err as Error).message}`);
        throw err;
      }
    }

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