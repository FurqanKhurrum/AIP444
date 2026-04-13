// src/analysis/extract-resume.ts
 
import { openai, MODELS } from '../shared/llm.js';
import { ResumeSchema, type Resume } from '../shared/schemas.js';
import { logger } from '../shared/logger.js';

// No persona — factual extraction task.
// Per PRISM research: expert personas hurt accuracy on pretraining-dependent tasks.
const NEW_SYSTEM_PROMPT = `Extract structured data from the resume below.

Rules:
- hardSkills: programming languages, frameworks, tools, platforms
- softSkills: only include if explicitly stated or clearly implied
- workExperience: every role listed; durationYears as a number or null
- keywords: industry terminology and methodologies (Agile, CI/CD, REST API, etc.)
- Never invent information. Use empty arrays or null when data is absent.

Output ONLY a valid JSON object matching the schema. No markdown fences, no explanation.`;


// original system prompt
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
  logger.debug(`Extracting resume (${rawText.length} chars of text)`);
  logger.debug(`LLM call: ${MODELS.extract}`);
 
  // Log first 300 chars so we can see what the vision extractor returned
  logger.debug(`Resume text preview: ${rawText.slice(0, 300).replace(/\n/g, ' ')}`);
 
  const response = await openai.chat.completions.create({
    model: MODELS.extract,
    messages: [
      { role: 'system', content: NEW_SYSTEM_PROMPT },
      { role: 'user',   content: `<resume>\n${rawText}\n</resume>\n\nExtract all fields. Pay special attention to the projects section — look for named applications or systems the candidate built.` },
    ],
  });
 
  const content = response.choices[0]?.message?.content ?? '';
  logger.debug(`LLM tokens: ${response.usage?.total_tokens ?? 'unknown'}`);
 
  const clean = content.replace(/```json\n?|```\n?/g, '').trim();
 
  try {
    const parsed = JSON.parse(clean);
    const validated = ResumeSchema.parse(parsed);
 
    logger.debug(`Extracted ${validated.hardSkills.length} hard skills, ${validated.softSkills.length} soft skills`);
    logger.debug(`Work experience: ${validated.workExperience.length} roles`);
    logger.debug(`Projects: ${validated.projects.length}`);
    logger.debug(`Keywords: ${validated.keywords.length}`);
    logger.debug(`Structured output validation: passed`);
 
    // Warn if projects still empty — likely a text extraction issue
    if (validated.projects.length === 0) {
      logger.debug('WARNING: No projects extracted — check raw resume text for project content');
    }
 
    return validated;
  } catch (err) {
    logger.debug(`Structured output validation: failed — ${(err as Error).message}`);
    throw err;
  }
}