// src/advisor/advise.ts
// Phase 3 entry point — Application Advisor.
// Usage: npm run advise -- path/to/new-posting.pdf [--verbose]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractPdf } from '../shared/extract-pdf.js';
import { extractPosting } from '../extract/extract-posting.js';
import { chat, MODELS } from '../shared/llm.js';
import { logger } from '../shared/logger.js';
import { ResumeSchema, type Resume, type JobPosting } from '../shared/schemas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');
const REPORTS_DIR = path.join(ROOT, 'reports');
const RESUME_DIR = path.join(ROOT, 'data', 'resume');

function slugify(filename: string): string {
  return filename
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function truncate(text: string, max = 8000): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\n...[truncated]';
}

function extractFitScore(report: string): number | null {
  const match = report.match(/(\d{1,3})\s*%/);
  if (!match) return null;
  const value = Number(match[1]);
  if (Number.isNaN(value)) return null;
  return Math.min(Math.max(value, 0), 100);
}

const ADVISE_SYSTEM = `You are an expert career coach and recruiter. Your task is to produce an application report for a specific job.

You MUST follow this exact 4-section Markdown structure and headings (no extra sections):

# Application Report: [Job Title] at [Company]

## 1. Fit Assessment
Fit Score: [NN%] — [Label]

### Score Breakdown
[Table or list: requirement → met/gap/partial]

### Recommendation
[Encouraging text. NEVER say "don't apply" for scores above 30%]

---

## 2. Resume Adaptation
[Specific, concrete changes — not generic advice]

---

## 3. Cover Letter Guidance
[Key points for THIS specific role and company]

---

## 4. Interview Prep
### Likely Questions
### Topics to Brush Up On
### Company Research Points
### Talking Points (connecting your experience to their needs)

Fit scoring rules (bias toward encouraging applications but still realistic):
- 80%+  = Strong fit — definitely apply
- 50–79% = Good fit — apply and highlight your strengths
- 30–50% = Stretch — worth applying if the role excites you, and explain how to position the candidate
- <30%  = Significant gaps — consider this a growth target rather than an immediate application

Hard constraints for the score:
- If the posting requires a specific license/certification/credential (e.g., RN license, board certification, security clearance) and the resume does NOT show it, the score MUST be below 30%.
- If the role is senior/lead or requires professional experience years (>0), and the resume shows 0 professional experience years in relevant roles, cap the score at 35%.
- If a required degree is explicitly mandatory and the resume does not show it, cap the score at 25%.
- Do not inflate scores for unrelated domains (e.g., nursing vs. SWE). Missing domain-required credentials or experience must heavily reduce the score.

Scoring method (explicit rubric):
- Identify REQUIRED skills/credentials/experiences. Count how many are matched by the candidate (including closely related skills).
- Base score = (matched required / total required) * 100. Round to nearest whole percent.
- Adjust up (typically +5 to +15) if the candidate exceeds experience requirements.
- Adjust up (typically +5 to +10) if the candidate has most preferred skills, but preferred skills NEVER reduce the score.
- Apply gap weighting:
  - Hard blockers (reduce score significantly, -15 to -20 points each):
    - Professional license/certification legally required for the role (P.Eng, CPA, bar exam)
    - Specific degree legally or contractually required (not just preferred)
    - Geographic requirement the candidate cannot meet
  - Soft gaps (reduce score minimally, -3 to -5 points each):
    - Missing a specific technology when the candidate has a close equivalent (e.g., TypeScript vs JavaScript, Kotlin vs Java)
    - Missing a tool that can be learned in days to weeks
    - Preferred/nice-to-have skills should not reduce the score at all
- If a required item is partially met, count it as matched rather than missing unless it is a hard blocker.
- For intern/junior roles:
  - Personal and academic projects count as real experience
  - "X years of experience" requirements are soft gaps, not hard blockers
  - Enthusiasm and learning ability are explicitly valued by hiring managers
- Closely related skills count as matches (e.g., JavaScript counts toward TypeScript, Node.js counts toward backend experience).
- Document the key missing REQUIRED requirements in the Score Breakdown.

Calibration example (for internal guidance):
- Posting has 8 REQUIRED skills. Candidate matches 6, has no hard blockers, and has 2 soft gaps.
- Base score = 75. Apply two soft gaps (-3 to -5 each) → final score 78–82.
- Posting has 8 REQUIRED skills. Candidate matches 4 and has 1 hard blocker (P.Eng required).
- Base score = 50. Apply one hard blocker (-15 to -20) → final score 30–35.

Never output "you are not qualified" or "don't apply" for scores ≥30%.
Return ONLY the Markdown report.`;

