// src/analysis/gaps.ts
// Phase 2 entry point.
// Usage: npm run gaps -- path/to/resume.pdf [--verbose]
//
// 1. Extracts structured data from your resume
// 2. Compares against market-analysis.md from Phase 1
// 3. Produces a triaged gap analysis report

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractPdf } from '../shared/extract-pdf.js';
import { extractResume } from './extract-resume.js';
import { analyzeGaps } from './analyze-gaps.js';
import { generateGapReport } from './generate-gap-report.js';
import { logger } from '../shared/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');
const RESUME_DIR  = path.join(ROOT, 'data/resume');
const REPORTS_DIR = path.join(ROOT, 'reports');

async function main() {
  // ─── Parse args ────────────────────────────────────────────────────────────
  const args = process.argv.slice(2).filter((a) => a !== '--verbose');
  const resumePath = args[0];

  if (!resumePath) {
    process.stderr.write('Usage: npm run gaps -- path/to/resume.pdf [--verbose]\n');
    process.exit(1);
  }

  // Verify resume file exists
  try {
    await fs.access(resumePath);
  } catch {
    logger.error(`Resume file not found: ${resumePath}`);
    process.exit(1);
  }

  // Verify Phase 1 has been run
  const marketReportPath = path.join(REPORTS_DIR, 'market-analysis.md');
  let marketAnalysis: string;
  try {
    marketAnalysis = await fs.readFile(marketReportPath, 'utf-8');
  } catch {
    logger.error('market-analysis.md not found. Run Phase 1 first: npm run market');
    process.exit(1);
  }

  await fs.mkdir(RESUME_DIR,  { recursive: true });
  await fs.mkdir(REPORTS_DIR, { recursive: true });

  // ─── Extract resume ─────────────────────────────────────────────────────────
  logger.info('Extracting resume...');
  const resumeJsonPath = path.join(RESUME_DIR, 'resume.json');

  let resume;
  // Check if already extracted
  try {
    await fs.access(resumeJsonPath);
    logger.info('Resume already extracted — loading from data/resume/resume.json');
    resume = JSON.parse(await fs.readFile(resumeJsonPath, 'utf-8'));
  } catch {
    const rawText = await extractPdf(resumePath);
    resume = await extractResume(rawText);
    await fs.writeFile(resumeJsonPath, JSON.stringify(resume, null, 2), 'utf-8');
    logger.info('Saved → data/resume/resume.json');
  }

  // ─── Gap analysis ───────────────────────────────────────────────────────────
  logger.info('Analyzing gaps against market...');
  const gaps = await analyzeGaps(resume, marketAnalysis);

  // Save raw gap data
  const gapDataPath = path.join(RESUME_DIR, 'gaps.json');
  await fs.writeFile(gapDataPath, JSON.stringify(gaps, null, 2), 'utf-8');
  logger.debug('Saved raw gap data → data/resume/gaps.json');

  // ─── Generate report ────────────────────────────────────────────────────────
  logger.info('Generating gap analysis report...');
  const report = await generateGapReport(gaps, resume);

  const reportPath = path.join(REPORTS_DIR, 'gap-analysis.md');
  await fs.writeFile(reportPath, report, 'utf-8');

  process.stdout.write(`\n✅ Phase 2 complete.\n`);
  process.stdout.write(`   Strengths identified: ${gaps.strengths.length}\n`);
  process.stdout.write(`   Gaps found: ${gaps.gaps.length} (${gaps.gaps.filter(g => g.level === 'quick-win').length} quick wins)\n`);
  process.stdout.write(`   Report: reports/gap-analysis.md\n`);
}

main().catch((err) => {
  logger.error((err as Error).message);
  process.exit(1);
});