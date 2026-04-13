// src/analysis/analyze-gaps.ts

import { openai, MODELS } from '../shared/llm.js';
import { GapAnalysisSchema, type Resume, type GapAnalysis } from '../shared/schemas.js';
import { logger } from '../shared/logger.js';

const NEW_SYSTEM_PROMPT = `Compare the candidate's resume against the job market analysis and identify gaps.

You MUST return a JSON object with exactly these three keys:
- "strengths": array of strings describing what the candidate already has that employers want
- "gaps": array of objects, each with: skill, frequency, level, action
- "uniqueValue": array of strings describing what makes this candidate stand out

## Critical rules for "level" classification

The level field describes HOW HARD the gap is to close — not how easy the workaround is.
Use this rubric strictly:

- "quick-win": candidate likely already has this skill but didn't list it on their resume,
  OR it's just a terminology mismatch (e.g. they have JS but didn't write TypeScript explicitly)
- "short-term": can genuinely be closed in days to 2 weeks
  (e.g. a free online tutorial, one certification exam with ~20 hrs of study)
- "medium-term": requires weeks to months of consistent effort
  (e.g. learning a new framework, building a portfolio project in an unfamiliar language)
- "long-term": requires structural change over months to years
  (e.g. years of professional work experience, a university degree, a major certification)

COMMON MISTAKES TO AVOID:
- Do NOT classify "years of professional experience" as short-term. It is always long-term.
- Do NOT classify a university degree as short-term. It is always long-term.
- Do NOT classify learning a new programming language as short-term. It is medium-term at minimum.
- "Showcasing projects" is a workaround, not a solution — classify the underlying gap honestly.

## Rules for "action" field

Actions must be SPECIFIC and ACTIONABLE — never vague.

BAD:  "Learn the basics of TypeScript"
GOOD: "Complete the free TypeScript handbook at typescriptlang.org (~8 hrs) and convert one existing JS project to TS"

BAD:  "Get more experience"
GOOD: "Build 2-3 portfolio projects that demonstrate this skill and add them to your GitHub"

BAD:  "Consider completing a bachelor's degree"
GOOD: "Long-term: Seneca's degree completion pathway or Athabasca University's online CS degree are options — or prioritize roles that accept diplomas + experience"

## Rules for "frequency"

frequency is the number of job postings (out of the total analyzed) that mention this skill.
Use the market analysis data to estimate this accurately. Do not guess randomly.

## Output format

Output ONLY the JSON object. No markdown fences, no explanation.`;

// original system prompt
const SYSTEM_PROMPT = `You are a senior career coach and technical recruiter with 15+ years of experience.

You will receive:
1. A candidate's extracted resume data (JSON)
2. A market analysis report summarizing what employers are looking for

Your task: produce a rigorous, specific gap analysis.

## Rules

**Strengths:** Skills the candidate clearly has that appear frequently in the market analysis. Be specific — "5 years of TypeScript experience" is better than "knows TypeScript".

**Gaps:** Skills that appear frequently in job postings but are missing or underrepresented in the resume. For each gap you MUST provide:
- skill: the specific skill/technology
- frequency: how many postings (out of the total) mention it (estimate if needed)
- level: one of "quick-win", "short-term", "medium-term", "long-term"
- action: SPECIFIC and actionable — not "learn AWS" but "get AWS Cloud Practitioner cert (free tier + ~20 hours)"

**Unique Value:** Things the candidate brings that aren't commonly listed in postings but could differentiate them.

## Output

Output ONLY a valid JSON object matching the schema. No markdown fences, no explanation.`;

export async function analyzeGaps(resume: Resume, marketAnalysis: string): Promise<GapAnalysis> {
  logger.debug('Running gap analysis...');

  const truncatedMarket = marketAnalysis.length > 8000
    ? marketAnalysis.slice(0, 8000) + '\n...[truncated]'
    : marketAnalysis;

  const userContent =
    `<resume_data>\n${JSON.stringify(resume, null, 2)}\n</resume_data>\n\n` +
    `<market_analysis>\n${truncatedMarket}\n</market_analysis>\n\n` +
    `Produce the gap analysis JSON. Remember: classify gaps by how hard they genuinely are to close, ` +
    `not by how easy the workaround is. Be specific in every action item.`;

  const response = await openai.chat.completions.create({
    model: MODELS.analyze,
    messages: [
      { role: 'system', content: NEW_SYSTEM_PROMPT },
      { role: 'user',   content: userContent },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? '';
  logger.debug(`Raw gap analysis response length: ${raw.length}`);

  if (!raw || raw.trim().length === 0) {
    throw new Error('LLM returned empty response for gap analysis');
  }

  const clean = raw.replace(/```json\n?|```\n?/g, '').trim();
  const parsed = JSON.parse(clean);

  if (!parsed.strengths?.length) logger.debug('Warning: LLM returned empty strengths');
  if (!parsed.gaps?.length)     logger.debug('Warning: LLM returned empty gaps');

  const validated = GapAnalysisSchema.parse(parsed);
  logger.debug(`${validated.strengths.length} strengths, ${validated.gaps.length} gaps found`);
  return validated;
}