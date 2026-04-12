// src/analysis/generate-gap-report.ts
// Converts the structured GapAnalysis into a readable Markdown report.

import { chat, MODELS } from '../shared/llm.js';
import { logger } from '../shared/logger.js';
import type { GapAnalysis, Resume } from '../shared/schemas.js';

const SYSTEM_PROMPT = `You are a career coach writing a gap analysis report for a job seeker.

You will receive structured gap analysis data. Convert it into a clear, motivating, and actionable Markdown report.

Format:
# Resume Gap Analysis Report

## ✅ Your Strengths
(List each strength as a bullet. Be specific and confident.)

## 🎯 Skill Gaps (Triaged by Effort)

### ⚡ Quick Wins (Days)
(Gaps the candidate can address immediately — wording changes, skills they have but didn't list)

### 📅 Short-Term (Days to 2 Weeks)
(Tutorials, small projects, free certifications)

### 🔧 Medium-Term (Weeks to Months)
(Learning new frameworks, building portfolio projects)

### 🏗️ Long-Term (Months to Years)
(Degrees, certifications requiring significant study, years of experience)

For each gap include the action item on the same line.

## 💎 Your Unique Value
(Things that differentiate you from other candidates)

## 📋 Recommended Priority Order
(Top 5 things to tackle first, with brief rationale)

Keep the tone encouraging and practical. This person is actively job searching.`;

export async function generateGapReport(
  gaps: GapAnalysis,
  resume: Resume,
): Promise<string> {
  logger.debug('Generating gap report...');

  const report = await chat(
    MODELS.analyze,
    SYSTEM_PROMPT,
    `<gap_analysis>\n${JSON.stringify(gaps, null, 2)}\n</gap_analysis>\n\n<candidate_name>${resume.workExperience[0]?.company ?? 'Candidate'}</candidate_name>\n\nGenerate the gap analysis report.`,
  );

  return report;
}