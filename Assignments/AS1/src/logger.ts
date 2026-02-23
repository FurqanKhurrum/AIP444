// ============================================================
// logger.ts - Verbose logging utility
// ============================================================

let VERBOSE = false;

/**
 * Enable or disable verbose logging.
 */
export function setVerbose(enabled: boolean): void {
  VERBOSE = enabled;
}

/**
 * Logs a message to stderr only when verbose mode is enabled.
 * All verbose output goes to stderr so stdout stays clean for the final report.
 */
export function log(message: string): void {
  if (VERBOSE) {
    console.error(`[verbose] ${message}`);
  }
}