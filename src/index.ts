#!/usr/bin/env bun

import { Effect } from "effect";
import { parseArgs } from "./cli/args.ts";
import { routeCommand } from "./cli/router.ts";
import { red } from "./cli/formatters/colors.ts";

/**
 * Main entry point for Jenkins CLI
 */
const main = Effect.gen(function* () {
  const args = parseArgs(process.argv.slice(2));
  yield* routeCommand(args);
});

// Run the CLI with proper error handling
Effect.runPromise(
  main.pipe(
    Effect.catchAll((error) =>
      Effect.sync(() => {
        // Handle specific error types
        if (error._tag === "ConfigNotFoundError") {
          console.error(
            red("\nConfiguration not found. Please run 'jk setup' first.\n")
          );
        } else if (error._tag === "ConfigError") {
          console.error(red(`\nConfiguration error: ${error.message}\n`));
        } else {
          console.error(red(`\nError: ${error.message}\n`));
        }
        process.exit(1);
      })
    )
  )
).catch((error) => {
  // Catch any unexpected errors that slip through
  console.error("Unexpected error:", error);
  process.exit(1);
});
