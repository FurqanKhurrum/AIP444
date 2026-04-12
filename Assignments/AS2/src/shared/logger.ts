// src/shared/logger.ts
// Writes [DEBUG] lines to stderr so they don't pollute stdout reports.
// Enable with --verbose flag or LOG_LEVEL=debug env var.

const isVerbose =
  process.argv.includes('--verbose') ||
  process.env.LOG_LEVEL === 'debug';

export const logger = {
  debug(msg: string) {
    if (isVerbose) process.stderr.write(`[DEBUG] ${msg}\n`);
  },
  info(msg: string) {
    process.stderr.write(`[INFO]  ${msg}\n`);
  },
  error(msg: string) {
    process.stderr.write(`[ERROR] ${msg}\n`);
  },
};