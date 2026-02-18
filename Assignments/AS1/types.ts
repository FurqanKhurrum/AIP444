// ============================================================
// types.ts - Shared types and tool schemas for the review CLI
// ============================================================

// --- Review Output Types ---

export interface ReviewFinding {
    file: string;
    line_number: number;
    severity: "info" | "warn" | "critical";
    category: string;
    description: string;
  }
  
  export interface ReviewResult {
    reviewer: string;
    findings: ReviewFinding[];
  }
  
  // --- Tool Parameter Types ---
  
  export interface ReadFileParams {
    file_path: string;
    start_line?: number;
    end_line?: number;
  }
  
  export interface GrepCodebaseParams {
    search_pattern: string;
  }
  
  export interface GetFileHistoryParams {
    file_path: string;
  }
  
  // --- CLI Config ---
  
  export interface CLIArgs {
    mode: "git" | "file";
    filePath?: string;
    verbose: boolean;
  }
  
  // --- OpenAI-compatible Tool Definitions (for OpenRouter) ---
  
  export const toolDefinitions = [
    {
      type: "function" as const,
      function: {
        name: "read_file",
        description:
          "Reads the contents of a file from disk. Use this to see the full file context beyond what was provided in the diff or snippet — for example, to check imports, class definitions, or surrounding logic. You can optionally specify start_line and end_line to read only a portion of the file.",
        parameters: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "The relative path to the file to read (e.g. 'src/utils.ts').",
            },
            start_line: {
              type: "number",
              description:
                "Optional 1-based start line. If omitted, reading starts from the beginning of the file.",
            },
            end_line: {
              type: "number",
              description:
                "Optional 1-based end line. If omitted, reading continues to the end of the file (subject to truncation limits).",
            },
          },
          required: ["file_path"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "grep_codebase",
        description:
          "Recursively searches the codebase for a given pattern using grep. Use this to find function definitions, usages, test files, imports, or any matching text across the project. Results exclude node_modules, .git, and other non-essential directories.",
        parameters: {
          type: "object",
          properties: {
            search_pattern: {
              type: "string",
              description:
                "The text or regex pattern to search for (e.g. 'calculate_tax', 'api_key', 'TODO').",
            },
          },
          required: ["search_pattern"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "get_file_history",
        description:
          "Retrieves the recent git history (last 3 commits with diffs) for a specific file. Use this to understand why code was written a certain way, check for recent regressions, or see what changed recently. Returns 'No history available' if the file is new or untracked.",
        parameters: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "The relative path to the file to get history for (e.g. 'src/server.ts').",
            },
          },
          required: ["file_path"],
          additionalProperties: false,
        },
      },
    },
  ];