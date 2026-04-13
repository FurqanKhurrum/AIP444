# Evaluation Results — Assignment 2: Job Search Assistant

---

## 1. Extraction Spot-Check

Three job postings were manually reviewed line-by-line against their extracted JSON files.

### Posting 1: Software Engineer – API at CMiC (`swe-api-resume.pdf`)

**Verified correct:**
- Title: "Software Engineer – API" ✅
- Company: "CMiC" ✅
- Location: "Toronto, ON M3J 3K1" ✅
- Remote status: "hybrid" ✅
- Salary range: $70,000–$115,000 CAD ✅
- Required skills captured all major technologies listed ✅

**Issues found:**
- None significant. This was a well-structured Indeed posting with clear field labels, which the vision extractor handled cleanly.

---

### Posting 2: Software Engineering Intern at Citco

**Verified correct:**
- Title, company, location all correct ✅
- Required skills (Python, Java, JavaScript, SQL) all captured ✅
- Education requirement ("pursuing a CS degree") captured as string ✅

**Issues found:**
- "HTML" was listed as a required skill in the posting but appeared under `preferredSkills` in the JSON rather than `requiredSkills`. The posting's formatting was ambiguous — HTML was listed in a secondary bullet under web technologies rather than the main requirements section. The extractor made a reasonable but incorrect categorization.

---

### Posting 3: Integrity & Risk Engineer in Training II at Enbridge

**Verified correct:**
- Title, company, location correct ✅
- Salary range captured ✅
- P.Eng eligibility requirement captured in `educationRequired` ✅

**Issues found:**
- Several domain-specific responsibilities (pipeline data modeling, MAOP calculations, regulatory compliance) were grouped into a single generic `keyResponsibilities` entry rather than preserved individually. The posting used dense paragraph formatting rather than bullet points, and the extractor collapsed related items together.
- `experienceYears` returned `2` correctly but the posting said "0–2 years" — the extractor took the minimum, which is the correct behavior per the schema design (which is meant to be encouraging) but worth noting.

---

## 2. Scoring Check

Three postings were run through Phase 3 representing different fit levels.

### Strong Fit — Software Engineering Intern at Citco
**Score: 75% — Good Fit**

Agreement: Yes. The candidate meets Python, Java, JavaScript, and SQL requirements directly. The one meaningful gap is the degree requirement ("pursuing a CS degree") which is a soft gap for an intern role. 75% is a reasonable score.

One minor disagreement: HTML was listed as a gap despite being a basic skill implied by the candidate's React/Next.js experience. The system penalized it because it wasn't explicitly on the resume, which is technically correct but slightly harsh.

---

### Moderate Fit — Software Engineer at 1851 Labs (Stealth)
**Score: 63% — Good Fit**

Agreement: Partially. The role requires TypeScript, Convex, image pipelines, diffusion models, and MLOps — all genuine gaps. 63% reflects real technical distance. However the score was tested across three prompt iterations (45% → 58% → 63%) and converged here, suggesting the system has a floor for roles with many niche gaps regardless of prompt tuning. 65–68% would be more accurate given the candidate's strong full-stack foundation and the startup's implied flexibility for early-stage hiring.

---

### Weak Fit — Integrity & Risk Engineer in Training II at Enbridge
**Score: 45% — Stretch**

Agreement: No — the score is too high. This role requires a P.Eng designation eligibility (a hard regulatory blocker in Ontario for engineering roles), a bachelor's in civil/mechanical/chemical engineering (a structural gap), and 0–2 years of engineering experience. The candidate's background is entirely in software. A score of 25–30% would be more honest. The system's encouragement bias and inability to distinguish hard blockers from soft gaps inflated this score.

---

## 3. Failure Analysis

### Failure 1: Frequency values in gaps.json are hallucinated

**What happened:** The `frequency` field in `gaps.json` is supposed to represent how many of the analyzed job postings mention a given skill. With 8 postings in the dataset, valid values should be whole numbers between 1 and 8. The PRISM-tuned run returned values like `frequency: 60` for "Years of Professional Experience" and `frequency: 25` for "Bachelor's Degree." The original persona run returned decimal values like `0.25` and `0.375`.

**Why it happened:** The LLM has no mechanism to actually count occurrences across the JSON files. The `market-analysis.md` it receives is a prose summary, not raw data with counts. The model fabricates plausible-sounding numbers based on general knowledge rather than the actual postings.

