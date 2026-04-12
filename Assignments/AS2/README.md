# Assignment 2 — Job Search Assistant

**AIP444 | Furqan**

An end-to-end AI system that analyzes job postings, evaluates your resume, and generates targeted application reports.

---

## Setup

### 1. Install dependencies

```bash
cd assignments/assignment-02
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` (in the monorepo root, two levels up) and fill in your keys:

```
OPENROUTER_API_KEY=sk-or-...
TAVILY_API_KEY=tvly-...
```

---

## Phase 1: Job Market Analysis

Place 8+ job posting PDFs in `data/raw-postings/`. Name them descriptively, e.g.:

```
data/raw-postings/
├── senior-dev-acme.pdf
├── fullstack-initech.pdf
└── ...
```

Then run:

```bash
npm run market
# or with verbose debug output:
npm run market -- --verbose
```

**Output:**
- `data/jobs/<slug>.json` — structured data per posting
- `reports/market-analysis.md` — aggregate market analysis

Re-running skips already-extracted postings automatically.

---

## Phase 2: Resume Gap Analysis

```bash
npm run gaps -- path/to/resume.pdf
# or with verbose:
npm run gaps -- path/to/resume.pdf --verbose
```

**Output:**
- `data/resume/resume.json` — structured resume data
- `reports/gap-analysis.md` — triaged gap analysis

---

## Phase 3: Application Advisor

```bash
npm run advise -- path/to/new-posting.pdf
# or with verbose:
npm run advise -- path/to/new-posting.pdf --verbose
```

**Output:**
- `reports/application-report-<slug>.md` — full application report

---

## Evaluation

```bash
# TODO: add eval script
```

---

## Extras Implemented

_TBD_