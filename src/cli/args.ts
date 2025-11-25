/**
 * Simple argument parsing utilities
 */

import * as fs from "fs";

export interface ParsedArgs {
  command: string;
  positional: string[];
  flags: {
    verbose?: boolean;
    full?: boolean;
    recursive?: boolean;
    shallow?: boolean;
    json?: boolean;
    xml?: boolean;
    help?: boolean;
    tail?: number;
    grep?: string;
    smart?: boolean;
    limit?: number;
    urls?: boolean;
    format?: "json" | "xml";
  };
  stdin: string | null;
}

/**
 * Read from stdin if available
 * Returns trimmed content or null if no stdin
 */
export const readStdin = (): string | null => {
  // Check if stdin is a TTY (interactive terminal)
  // If it is, there's no piped input
  if (process.stdin.isTTY) {
    return null;
  }

  // Try to read from stdin with retry on EAGAIN (non-blocking pipe race condition)
  // In pipe chains like "cmd1 | cmd2 | jk", stdin might not be ready immediately
  const maxRetries = 10;
  const retryDelayMs = 10;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Read from stdin synchronously (file descriptor 0)
      const buffer = fs.readFileSync(0, "utf-8");
      const trimmed = buffer.trim();
      // Return null if stdin is empty after trimming
      return trimmed.length > 0 ? trimmed : null;
    } catch (error: any) {
      // EAGAIN means stdin isn't ready yet (non-blocking I/O)
      // Retry after a short delay
      if (error.code === "EAGAIN" && attempt < maxRetries - 1) {
        // Sleep for a short time before retrying
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, retryDelayMs);
        continue;
      }
      // Other errors or max retries reached
      return null;
    }
  }

  return null;
};

/**
 * Parse command line arguments
 * IMPORTANT: Also reads stdin synchronously at parse time to ensure it's available
 */
export const parseArgs = (argv: string[]): ParsedArgs => {
  const [command, ...rest] = argv;

  const flags = {
    verbose: false,
    full: false,
    recursive: false,
    shallow: false,
    json: false,
    xml: false,
    help: false,
    tail: undefined as number | undefined,
    grep: undefined as string | undefined,
    smart: false,
    limit: undefined as number | undefined,
    urls: false,
    format: undefined as "json" | "xml" | undefined,
  };

  const positional: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];

    if (arg.startsWith("--")) {
      const flag = arg.slice(2);
      if (flag === "verbose" || flag === "v") {
        flags.verbose = true;
      } else if (flag === "full") {
        flags.full = true;
      } else if (flag === "recursive" || flag === "r") {
        flags.recursive = true;
      } else if (flag === "shallow") {
        flags.shallow = true;
      } else if (flag === "json") {
        flags.json = true;
      } else if (flag === "xml") {
        flags.xml = true;
      } else if (flag === "help" || flag === "h") {
        flags.help = true;
      } else if (flag === "smart") {
        flags.smart = true;
      } else if (flag === "urls") {
        flags.urls = true;
      } else if (flag === "tail") {
        // Next arg should be a number
        const nextArg = rest[i + 1];
        if (nextArg && !nextArg.startsWith("-")) {
          const num = parseInt(nextArg, 10);
          if (!isNaN(num) && num > 0) {
            flags.tail = num;
            i++; // Skip next arg
          }
        }
      } else if (flag === "grep") {
        // Next arg should be a pattern
        const nextArg = rest[i + 1];
        if (nextArg && !nextArg.startsWith("-")) {
          flags.grep = nextArg;
          i++; // Skip next arg
        }
      } else if (flag === "limit") {
        // Next arg should be a number
        const nextArg = rest[i + 1];
        if (nextArg && !nextArg.startsWith("-")) {
          const num = parseInt(nextArg, 10);
          if (!isNaN(num) && num > 0) {
            if (num > 100) {
              // Cap at 100 to prevent excessive API calls
              console.warn("Warning: Limit capped at 100 to prevent excessive API calls");
              flags.limit = 100;
            } else {
              flags.limit = num;
            }
            i++; // Skip next arg
          }
        }
      } else if (flag === "format") {
        // Next arg should be json or xml
        const nextArg = rest[i + 1];
        if (nextArg && (nextArg === "json" || nextArg === "xml")) {
          flags.format = nextArg;
          i++; // Skip next arg
        }
      }
    } else if (arg.startsWith("-")) {
      // Short flags
      const shortFlags = arg.slice(1).split("");
      for (const flag of shortFlags) {
        if (flag === "v") flags.verbose = true;
        if (flag === "r") flags.recursive = true;
        if (flag === "h") flags.help = true;
      }
    } else {
      positional.push(arg);
    }
  }

  // Read stdin synchronously at parse time (before any async operations)
  // This ensures stdin is available even if accessed later
  const stdin = readStdin();

  return {
    command: command || "help",
    positional,
    flags,
    stdin,
  };
};
