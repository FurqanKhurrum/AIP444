// src/analysis/analyze-gaps.ts
// Compares extracted resume against market analysis to produce a triaged gap report.

import { openai, MODELS } from '../shared/llm.js';
import { GapAnalysisSchema, type Resume, type GapAnalysis } from '../shared/schemas.js';
import { logger } from '../shared/logger.js';

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
  - quick-win: candidate likely has it but didn't list it, or it's just a wording change
  - short-term: can be addressed in days to 2 weeks (tutorial, small project, free cert)
  - medium-term: weeks to months (learn framework, build portfolio project)
  - long-term: years of experience required, degree needed, etc.
- action: SPECIFIC and actionable — not "learn AWS" but "get AWS Cloud Practitioner cert (free tier + ~20 hours)"

**Unique Value:** Things the candidate brings that aren't commonly listed in postings but could differentiate them.

## Output

Output ONLY a valid JSON object matching the schema. No markdown fences, no explanation.

Schema: { strengths: string[], gaps: [{skill, frequency, level, action}], uniqueValue: string[] }`;

export async function analyzeGaps(
  resume: Resume,
  marketAnalysis: string,
): Promise<GapAnalysis> {
  logger.debug('Running gap analysis...');

  const response = await openai.chat.completions.create({
    model: MODELS.analyze,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `<resume_data>\n${JSON.stringify(resume, null, 2)}\n</resume_data>\n\n<market_analysis>\n${marketAnalysis}\n</market_analysis>\n\nProduce the gap analysis.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? '';
  logger.debug(`Gap analysis response: ${content.length} chars`);

  const clean = content.replace(/```json\n?|```\n?/g, '').trim();
  const parsed = JSON.parse(clean);
  const validated = GapAnalysisSchema.parse(parsed);

  logger.debug(`Gap analysis: ${validated.strengths.length} strengths, ${validated.gaps.length} gaps`);
  return validated;
}