# AGENTS.md — Assignment 2: Application Advisor (Phase 3)

This file provides context for a coding agent building Phase 3 of the Job Search Assistant.

## Project Overview

This is an AIP444 (AI Programming) course assignment. The project is a 3-phase job search assistant:

- **Phase 1** (complete): Extracts structured data from job posting PDFs and generates a market analysis report.
- **Phase 2** (complete): Extracts resume data and produces a triaged gap analysis report.
- **Phase 3** (your task): Takes a *new* job posting and generates a comprehensive application report.

## Tech Stack

- **Language:** TypeScript, Node.js
- **Runtime:** `tsx` (run with `npx tsx <file>`)
- **Package manager:** npm
- **LLM:** OpenRouter via `openai` SDK (base URL: `https://openrouter.ai/api/v1`)
- **Schemas:** Zod
- **Web search:** Tavily via `fetch` (see `src/shared/web-search.ts`)
- **PDF extraction:** Jina Reader API (see `src/shared/extract-pdf.ts`)
- **Environment:** `.env` file lives 2 levels up from this directory (monorepo root). Load with: `config({ path: path.resolve(__dirname, '../../../.env') })` using `fileURLToPath(import.meta.url)` for `__dirname`.

## Directory Structure

```
assignment-02/
├── src/
│   ├── shared/
│   │   ├── logger.ts          — debug/verbose logging to stderr
│   │   ├── llm.ts             — OpenRouter client, MODELS constants, chat() helper
│   │   ├── schemas.ts         — Zod schemas: JobPostingSchema, ResumeSchema, GapAnalysisSchema
│   │   ├── extract-pdf.ts     — Jina Reader PDF extractor
│   │   └── web-search.ts      — Tavily tool definition + runWebSearch()
│   ├── extract/
│   │   ├── extract-posting.ts — Extracts structured JobPosting from raw text (with tool loop)
│   │   └── market.ts          — Phase 1 CLI entry point
│   ├── analysis/
│   │   ├── extract-resume.ts  — Extracts structured Resume from raw text
│   │   ├── analyze-gaps.ts    — Produces GapAnalysis by comparing resume to market report
│   │   ├── generate-gap-report.ts — Converts GapAnalysis to Markdown
│   │   └── gaps.ts            — Phase 2 CLI entry point
│   └── advisor/
│       └── advise.ts          — Phase 3 CLI entry point (IMPLEMENT THIS)
├── data/
│   ├── jobs/                  — extracted posting JSONs (from Phase 1)
│   └── resume/
│       ├── resume.json        — extracted resume (from Phase 2)
│       └── gaps.json          — raw gap analysis data (from Phase 2)
└── reports/
    ├── market-analysis.md     — Phase 1 output
    └── gap-analysis.md        — Phase 2 output
```

## Task: Implement `src/advisor/advise.ts`

Replace the stub with a full implementation. Follow the pattern established in Phase 1 and 2.

### CLI Interface

```bash
npx tsx src/advisor/advise.ts path/to/new-posting.pdf [--verbose]
```

### Required Steps

1. **Parse args:** Get PDF path from `process.argv`. Exit with usage message if missing.
2. **Load context files** (exit with clear error if any are missing):
   - `reports/market-analysis.md`
   - `reports/gap-analysis.md`
   - `data/resume/resume.json`
3. **Extract the new posting:** Call `extractPosting()` from `src/extract/extract-posting.ts`. This already handles company research via Tavily tool calls — no need to duplicate it.
4. **Generate the 4-section report** by calling the LLM. Use `MODELS.advise` from `src/shared/llm.ts`.
5. **Save** the report to `reports/application-report-<slug>.md` where slug is derived from the PDF filename.
6. **Print** to stdout: the report path and the fit score.

### Report Structure (4 required sections)

The LLM must produce a Markdown report with exactly these sections:

```markdown
# Application Report: [Job Title] at [Company]

## 1. Fit Assessment
[Fit score as percentage with a label]

### Score Breakdown
[Table or list: requirement → met/gap/partial]

### Recommendation
[Encouraging text. NEVER say "don't apply" for scores above 30%]

---

## 2. Resume Adaptation
[Specific, concrete changes — not generic advice]
[e.g. "Move TypeScript to the top of skills — it's listed as required"]

---

## 3. Cover Letter Guidance
[Key points for THIS specific role and company]
[Reference company research where relevant]

---

## 4. Interview Prep
### Likely Questions
### Topics to Brush Up On
### Company Research Points
### Talking Points (connecting your experience to their needs)
```

### Fit Scoring Rules (IMPORTANT)

The system must bias toward encouraging applications. Hard-code this into your system prompt:

| Score | Recommendation |
|-------|----------------|
| 80%+  | Strong fit — definitely apply |
| 50–79% | Good fit — apply and highlight your strengths |
| 30–49% | Stretch role — worth applying if it excites you |
| <30%  | Growth target — consider building toward this |

**Never output "you are not qualified" or "don't apply" for scores ≥30%.**

### Logging Requirements

Use `logger.debug()` for:
- Each file loaded
- LLM model called + token count
- Fit score computed
- Report path saved

Use `logger.info()` for progress milestones visible to the user.

### Error Handling

- Missing context files → clear error message + exit(1)
- LLM call fails → log error, exit(1)
- PDF extraction fails → log error, exit(1)
- Do NOT crash silently

### Code Style

- TypeScript with types (no `any` unless unavoidable)
- ESM imports with `.js` extensions (e.g. `import { chat } from '../shared/llm.js'`)
- `async/await` throughout
- `__dirname` via `path.dirname(fileURLToPath(import.meta.url))`
- All file paths resolved relative to ROOT (2 levels up from `src/advisor/`)

## What NOT to Do

- Do not re-implement PDF extraction or web search — reuse existing modules
- Do not hardcode API keys — they come from `.env`
- Do not write to `data/raw-postings/` or `data/resume/` — those are input-only directories
- Do not use CommonJS `require()` — this project uses ESM
- Do not add new npm dependencies without checking if an existing shared utility already covers the need