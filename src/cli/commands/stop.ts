import { Effect, pipe } from "effect";
import type { BuildOperations } from "../../lib/jenkins/operations.ts";
import { green, red, gray } from "../formatters/colors.ts";
import { escapeXml } from "../formatters/xml.ts";
import { getExitCodeForError } from "../../lib/effects/exit-codes.ts";

/**
 * Stop command - abort a running build
 */
export const stopCommand = (
  operations: BuildOperations,
  locator: string,
  options: { xml?: boolean; verbose?: boolean } = {}
): Effect.Effect<void, never> =>
  pipe(
    operations.stopBuild(locator),
    Effect.map(() => {
      if (options.xml) {
        console.log('<?xml version="1.0" encoding="UTF-8"?>');
        console.log('<result status="ok" action="stop"/>');
      } else {
        console.log(green("✓ Build stopped"));
      }
    }),
    Effect.catchAll((error) =>
      Effect.sync(() => {
        if (options.xml) {
          console.error('<?xml version="1.0" encoding="UTF-8"?>');
          console.error(`<result status="error" action="stop">`);
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
