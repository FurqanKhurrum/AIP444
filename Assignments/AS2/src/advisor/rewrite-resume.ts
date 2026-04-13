// src/advisor/rewrite-resume.ts
// Extra 2: Resume Rewriter
// Produces rewritten resume sections tailored to a specific job posting,
// with a changelog explaining every change. Reframes and emphasizes — never fabricates.

import { chat, MODELS } from '../shared/llm.js';
import { logger } from '../shared/logger.js';
import type { Resume, JobPosting } from '../shared/schemas.js';

// Writing task — persona is appropriate here per PRISM research.
const SYSTEM_PROMPT = `You are a professional resume writer helping a candidate tailor their resume for a specific job posting.

Your task: rewrite the candidate's resume sections to better match the job posting requirements.

## Hard Rules (NEVER break these)
- Do NOT invent experience, skills, or achievements the candidate does not have
- Do NOT add tools, frameworks, or technologies not present in the original resume
- Do NOT change dates, company names, job titles, or institutions
- Only REORDER, REFRAME, and EMPHASIZE existing content
- If a required skill is genuinely missing, do NOT add it — leave it absent

## What you CAN do
- Move the most relevant skills to the top of the skills section
- Reword project descriptions to emphasize aspects relevant to this posting
- Add specificity to vague bullet points using only information already implied
  (e.g. "Built a REST API" → "Built a RESTful API with JWT authentication and rate limiting")
- Remove or de-emphasize skills/projects irrelevant to this role
- Adjust keyword density to improve ATS matching for this specific posting

## Output Format

Produce a Markdown document with this exact structure:

# Tailored Resume — [Job Title] at [Company]

## 📋 Rewritten Skills Section
[Skills reordered and grouped by relevance to this posting]

## 💼 Rewritten Projects Section  
[Each project reworded to emphasize aspects relevant to this posting]

## 🎓 Education Section
[Unchanged or minimally adjusted]

---

## 📝 Changelog

For every change made, include a line in this format:
| Section | Original | Rewritten | Reason |
|---------|----------|-----------|--------|

The changelog must account for EVERY meaningful change. If nothing changed in a section, note that explicitly.

---

## ⚠️ Gaps Not Addressed
List any required skills from the posting that are genuinely absent from the resume and could NOT be addressed through reframing. Be honest.`;

export async function rewriteResume(
  resume: Resume,
  posting: JobPosting,
): Promise<string> {
  logger.debug('Generating resume rewrite...');
  logger.debug(`LLM call: ${MODELS.advise} (resume rewriter)`);

  const userPrompt =
    `<job_posting>\n${JSON.stringify(posting, null, 2)}\n</job_posting>\n\n` +
    `<original_resume>\n${JSON.stringify(resume, null, 2)}\n</original_resume>\n\n` +
    `Rewrite the resume sections to target this specific posting. ` +
    `Remember: reframe and emphasize only. Do not fabricate anything. ` +
    `Every change must appear in the changelog with a reason.`;

  const result = await chat(MODELS.advise, SYSTEM_PROMPT, userPrompt);

  if (!result || result.trim().length === 0) {
    throw new Error('LLM returned empty resume rewrite');
  }

  logger.debug(`Resume rewrite generated (${result.length} chars)`);
  return result;
}