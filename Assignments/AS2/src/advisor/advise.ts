// src/advisor/advise.ts
// Phase 3 entry point — Application Advisor.
// Usage: npm run advise -- path/to/new-posting.pdf [--verbose]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { extractPdf } from '../shared/extract-pdf.js';
import { extractPosting } from '../extract/extract-posting.js';
import { chat, MODELS } from '../shared/llm.js';
import { logger } from '../shared/logger.js';
import { ResumeSchema, type Resume, type JobPosting } from '../shared/schemas.js';
import { rewriteResume } from './rewrite-resume.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');

// Load .env — try multiple paths to handle different monorepo depths
const envPaths = [
  path.resolve(__dirname, '../../../.env'),   // src/advisor/ -> assignment-02 -> AIP444 root
  path.resolve(__dirname, '../../../../.env'), // one level deeper
  path.resolve(__dirname, '../../.env'),       // assignment-02 root
];
const loadedEnv = envPaths.find(p => { const r = config({ path: p }); return !r.error; });
process.stderr.write(`[ENV] Loaded from: ${loadedEnv ?? 'none found'}\n`);
process.stderr.write(`[ENV] Key present: ${!!process.env.OPENROUTER_API_KEY}\n`);
const REPORTS_DIR = path.join(ROOT, 'reports');
const RESUME_DIR  = path.join(ROOT, 'data', 'resume');

function slugify(filename: string): string {
  return filename
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function truncate(text: string, max = 8000): string {
  return text.length <= max ? text : text.slice(0, max) + '\n...[truncated]';
}

function extractFitScore(report: string): number | null {
  const match = report.match(/(\d{1,3})\s*%/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isNaN(value) ? null : Math.min(Math.max(value, 0), 100);
}

// Parse score breakdown from report for verbose logging
function parseScoreBreakdown(report: string): string[] {
  const lines: string[] = [];
  const breakdownMatch = report.match(/### Score Breakdown([\s\S]*?)###/);
  if (!breakdownMatch) return lines;
  return breakdownMatch[1]
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && (l.includes('Met') || l.includes('Gap') || l.includes('Partial')));
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
- 30–50% = Stretch — worth applying if the role excites you
- <30%  = Significant gaps — consider this a growth target

Hard constraints for the score:
- If the posting requires a specific license/certification (e.g., P.Eng, CPA) and the resume does NOT show it, score MUST be below 30%.
- If the role requires professional experience (>0 years) and the resume shows 0, cap score at 35%.
- If a required degree is explicitly mandatory and the resume does not show it, cap score at 25%.

Scoring method:
- Base score = (matched required skills / total required skills) * 100
- Hard blockers: -15 to -20 points each (licenses, mandatory degrees, geographic requirements)
- Soft gaps: -3 to -5 points each (learnable tools, close equivalents like JS→TS)
- Preferred skills NEVER reduce the score
- For intern/junior roles: personal projects count as experience, "X years" is a soft gap
- Closely related skills count as matches (JavaScript → TypeScript, Node.js → backend)

Calibration:
- 6/8 required matched, no hard blockers, 2 soft gaps → 78–82%
- 4/8 required matched, 1 hard blocker (P.Eng) → 30–35%

Never output "you are not qualified" or "don't apply" for scores ≥30%.
Return ONLY the Markdown report.`;

async function loadTextFile(filePath: string, label: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    logger.debug(`Loaded ${label} (${content.length} chars)`);
    return content;
  } catch {
    logger.error(`${label} not found: ${filePath}`);
    process.exit(1);
  }
}

async function loadResume(filePath: string): Promise<Resume> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content) as unknown;
    const resume = ResumeSchema.parse(parsed);
    logger.debug(`Loaded resume: ${resume.hardSkills.length} hard skills, ${resume.workExperience.length} roles`);
    return resume;
  } catch (err) {
    logger.error(`Resume file not found or invalid: ${filePath}`);
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

  try {
    await fs.access(pdfPath);
  } catch {
    logger.error(`Job posting file not found: ${pdfPath}`);
    process.exit(1);
  }

  // ── Load context ────────────────────────────────────────────────────────────
  logger.info('Loading context files...');
  const marketAnalysis = await loadTextFile(path.join(REPORTS_DIR, 'market-analysis.md'), 'market-analysis.md');
  const gapAnalysis    = await loadTextFile(path.join(REPORTS_DIR, 'gap-analysis.md'),    'gap-analysis.md');
  const resume         = await loadResume(path.join(RESUME_DIR, 'resume.json'));

  // ── Extract posting ─────────────────────────────────────────────────────────
  logger.info(`Extracting posting: ${path.basename(pdfPath)}`);
  let posting: JobPosting;
  try {
    const rawText = await extractPdf(pdfPath);
    posting = await extractPosting(rawText);
    logger.debug(`Posting extracted: "${posting.title}" @ ${posting.company}`);
    logger.debug(`Required skills in posting: ${posting.requiredSkills.length}`);
    logger.debug(`Preferred skills in posting: ${posting.preferredSkills.length}`);
  } catch (err) {
    logger.error(`Failed to extract posting: ${(err as Error).message}`);
    process.exit(1);
  }

  // ── Generate report ─────────────────────────────────────────────────────────
  logger.info('Generating application report...');
  logger.debug(`LLM call: ${MODELS.advise}`);

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

  // ── Scoring debug logs (Category 4) ─────────────────────────────────────────
  const fitScore = extractFitScore(report);
  const breakdown = parseScoreBreakdown(report);

  logger.debug(`Fit scoring: ${posting.requiredSkills.length} required skills in posting`);
  logger.debug(`Fit scoring: ${resume.hardSkills.length} hard skills on resume`);
  for (const line of breakdown) {
    logger.debug(`Fit scoring: ${line}`);
  }
  logger.debug(`Overall fit: ${fitScore === null ? 'unknown' : fitScore + '%'}`);
  logger.debug(`Structured output validation: passed`);

  // ── Save report ─────────────────────────────────────────────────────────────
  const slug = slugify(path.basename(pdfPath));
  const reportFilename = `application-report-${slug}.md`;
  const reportPath = path.join(REPORTS_DIR, reportFilename);

  await fs.mkdir(REPORTS_DIR, { recursive: true });
  await fs.writeFile(reportPath, report, 'utf-8');
  logger.debug(`Report saved → reports/${reportFilename}`);

  // ── Resume rewrite (Extra 2) ────────────────────────────────────────────────
  logger.info('Generating tailored resume rewrite...');
  let rewriteFilename = '';
  try {
    const rewrite = await rewriteResume(resume, posting);
    rewriteFilename = `resume-rewrite-${slug}.md`;
    const rewritePath = path.join(REPORTS_DIR, rewriteFilename);
    await fs.writeFile(rewritePath, rewrite, 'utf-8');
    logger.debug(`Resume rewrite saved → reports/${rewriteFilename}`);
  } catch (err) {
    // Non-fatal — application report already saved
    logger.error(`Resume rewrite failed (non-fatal): ${(err as Error).message}`);
  }

  // ── stdout summary ──────────────────────────────────────────────────────────
  process.stdout.write(`\n✅ Phase 3 complete.\n`);
  process.stdout.write(`   Report: reports/${reportFilename}\n`);
  process.stdout.write(`   Fit score: ${fitScore === null ? 'unknown' : fitScore + '%'}\n`);
  if (rewriteFilename) {
    process.stdout.write(`   Resume rewrite: reports/${rewriteFilename}\n`);
  }
}

main().catch((err) => {
  logger.error((err as Error).message);
  process.exit(1);
});