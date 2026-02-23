// ============================================================
// tools.ts - Tool implementations for the AI code review CLI
// ============================================================

import { readFileSync, readdirSync, statSync } from "fs";
import { execSync } from "child_process";
import { join, extname } from "path";
import { ReadFileParams, GrepCodebaseParams, GetFileHistoryParams } from "./types.js";

// --- Constants ---

const MAX_FILE_LINES = 500;
const MAX_GREP_RESULTS = 50;
const MAX_OUTPUT_CHARS = 10000;

// --- Helpers ---

/**
 * Truncate a string to a maximum character length, appending a notice if truncated.
 */
function truncate(text: string, maxChars: number = MAX_OUTPUT_CHARS): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n... [truncated — output exceeded character limit]";
}

// --- Tool Implementations ---

/**
 * Reads a file from disk, optionally returning a specific line range.
 * Handles large files by capping at MAX_FILE_LINES.
 * Returns file contents with line numbers prepended.
 */
export function readFile(params: ReadFileParams): string {
  const { file_path, start_line, end_line } = params;

  try {
    const content = readFileSync(file_path, "utf-8");
    const lines = content.split("\n");

    // Determine the range to return (1-based indexing from the LLM)
    const start = start_line ? Math.max(1, start_line) : 1;
    const end = end_line ? Math.min(lines.length, end_line) : lines.length;

    // Slice to requested range
    let selectedLines = lines.slice(start - 1, end);

    // Cap at MAX_FILE_LINES to prevent token explosion
    if (selectedLines.length > MAX_FILE_LINES) {
      selectedLines = selectedLines.slice(0, MAX_FILE_LINES);
      const numbered = selectedLines.map(
        (line, i) => `${start + i}: ${line}`
      );
      return (
        numbered.join("\n") +
        `\n\n... [truncated — file has ${lines.length} lines, showing first ${MAX_FILE_LINES}]`
      );
    }

    // Prepend line numbers for the LLM to reference
    const numbered = selectedLines.map((line, i) => `${start + i}: ${line}`);
    return numbered.join("\n");
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return `Error: File not found — "${file_path}"`;
    }
    return `Error reading file: ${error.message}`;
  }
}

/**
 * Recursively searches the codebase for a pattern.
 * Pure Node.js implementation — works on Windows, macOS, and Linux.
 * Excludes node_modules, .git, dist, and other non-essential directories.
 * Returns matching lines with file paths and line numbers.
 */
export function grepCodebase(params: GrepCodebaseParams): string {
  const { search_pattern } = params;

  const ALLOWED_EXTENSIONS = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".py", ".json", ".md",
  ]);
  const EXCLUDED_DIRS = new Set([
    "node_modules", ".git", "dist", "coverage", ".next", "__pycache__",
  ]);

  const matches: string[] = [];

  function walkDir(dir: string): void {
    if (matches.length >= MAX_GREP_RESULTS) return;

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return; // Skip directories we can't read
    }

    for (const entry of entries) {
      if (matches.length >= MAX_GREP_RESULTS) return;

      const fullPath = join(dir, entry);

      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry)) {
          walkDir(fullPath);
        }
      } else if (stat.isFile() && ALLOWED_EXTENSIONS.has(extname(entry))) {
        try {
          const content = readFileSync(fullPath, "utf-8");
          const lines = content.split("\n");

          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(search_pattern)) {
              matches.push(`${fullPath}:${i + 1}: ${lines[i].trim()}`);
              if (matches.length >= MAX_GREP_RESULTS) return;
            }
          }
        } catch {
          // Skip files we can't read (binary, permissions, etc.)
        }
      }
    }
  }

  walkDir(".");

  if (matches.length === 0) {
    return `No matches found for pattern: "${search_pattern}"`;
  }

  const result = matches.join("\n");
  if (matches.length >= MAX_GREP_RESULTS) {
    return result + `\n\n... [truncated — showing first ${MAX_GREP_RESULTS} matches]`;
  }

  return truncate(result);
}

/**
 * Retrieves the recent git history (last 3 commits with diffs) for a file.
 * Handles untracked/new files gracefully without crashing.
 */
export function getFileHistory(params: GetFileHistoryParams): string {
  const { file_path } = params;

  try {
    const result = execSync(`git log -p -n 3 -- "${file_path}"`, {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
      timeout: 10000,
    });

    if (!result.trim()) {
      return "No history available (file is new or untracked).";
    }

    return truncate(result);
  } catch (error: any) {
    return "No history available (file is new or untracked).";
  }
}

// --- Tool Dispatcher ---

/**
 * Dispatches a tool call by name, parsing the arguments and calling the
 * appropriate function. Returns the tool's string output.
 */
export function executeTool(toolName: string, argsJson: string): string {
  const args = JSON.parse(argsJson);

  switch (toolName) {
    case "read_file":
      return readFile(args as ReadFileParams);
    case "grep_codebase":
      return grepCodebase(args as GrepCodebaseParams);
    case "get_file_history":
      return getFileHistory(args as GetFileHistoryParams);
    default:
      return `Error: Unknown tool "${toolName}". Available tools: read_file, grep_codebase, get_file_history.`;
  }
}