**Proposed fix:** Pass the raw array of job posting JSONs to the gap analysis step rather than just the prose market report, and explicitly instruct the model to count skill occurrences across the array. Alternatively, compute frequency programmatically before calling the LLM — extract all `requiredSkills` arrays from `data/jobs/*.json`, count occurrences per skill, and inject those counts into the prompt as structured data.

---

### Failure 2: Report generator adds gaps not present in gaps.json

**What happened:** The final Markdown report (`gap-analysis.md`) included "Git Workflow" in the short-term skill gaps section. This item does not appear anywhere in `gaps.json` — it was added by the report generator LLM from its own general knowledge about what developers should know.

**Why it happened:** The `generate-gap-report.ts` system prompt instructs the model to write an encouraging, practical report but does not explicitly constrain it to only surface gaps that appear in the input JSON. The model treated the task as "write a good career report for this candidate" rather than "faithfully render this specific gap data."

**Proposed fix:** Add an explicit grounding instruction to the system prompt: "Only include gaps that are present in the gap_analysis JSON. Do not add additional suggestions from your own knowledge. If a skill is not in the gaps array, do not mention it as a gap." This is the same grounding principle used in the extraction prompts.

---

### Failure 3: Fit scoring treats all gaps as equal weight

**What happened:** The Enbridge posting requires P.Eng eligibility — a legal professional designation that cannot be waived and takes years to obtain. The 1851 Labs posting requires TypeScript — a skill learnable in days for someone with JavaScript experience. Both reduced the fit score by roughly the same amount despite the vast difference in how hard each gap is to close.

**Why it happened:** The scoring prompt counts matched vs unmatched required skills and divides to get a percentage. There is no concept of "hard blocker" (cannot be waived, years to close) vs "soft gap" (learnable in days, often waived for strong candidates). Three prompt iterations were attempted to fix this, moving the 1851 Labs score from 45% to 63%, but the Enbridge score remained inappropriately high at 45%.

**Proposed fix:** Explicitly categorize requirements in the scoring prompt. Hard blockers (professional licenses, legally required degrees, geographic restrictions the candidate cannot meet) should each apply a -20 point penalty. Soft gaps (missing a specific tool, preferred skills not present) should apply a -3 to -5 point penalty. The prompt should include a two-example calibration block showing what a hard-blocker score vs a soft-gap score should look like numerically.

---

### Failure 4: Expert persona prompting destroyed extraction accuracy (comparison finding)

**What happened:** When the original "You are an expert ATS specialist" / "You are a senior career coach with 15+ years of experience" prompts were used, `resume.json` returned empty arrays for `hardSkills`, `softSkills`, and `keywords` across multiple independent runs. The PRISM-method prompts (no persona on extraction tasks) correctly extracted 25 hard skills, 3 soft skills, and 24 keywords from the same resume.

**Why it happened:** This aligns with the USC PRISM research finding (Hu et al., 2026): expert personas activate instruction-following mode, which competes with the model's ability to accurately retrieve facts from input data. The extraction task is pretraining-dependent (factual recall from a document) — precisely the task type where the research found personas cause degraded performance.

**Fix applied:** Personas were removed from all extraction prompts (`extract-resume.ts`, `extract-posting.ts`). Personas were kept and strengthened only on writing/report-generation tasks (`generate-gap-report.ts`, market analysis prompt in `market.ts`) where the research confirms they help.

---

## 4. Overall Observations

The system works reliably end-to-end for software engineering roles that closely match the candidate's background. Phase 1 extraction is accurate for well-structured postings (Indeed, LinkedIn) and degrades for postings with dense paragraph formatting or ambiguous field labels. Phase 2 gap analysis produces actionable output when the market analysis report is rich — the quality of Phase 2 is directly downstream of Phase 1 quality. Phase 3 application reports are most useful for roles with 50–80% fit; below 50% the advice becomes generic because the LLM has little specific material to work with.

The system would not be trusted for final application decisions without human review. The frequency hallucination in gap analysis, the occasional report additions not grounded in data, and the scoring miscalibration for hard-blocker roles are all cases where a user could be misled. With human review as a final step, the system provides genuine value — particularly the resume adaptation suggestions and interview prep sections, which were consistently specific and role-appropriate across all tested postings.