async function loadTextFile(filePath: string, label: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    logger.debug(`Loaded ${label}: ${filePath}`);
    return content;
  } catch {
    logger.error(`${label} not found: ${filePath}`);
    process.exit(1);
  }
}

async function loadResume(filePath: string): Promise<Resume> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    logger.debug(`Loaded resume: ${filePath}`);
    const parsed = JSON.parse(content) as unknown;
    return ResumeSchema.parse(parsed);
  } catch (err) {
    logger.error(`Resume file not found or invalid JSON: ${filePath}`);
    logger.error((err as Error).message);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--verbose' && a !== '--');
  const pdfPath = args[0];

  if (!pdfPath) {
    process.stderr.write('Usage: npm run advise -- path/to/new-posting.pdf [--verbose]\n');
    process.exit(1);
  }

  // Verify PDF exists
  try {
    await fs.access(pdfPath);
  } catch {
    logger.error(`Job posting file not found: ${pdfPath}`);
    process.exit(1);
  }

  // Load context files
  const marketReportPath = path.join(REPORTS_DIR, 'market-analysis.md');
  const gapReportPath = path.join(REPORTS_DIR, 'gap-analysis.md');
  const resumePath = path.join(RESUME_DIR, 'resume.json');

  logger.info('Loading context files...');
  const marketAnalysis = await loadTextFile(marketReportPath, 'market-analysis.md');
  const gapAnalysis = await loadTextFile(gapReportPath, 'gap-analysis.md');
  const resume = await loadResume(resumePath);

  // Extract new posting
  logger.info('Extracting new job posting...');
  let posting: JobPosting;
  try {
    const rawText = await extractPdf(pdfPath);
    posting = await extractPosting(rawText);
  } catch (err) {
    logger.error(`Failed to extract posting: ${(err as Error).message}`);
    process.exit(1);
  }

  // Generate report
  logger.info('Generating application report...');
  const userPrompt =
    `<job_posting>\n${JSON.stringify(posting, null, 2)}\n</job_posting>\n\n` +
    `<resume_json>\n${JSON.stringify(resume, null, 2)}\n</resume_json>\n\n` +
    `<market_analysis>\n${truncate(marketAnalysis)}\n</market_analysis>\n\n` +
    `<gap_analysis_report>\n${truncate(gapAnalysis)}\n</gap_analysis_report>\n\n` +
    `Generate the application report now.`;

  let report: string;
  try {
    report = await chat(MODELS.advise, ADVISE_SYSTEM, userPrompt);
  } catch (err) {
    logger.error(`LLM call failed: ${(err as Error).message}`);
    process.exit(1);
  }

  if (!report || report.trim().length === 0) {
    logger.error('LLM returned empty report');
    process.exit(1);
  }

  const fitScore = extractFitScore(report);
  if (fitScore === null) {
    logger.error('Could not parse fit score from report');
  } else {
    logger.debug(`Fit score computed: ${fitScore}%`);
  }

  // Save report
  const slug = slugify(path.basename(pdfPath));
  const reportFilename = `application-report-${slug}.md`;
  const reportPath = path.join(REPORTS_DIR, reportFilename);

  await fs.mkdir(REPORTS_DIR, { recursive: true });
  await fs.writeFile(reportPath, report, 'utf-8');
  logger.debug(`Report path saved: ${reportPath}`);

  // Print summary
  process.stdout.write(`\n✅ Phase 3 complete.\n`);
  process.stdout.write(`Report: reports/${reportFilename}\n`);
  process.stdout.write(`Fit score: ${fitScore === null ? 'unknown' : fitScore + '%'}\n`);
}

main().catch((err) => {
  logger.error((err as Error).message);
  process.exit(1);
});
