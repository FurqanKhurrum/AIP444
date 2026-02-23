#!/usr/bin/env node
// ============================================================
// eval.ts - Automated scoring of reviewers against golden dataset
//
// Usage:
//   npm run eval                    # Single run, default model
//   npx tsx src/eval.ts 3           # 3 runs averaged
//   npx tsx src/eval.ts 1 --compare # Compare multiple models
// ============================================================

import path from "path";
import dotenv from "dotenv";
import { readFileSync, writeFileSync } from "fs";
import { runReviewer, DEFAULT_MODEL } from "./reviewers.js";
import { ReviewFinding } from "./types.js";
import {
  securityAuditorPrompt,
  maintainabilityCriticPrompt,
} from "./prompts.js";

// Load .env from AIP444 root
const envPath = path.resolve(process.cwd(), "..", "..", ".env");
dotenv.config({ path: envPath });

if (!process.env.OPENROUTER_API_KEY) {
  console.error(`Error: OPENROUTER_API_KEY not found.\nLooked for .env at: ${envPath}`);
  process.exit(1);
}

// --- Types ---

interface ExpectedFinding {
  id: string;
  description: string;
  line: number;
  severity: string;
  keywords: string[];
}

interface GoldenDataset {
  securityAuditor: ExpectedFinding[];
  maintainabilityCritic: ExpectedFinding[];
}

interface EvalResult {
  id: string;
  description: string;
  passed: boolean;
  reason: string;
  matchedFinding?: ReviewFinding;
}

// --- Scoring Logic ---

/**
 * Check if a reviewer finding matches an expected finding.
 * A match requires:
 * 1. Line number is within ±5 lines of expected
 * 2. At least 2 keywords from the expected finding appear in the description
 */
function findingMatches(
  actual: ReviewFinding,
  expected: ExpectedFinding
): boolean {
  // Check line proximity (±5 lines to account for LLM variance)
  const lineDiff = Math.abs(actual.line_number - expected.line);
  if (lineDiff > 5) return false;

  // Check keyword matches (need at least 2)
  const descLower = actual.description.toLowerCase();
  const keywordHits = expected.keywords.filter((kw) =>
    descLower.includes(kw.toLowerCase())
  );

  return keywordHits.length >= 2;
}

/**
 * Score a set of actual findings against expected findings.
 * Returns per-finding pass/fail results plus aggregate scores.
 */
function scoreReviewer(
  reviewerName: string,
  actualFindings: ReviewFinding[],
  expectedFindings: ExpectedFinding[]
): {
  results: EvalResult[];
  recall: number;
  precision: number;
  score: number;
} {
  const results: EvalResult[] = [];
  const matchedActuals = new Set<number>(); // Track which actuals were matched

  // For each expected finding, check if any actual finding matches
  for (const expected of expectedFindings) {
    let matched = false;
    let matchedFinding: ReviewFinding | undefined;

    for (let i = 0; i < actualFindings.length; i++) {
      if (matchedActuals.has(i)) continue; // Already matched to another expected

      if (findingMatches(actualFindings[i], expected)) {
        matched = true;
        matchedFinding = actualFindings[i];
        matchedActuals.add(i);
        break;
      }
    }

    results.push({
      id: expected.id,
      description: expected.description,
      passed: matched,
      reason: matched
        ? `PASS: Matched finding at line ${matchedFinding!.line_number}`
        : `FAIL: Not detected by ${reviewerName}`,
      matchedFinding,
    });
  }

  // Count hallucinations (actual findings that didn't match any expected)
  const hallucinations = actualFindings.filter(
    (_, i) => !matchedActuals.has(i)
  );

  // Calculate metrics
  const caught = results.filter((r) => r.passed).length;
  const total = expectedFindings.length;
  const recall = total > 0 ? caught / total : 0;

  // Precision: correct findings / total findings reported
  // (findings that matched expected are "correct")
  const precision =
    actualFindings.length > 0
      ? matchedActuals.size / actualFindings.length
      : 0;

  const score = (recall + precision) / 2;

  return { results, recall, precision, score };
}

// --- Main Eval Runner ---

// Models to compare (used with --compare flag)
const MODELS_TO_COMPARE = [
  "google/gemini-2.0-flash-001",
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
];

