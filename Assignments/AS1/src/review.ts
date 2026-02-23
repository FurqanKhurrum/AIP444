#!/usr/bin/env node
// ============================================================
// review.ts - Main entry point for the AI code review CLI
// ============================================================

import path from "path";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { execSync } from "child_process";

// Load .env from AIP444 root directory (two levels up from AS1/)
const envPath = path.resolve(process.cwd(), "..", "..", ".env");
dotenv.config({ path: envPath });

if (!process.env.OPENROUTER_API_KEY) {
  console.error(`Error: OPENROUTER_API_KEY not found.\nLooked for .env at: ${envPath}`);
  process.exit(1);
}
import { CLIArgs, ReviewResult } from "./types.js";
import { runReviewer } from "./reviewers.js";
import { runJudge } from "./judge.js";
import { log, setVerbose } from "./logger.js";
import {
  securityAuditorPrompt,
  maintainabilityCriticPrompt,
} from "./prompts.js";

// --- CLI Argument Parsing ---

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose");
  const fileIndex = args.indexOf("--file");
  const filePath = fileIndex !== -1 ? args[fileIndex + 1] : undefined;

  // If --file was passed but no path followed it
  if (fileIndex !== -1 && !filePath) {
    console.error("Error: --file flag requires a file path. Usage: review --file <path>");
    process.exit(1);
  }

  return {
    mode: filePath ? "file" : "git",
    filePath,
    verbose,
  };
}

// --- Input Retrieval ---

/**
 * Gets the code input based on the CLI mode.
 * Git Mode: runs `git diff --staged` and returns the diff.
 * File Mode: reads the specified file and returns its contents.
 */
function getInput(config: CLIArgs): string {
  if (config.mode === "file") {
    // Verify the file exists and is readable, but don't send the full contents.
    // This forces the reviewers to use read_file to see the code.
    try {
      const content = readFileSync(config.filePath!, "utf-8");
      if (!content.trim()) {
        console.error(`Error: File "${config.filePath}" is empty.`);
        process.exit(1);
      }
      log(`Verified file exists: ${config.filePath} (${content.split("\n").length} lines)`);
      return `Please review the following file: ${config.filePath}\n\nUse the read_file tool to examine its contents, then use grep_codebase and get_file_history for additional context.`;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        console.error(`Error: File not found — "${config.filePath}"`);
      } else {
        console.error(`Error reading file: ${error.message}`);
      }
      process.exit(1);
    }
  }

  // Git Mode
  try {
    const diff = execSync("git diff --staged", { encoding: "utf-8" });
    if (!diff.trim()) {
      console.error(
        "No staged changes found. Stage some changes with `git add` or use --file mode.\n" +
        "Usage:\n" +
        "  review --file <path>     Review a specific file\n" +
        "  git add <file> && review  Review staged git changes"
      );
      process.exit(1);
    }
    log(`Got staged diff (${diff.split("\n").length} lines)`);
    return diff;
  } catch (error: any) {
    console.error("Error: Failed to run `git diff --staged`. Are you in a git repository?");
    process.exit(1);
  }
}

// --- Main ---

async function main() {
  const config = parseArgs();
  setVerbose(config.verbose);

  log(`Mode: ${config.mode}`);
  if (config.filePath) log(`File: ${config.filePath}`);

  // Step 1: Get the code to review
  const input = getInput(config);
  log(`Input length: ${input.length} characters\n`);

  // Step 2: Run both reviewers in parallel
  log("=== Phase 1: Running Reviewers in Parallel ===\n");

  let review1: ReviewResult;
  let review2: ReviewResult;

  try {
    [review1, review2] = await Promise.all([
      runReviewer("Security Auditor", securityAuditorPrompt, input),
      runReviewer("Maintainability Critic", maintainabilityCriticPrompt, input),
    ]);
  } catch (error: any) {
    console.error(`\nError during review phase: ${error.message}`);
    process.exit(1);
  }

  log(`\nSecurity Auditor found ${review1.findings.length} issues`);
  log(`Maintainability Critic found ${review2.findings.length} issues`);
  log(`\n[Security Auditor findings]\n${JSON.stringify(review1.findings, null, 2)}`);
  log(`\n[Maintainability Critic findings]\n${JSON.stringify(review2.findings, null, 2)}`);

  // Step 3: Pass both review results to the Lead Developer judge
  log("\n=== Phase 2: Lead Developer Synthesis ===\n");

  let finalReport: string;

  try {
    finalReport = await runJudge(review1, review2);
  } catch (error: any) {
    console.error(`\nError during synthesis phase: ${error.message}`);
    process.exit(1);
  }

  // Step 4: Print the final Markdown report to stdout
  console.log(finalReport);
}

main();