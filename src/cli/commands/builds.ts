import { Effect, pipe } from "effect";
import type { BuildOperations } from "../../lib/jenkins/operations.ts";
import { formatDuration } from "../formatters/duration.ts";
import { formatBuildsXml, formatBuildsJson } from "../formatters/xml.ts";
import { red, green, yellow, gray, bold } from "../formatters/colors.ts";
import { EXIT_CODES, getExitCodeForError } from "../../lib/effects/exit-codes.ts";

/**
 * Builds command - list recent builds for a job
 */
export const buildsCommand = (
  operations: BuildOperations,
  locator: string,
  options: {
    limit: number;
    verbose?: boolean;
    xml?: boolean;
    json?: boolean;
    urls?: boolean;
    format?: "json" | "xml";
  }
): Effect.Effect<void, never> =>
  pipe(
    operations.getBuilds(locator, options.limit),
    Effect.map((builds) => {
      // Determine output format (--format takes precedence, then --json/--xml flags)
      const outputFormat = options.format ?? (options.json ? "json" : options.xml ? "xml" : "human");

      if (builds.length === 0) {
        if (!options.urls) {
          if (outputFormat === "xml") {
            console.log(formatBuildsXml([]));
          } else if (outputFormat === "json") {
            console.log(formatBuildsJson([]));
          } else {
            console.log(yellow("No builds found."));
          }
        }
        return;
      }

      if (options.urls) {
        for (const build of builds) {
          console.log(build._links.self.href);
        }
        return;
      }

      if (outputFormat === "xml") {
        console.log(formatBuildsXml(builds));
        return;
      }

      if (outputFormat === "json") {
        console.log(formatBuildsJson(builds));
        return;
      }

      console.log(bold(`\nRecent Builds:\n`));

      for (const build of builds) {
        const statusIcon =
          build.result === "SUCCESS"
            ? green("✓")
            : build.result === "FAILURE"
              ? red("✗")
              : build.result === "UNSTABLE"
                ? yellow("⚠")
                : gray("○");

        const resultText =
          build.result === "SUCCESS"
            ? green(build.result)
            : build.result === "FAILURE"
              ? red(build.result)
              : build.result === "UNSTABLE"
                ? yellow(build.result)
                : gray(build.state);

        const duration = build.durationInMillis
          ? formatDuration(build.durationInMillis)
          : "-";

        console.log(`  ${statusIcon} #${build.id}  ${resultText}  ${duration}`);
        console.log(gray(`    → ${build._links.self.href}`));

        if (options.verbose && build.changeSet?.length) {
          const commit = build.changeSet[0];
          console.log(
            gray(`    ${commit.commitId.slice(0, 7)} ${commit.msg.slice(0, 50)}`)
          );
        }
      }

      console.log("");
    }),
    Effect.catchAll((error) =>
      Effect.sync(() => {
        console.error(red(`Error: ${error.message}`));
        if (options.verbose && "url" in error && error.url) {
          console.error(gray(`URL: ${error.url}`));
        }
        const exitCode = "_tag" in error ? getExitCodeForError(error) : EXIT_CODES.INTERNAL_ERROR;
        process.exit(exitCode);
      })
    )
  );
