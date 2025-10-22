import { Effect, pipe } from "effect";
import type { BuildOperations } from "../../lib/jenkins/operations.ts";
import {
  formatFailures,
  formatFailuresJson,
} from "../formatters/failures.ts";
import { formatFailuresXml } from "../formatters/xml.ts";
import { red, gray } from "../formatters/colors.ts";

export interface FailuresOptions {
  full?: boolean;
  recursive?: boolean;
  shallow?: boolean;
  json?: boolean;
  xml?: boolean;
  verbose?: boolean;
  tail?: number;
  grep?: string;
  smart?: boolean;
}

/**
 * Validate grep pattern to prevent ReDoS attacks
 * Rejects patterns that are likely to cause catastrophic backtracking
 */
const validateGrepPattern = (pattern: string): string | null => {
  // Check pattern length (very long patterns can be problematic)
  if (pattern.length > 200) {
    return "Pattern too long (max 200 characters)";
  }

  // Check for nested quantifiers (e.g., (a+)+, (a*)*) which cause exponential backtracking
  const nestedQuantifiers = /(\(\??[^)]*[*+]\)?)[*+{]/g;
  if (nestedQuantifiers.test(pattern)) {
    return "Pattern contains nested quantifiers which may cause performance issues";
  }

  // Check for excessive alternations (e.g., (a|b|c|d|e|f|...))
  const alternationCount = (pattern.match(/\|/g) || []).length;
  if (alternationCount > 20) {
    return "Pattern contains too many alternations (max 20)";
  }

  // Check for unclosed groups
  const openParens = (pattern.match(/\(/g) || []).length;
  const closeParens = (pattern.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    return "Pattern has unbalanced parentheses";
  }

  // Test the pattern can be compiled
  try {
    new RegExp(pattern);
  } catch (error) {
    return `Invalid regex pattern: ${error}`;
  }

  return null; // Valid
};

/**
 * Failures command - show failed nodes with optional console output
 */
export const failuresCommand = (
  operations: BuildOperations,
  locator: string,
  options: FailuresOptions
): Effect.Effect<void, never> => {
  // Validate grep pattern if provided
  if (options.grep) {
    const validationError = validateGrepPattern(options.grep);
    if (validationError) {
      return Effect.sync(() => {
        console.error(red(`\nError: ${validationError}\n`));
        process.exit(1);
      });
    }
  }

  // Recursive is default unless --shallow is specified
  const useRecursive = !options.shallow;
  const getFailures = useRecursive
    ? operations.getFailureReportRecursive
    : operations.getFailureReport;

  // Determine if we need full console output
  const needsFullConsole = options.full ?? false;
  const needsExcerpt = !needsFullConsole && (options.tail !== undefined || options.grep !== undefined || options.smart);

  return pipe(
    getFailures(locator, needsFullConsole || needsExcerpt || false),
    Effect.map((failures) => {
      // Process console output based on flags
      const processedFailures = failures.map(failure => {
        if (!failure.consoleOutput) return failure;

        let processedOutput = failure.consoleOutput;

        // Smart mode: tail + grep for errors
        if (options.smart) {
          const lines = processedOutput.split('\n');
          const errorLines = lines.filter(line =>
            /error|fail|exception|fatal/i.test(line)
          );

          // Get last 100 lines + all error lines (deduplicated)
          const tail = lines.slice(-100);
          const combined = [...new Set([...errorLines, ...tail])];
          processedOutput = combined.join('\n');
        }
        // Grep mode
        else if (options.grep) {
          const regex = new RegExp(options.grep, 'i');
          const lines = processedOutput.split('\n');
          processedOutput = lines.filter(line => regex.test(line)).join('\n');
        }
        // Tail mode
        else if (options.tail !== undefined) {
          const lines = processedOutput.split('\n');
          processedOutput = lines.slice(-options.tail).join('\n');
        }

        return { ...failure, consoleOutput: processedOutput };
      });

      if (options.xml) {
        console.log(formatFailuresXml(processedFailures, {
          tail: options.tail,
          grep: options.grep,
          smart: options.smart,
        }));
      } else if (options.json) {
        console.log(formatFailuresJson(processedFailures));
      } else {
        console.log(
          formatFailures(processedFailures, {
            verbose: options.verbose,
            includeFull: needsFullConsole,
          })
        );
      }
    }),
    Effect.catchAll((error) =>
      Effect.sync(() => {
        console.error(red(`Error: ${error.message}`));
        if (options.verbose) {
          if ("cause" in error) {
            console.error(gray(`Cause: ${error.cause}`));
          }
          if ("url" in error && error.url) {
            console.error(gray(`URL: ${error.url}`));
          }
        }
        process.exit(1);
      })
    )
  );
};
