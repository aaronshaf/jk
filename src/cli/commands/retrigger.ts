import { Effect, pipe } from "effect";
import type { BuildOperations } from "../../lib/jenkins/operations.ts";
import { green, red, gray } from "../formatters/colors.ts";
import { escapeXml } from "../formatters/xml.ts";
import { getExitCodeForError } from "../../lib/effects/exit-codes.ts";

/**
 * Retrigger command - replay a build or restart from a specific stage
 */
export const retriggerCommand = (
  operations: BuildOperations,
  locator: string,
  stageName?: string,
  options: { xml?: boolean; verbose?: boolean } = {}
): Effect.Effect<void, never> =>
  pipe(
    operations.retriggerBuild(locator, stageName),
    Effect.map(() => {
      if (options.xml) {
        console.log('<?xml version="1.0" encoding="UTF-8"?>');
        console.log('<result status="ok" action="retrigger"/>');
      } else {
        console.log(green("✓ Retrigger queued"));
      }
    }),
    Effect.catchAll((error) =>
      Effect.sync(() => {
        if (options.xml) {
          console.error('<?xml version="1.0" encoding="UTF-8"?>');
          console.error(`<result status="error" action="retrigger">`);
          console.error(`  <message>${escapeXml(error.message)}</message>`);
          console.error(`</result>`);
        } else {
          console.error(red(`Error: ${error.message}`));
          if (options.verbose) {
            if ("url" in error && error.url) console.error(gray(`URL: ${error.url}`));
            if ("cause" in error && error.cause) console.error(gray(`Cause: ${error.cause}`));
          }
        }
        process.exit(getExitCodeForError(error));
      })
    )
  );