async function runEval() {
  const args = process.argv.slice(2);
  const RUNS = parseInt(args.find((a) => !a.startsWith("--")) || "1", 10);
  const compareMode = args.includes("--compare");

  const models = compareMode ? MODELS_TO_COMPARE : [DEFAULT_MODEL];

  console.log(
    compareMode
      ? `🚀 Model Comparison Eval (${models.length} models)...\n`
      : `🚀 Starting Reviewer Eval (${RUNS} run${RUNS > 1 ? "s" : ""})...\n`
  );

  // Load golden dataset
  const dataset: GoldenDataset = JSON.parse(
    readFileSync("test/golden_dataset.json", "utf-8")
  );

  // Load bad_code.ts — verify it exists but send only the file path
  // This forces reviewers to use read_file tool (matching review.ts behavior)
  readFileSync("test/bad_code.ts", "utf-8"); // throws if missing
  const input = `Please review the following file: test/bad_code.ts\n\nUse the read_file tool to examine its contents, then use grep_codebase and get_file_history for additional context.`;

  // Define reviewer configs
  const reviewers = [
    {
      name: "Security Auditor",
      prompt: securityAuditorPrompt,
      expected: dataset.securityAuditor,
    },
    {
      name: "Maintainability Critic",
      prompt: maintainabilityCriticPrompt,
      expected: dataset.maintainabilityCritic,
    },
  ];

  // Track scores across runs for averaging
  const runHistory: {
    model: string;
    reviewer: string;
    run: number;
    recall: number;
    precision: number;
    score: number;
    caught: number;
    expected: number;
    hallucinations: number;
    missed: string[];
  }[] = [];

  for (const model of models) {
    if (compareMode) {
      console.log(`\n${"█".repeat(60)}`);
      console.log(`🤖 MODEL: ${model}`);
      console.log("█".repeat(60));
    }

    for (let run = 1; run <= RUNS; run++) {
      if (RUNS > 1) {
        console.log(`\n${"═".repeat(50)}`);
        console.log(`🔄 RUN ${run}/${RUNS}`);
        console.log("═".repeat(50));
      }

      for (const config of reviewers) {
        console.log(`\n📄 Evaluating: ${config.name}`);
        console.log("─".repeat(50));

        // Run the reviewer with the specified model
        const result = await runReviewer(
          config.name,
          config.prompt,
          input,
          model
        );

        // Score against golden dataset
        const { results, recall, precision, score } = scoreReviewer(
          config.name,
          result.findings,
          config.expected
        );

        // Print per-finding results
        for (const r of results) {
          process.stdout.write(r.passed ? "✅" : "❌");
        }

        const caught = results.filter((r) => r.passed).length;
        const hallucinations = result.findings.length - caught;
        const missed = results
          .filter((r) => !r.passed)
          .map((r) => r.id);

        console.log(
          `\n   Score: ${caught}/${config.expected.length} (${Math.round(recall * 100)}% recall)`
        );
        console.log(`   Precision: ${Math.round(precision * 100)}%`);
        console.log(
          `   Combined: ${Math.round(score * 100)}% ${score >= 0.7 ? "✅" : "⚠️"}`
        );
        console.log(`   Hallucinations: ${hallucinations}`);

        if (missed.length > 0) {
          console.log(`   Missed: ${missed.join(", ")}`);
        }

        runHistory.push({
          model,
          reviewer: config.name,
          run,
          recall,
          precision,
          score,
          caught,
          expected: config.expected.length,
          hallucinations,
          missed,
        });
      }
    }
  }

  // Print summary
  console.log("\n\n" + "═".repeat(60));
  console.log(
    compareMode
      ? "📊 MODEL COMPARISON SUMMARY"
      : `📊 EVAL SUMMARY ${RUNS > 1 ? `(averaged over ${RUNS} runs)` : ""}`
  );
  console.log("═".repeat(60));

  for (const model of models) {
    if (compareMode) {
      console.log(`\n🤖 ${model}`);
    }

    for (const reviewerName of reviewers.map((r) => r.name)) {
      const runs = runHistory.filter(
        (r) => r.reviewer === reviewerName && r.model === model
      );
      const avgRecall = runs.reduce((s, r) => s + r.recall, 0) / runs.length;
      const avgPrecision =
        runs.reduce((s, r) => s + r.precision, 0) / runs.length;
      const avgScore = runs.reduce((s, r) => s + r.score, 0) / runs.length;
      const avgHallucinations =
        runs.reduce((s, r) => s + r.hallucinations, 0) / runs.length;

      console.log(`\n  ${reviewerName}:`);
      console.log(`     Recall:    ${Math.round(avgRecall * 100)}%`);
      console.log(`     Precision: ${Math.round(avgPrecision * 100)}%`);
      console.log(
        `     Score:     ${Math.round(avgScore * 100)}% ${avgScore >= 0.7 ? "✅" : "⚠️"}`
      );
      console.log(`     Halluc.:   ${avgHallucinations.toFixed(1)}`);
      console.log(
        `     Status:    ${avgScore >= 0.7 ? "PASS" : "NEEDS IMPROVEMENT"}`
      );

      if (RUNS > 1) {
        const missCount: Record<string, number> = {};
        for (const r of runs) {
          for (const m of r.missed) {
            missCount[m] = (missCount[m] || 0) + 1;
          }
        }
        const sorted = Object.entries(missCount).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
          console.log(`     Frequently missed:`);
          for (const [id, count] of sorted) {
            console.log(
              `       ${id}: missed ${count}/${RUNS} (${Math.round((count / RUNS) * 100)}%)`
            );
          }
        }
      }
    }
  }

  console.log("\n" + "─".repeat(60));

  // Save detailed results
  writeFileSync("eval-results.json", JSON.stringify(runHistory, null, 2));
  console.log("💾 Saved detailed results to eval-results.json");
}

runEval();