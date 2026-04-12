// src/analysis/extract-resume.ts
// Extracts structured data from a resume PDF using Zod-validated structured output.

import { openai, MODELS } from '../shared/llm.js';
import { ResumeSchema, type Resume } from '../shared/schemas.js';
import { logger } from '../shared/logger.js';

const SYSTEM_PROMPT = `You are an expert resume analyst and ATS (Applicant Tracking System) specialist.

You will receive the raw text of a resume. Extract ALL information into the structured JSON schema below.

Rules:
- hardSkills: Programming languages, frameworks, tools, platforms (e.g. "TypeScript", "React", "AWS", "Docker")
- softSkills: Communication, leadership, collaboration, etc. Only include if explicitly stated or clearly implied.
- workExperience: Every role listed. durationYears should be a number (e.g. 1.5), or null if unclear.
- keywords: Industry-specific terminology and methodologies (e.g. "Agile", "CI/CD", "REST API", "microservices")
- NEVER invent information. If a field has no data, use an empty array or null.
- Output ONLY a valid JSON object. No markdown fences, no explanation.`;

export async function extractResume(rawText: string): Promise<Resume> {
  logger.debug(`Extracting resume (${rawText.length} chars)`);

  const response = await openai.chat.completions.create({
    model: MODELS.extract,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: `<resume>\n${rawText}\n</resume>\n\nExtract the structured resume data.` },
    ],
  });

  const content = response.choices[0]?.message?.content ?? '';
  logger.debug(`Resume extraction response: ${content.length} chars`);

  const clean = content.replace(/```json\n?|```\n?/g, '').trim();
  const parsed = JSON.parse(clean);
  const validated = ResumeSchema.parse(parsed);

  logger.debug(`Extracted ${validated.hardSkills.length} hard skills, ${validated.workExperience.length} roles`);
  return validated;
}