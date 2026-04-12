// src/extract/market.ts
// Phase 1 entry point.
// Usage: pnpm market  (or tsx src/extract/market.ts [--verbose])
//
// 1. Reads PDFs from data/raw-postings/
// 2. Skips already-extracted postings (checks data/jobs/)
// 3. Extracts structured data + company research for each
// 4. Generates market-analysis.md from all extracted postings

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractPdf } from '../shared/extract-pdf.js';
import { extractPosting } from './extract-posting.js';
import { chat, MODELS } from '../shared/llm.js';
import { logger } from '../shared/logger.js';
import type { JobPosting } from '../shared/schemas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');
const POSTINGS_DIR = path.join(ROOT, 'data/raw-postings');
const JOBS_DIR     = path.join(ROOT, 'data/jobs');
const REPORTS_DIR  = path.join(ROOT, 'reports');

// ─── Slug from filename ───────────────────────────────────────────────────────

function slugify(filename: string): string {
  return filename
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Market analysis prompt ───────────────────────────────────────────────────

const MARKET_SYSTEM = `You are an expert job market analyst. You will receive structured JSON data for multiple job postings in the same domain.

Produce a comprehensive market analysis report in Markdown. Include:

## Market Analysis Report

### 1. Most Commonly Required Skills
List skills sorted by frequency, with approximate percentages.

### 2. Preferred / Nice-to-Have Skills
Skills that appear as preferred across postings.

### 3. Experience & Seniority Trends
Typical years of experience and seniority levels requested.

### 4. Education Requirements
What degrees or credentials appear and how often.

### 5. Salary Range Overview
If salary data is available, summarize ranges. Note how many postings omitted it.

### 6. Remote / Location Patterns
Breakdown of remote, hybrid, onsite.

### 7. Common Responsibilities
Recurring responsibilities and what they signal about the role type.

### 8. Company Research Summary
Insights from company research: company sizes, industries, culture signals.

### 9. Notable Trends & Observations
Any patterns, emerging technologies, or things a candidate should know.

Be specific with numbers. Keep the report concise but information-dense. This will be loaded as context in future LLM prompts so keep it under 3000 words.`;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Ensure output directories exist
  await fs.mkdir(JOBS_DIR, { recursive: true });
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  await fs.mkdir(POSTINGS_DIR, { recursive: true });

  // List PDF files
  let files: string[];
  try {
    files = (await fs.readdir(POSTINGS_DIR)).filter((f) => f.endsWith('.pdf'));
  } catch {
    logger.error(`Could not read ${POSTINGS_DIR}. Make sure you've added PDF job postings there.`);
    process.exit(1);
  }

  if (files.length === 0) {
    logger.error(`No PDF files found in ${POSTINGS_DIR}`);
    logger.error('Add job posting PDFs named like: senior-dev-acme.pdf');
    process.exit(1);
  }

  logger.info(`Found ${files.length} posting(s) in data/raw-postings/`);

  const allPostings: JobPosting[] = [];

  for (const file of files) {
    const slug = slugify(file);
    const outputPath = path.join(JOBS_DIR, `${slug}.json`);

    // Skip if already extracted
    try {
      await fs.access(outputPath);
      logger.info(`Skipping ${file} (already extracted)`);
      const existing = JSON.parse(await fs.readFile(outputPath, 'utf-8')) as JobPosting;
      allPostings.push(existing);
      continue;
    } catch {
      // Not yet extracted — proceed
    }

    logger.info(`Processing: ${file}`);

    try {
      // 1. Extract text from PDF
      const rawText = await extractPdf(path.join(POSTINGS_DIR, file));

      // 2. Extract structured data + company research
      const posting = await extractPosting(rawText);
      logger.debug(`Extracted posting: ${posting.title} @ ${posting.company}`);
      logger.debug(`Required skills: ${posting.requiredSkills.length}, Preferred: ${posting.preferredSkills.length}`);

      // 3. Save to disk
      await fs.writeFile(outputPath, JSON.stringify(posting, null, 2), 'utf-8');
      logger.info(`Saved → data/jobs/${slug}.json`);

      allPostings.push(posting);
    } catch (err) {
      logger.error(`Failed to process ${file}: ${(err as Error).message}`);
      // Graceful degradation — continue with other files
    }
  }

  if (allPostings.length === 0) {
    logger.error('No postings were successfully extracted. Cannot generate market analysis.');
    process.exit(1);
  }

  // 4. Generate market analysis report
  logger.info(`Generating market analysis from ${allPostings.length} posting(s)...`);

  const postingsSummary = JSON.stringify(
    allPostings.map(({ companyResearch: _cr, ...rest }) => rest), // strip verbose research for token efficiency
    null,
    2
  );

  const report = await chat(
    MODELS.analyze,
    MARKET_SYSTEM,
    `<postings>\n${postingsSummary}\n</postings>\n\nGenerate the market analysis report.`,
  );

  const reportPath = path.join(REPORTS_DIR, 'market-analysis.md');
  await fs.writeFile(reportPath, report, 'utf-8');
  logger.info(`✅ Market analysis saved → reports/market-analysis.md`);
  process.stdout.write(`\n✅ Phase 1 complete. Processed ${allPostings.length} posting(s).\nReport: reports/market-analysis.md\n`);
}

main().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});