import { Effect } from "effect";
import type { ParsedArgs } from "./args.ts";
import { readStdin } from "./args.ts";
import { readConfig } from "../lib/config/manager.ts";
import { createJenkinsClient } from "../lib/jenkins/client.ts";
import { createBuildOperations } from "../lib/jenkins/operations.ts";
import { setupCommand } from "./commands/setup.ts";
import { buildCommand } from "./commands/build.ts";
import { failuresCommand } from "./commands/failures.ts";
import { consoleCommand } from "./commands/console.ts";
import { showHelp } from "./commands/help.ts";
import { red } from "./formatters/colors.ts";
import type { AppError } from "../lib/effects/errors.ts";

/**
 * Route CLI commands to appropriate handlers
 */
export const routeCommand = (args: ParsedArgs): Effect.Effect<void, AppError> => {
  // Help flag or help command
  if (args.flags.help || args.command === "help") {
    showHelp(args.positional[0]);
    return Effect.void;
  }

  // Setup command doesn't require config
  if (args.command === "setup") {
    return setupCommand();
  }

  // All other commands require config
  if (
    args.command === "build" ||
    args.command === "failures" ||
    args.command === "console"
  ) {
    return Effect.gen(function* () {
      // Load config - let errors propagate
      const config = yield* readConfig();

      // Create Jenkins client and operations
      const client = yield* createJenkinsClient(config);
      const operations = createBuildOperations(client, config);

      // Try to read from stdin if no positional args
      const stdinInput = args.positional.length === 0 ? readStdin() : null;

      // Route to specific command
      if (args.command === "build") {
        const locator = args.positional[0] || stdinInput;
        if (!locator) {
          console.error(red("\nError: Missing required argument <locator>\n"));
          console.error(red("Provide via argument or pipe: echo '123' | jk build\n"));
          showHelp("build");
          process.exit(1);
        }
        return yield* buildCommand(
          operations,
          locator,
          {
            verbose: args.flags.verbose,
            xml: args.flags.xml,
          }
        );
      }

      if (args.command === "failures") {
        const locator = args.positional[0] || stdinInput;
        if (!locator) {
          console.error(red("\nError: Missing required argument <locator>\n"));
          console.error(red("Provide via argument or pipe: echo '123' | jk failures\n"));
          showHelp("failures");
          process.exit(1);
        }
        return yield* failuresCommand(operations, locator, {
          full: args.flags.full,
          recursive: args.flags.recursive,
          shallow: args.flags.shallow,
          json: args.flags.json,
          xml: args.flags.xml,
          verbose: args.flags.verbose,
          tail: args.flags.tail,
          grep: args.flags.grep,
          smart: args.flags.smart,
        });
      }

      if (args.command === "console") {
        const locator = args.positional[0] || stdinInput;
        if (!locator) {
          console.error(
            red("\nError: Missing required argument <locator> or <node-url>\n")
          );
          console.error(red("Provide via argument or pipe: echo 'url' | jk console\n"));
          showHelp("console");
          process.exit(1);
        }
        return yield* consoleCommand(
          operations,
          locator,
          args.positional[1], // undefined if not provided
          args.flags.verbose ?? false
        );
      }
    });
  }

  // Unknown command
  console.error(red(`\nError: Unknown command '${args.command}'\n`));
  showHelp();
  process.exit(1);
};
