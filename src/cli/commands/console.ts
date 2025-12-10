import { Effect, pipe } from "effect";
import type { BuildOperations } from "../../lib/jenkins/operations.ts";
import { parseNodeUrl } from "../../lib/jenkins/locator.ts";
import { red, gray } from "../formatters/colors.ts";
import { EXIT_CODES, getExitCodeForError } from "../../lib/effects/exit-codes.ts";

/**
 * Console command - get console output for a specific node
 * Supports two formats:
 * 1. Traditional: jk console <locator> <node-id>
 * 2. Blue Ocean URL: jk console <blue-ocean-node-url>
 */
export const consoleCommand = (
  operations: BuildOperations,
  locator: string,
  nodeId: string | undefined,
  verbose: boolean
): Effect.Effect<void, never> => {
  // If nodeId is not provided, try to parse locator as a Blue Ocean node URL
  if (!nodeId) {
    return pipe(
      parseNodeUrl(locator),
      Effect.flatMap(({ pipelineInfo, nodeId: extractedNodeId }) => {
        const locatorString = `${pipelineInfo.path}/${pipelineInfo.buildNumber}`;
        return operations.getNodeConsole(locatorString, extractedNodeId);
      }),
      Effect.map((output) => {
        console.log(output);
      }),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.error(red(`Error: ${error.message}`));
          if (verbose) {
            if ("cause" in error) {
              console.error(gray(`Cause: ${error.cause}`));
            }
            if ("url" in error && error.url) {
              console.error(gray(`URL: ${error.url}`));
            }
          }
          const exitCode = "_tag" in error ? getExitCodeForError(error) : EXIT_CODES.INTERNAL_ERROR;
          process.exit(exitCode);
        })
      )
    );
  }

  // Traditional format: locator + nodeId
  return pipe(
    operations.getNodeConsole(locator, nodeId),
    Effect.map((output) => {
      // Output raw console text (no formatting for pipeable output)
      console.log(output);
    }),
    Effect.catchAll((error) =>
      Effect.sync(() => {
        console.error(red(`Error: ${error.message}`));
        if (verbose) {
          if ("cause" in error) {
            console.error(gray(`Cause: ${error.cause}`));
          }
          if ("url" in error && error.url) {
            console.error(gray(`URL: ${error.url}`));
          }
        }
        const exitCode = "_tag" in error ? getExitCodeForError(error) : EXIT_CODES.INTERNAL_ERROR;
        process.exit(exitCode);
      })
    )
  );
};
