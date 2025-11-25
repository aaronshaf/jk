import { Effect, pipe } from "effect";
import type { BuildOperations } from "../../lib/jenkins/operations.ts";
import { formatDuration } from "../formatters/duration.ts";
import { formatBuildsXml } from "../formatters/xml.ts";
import { red, green, yellow, gray, bold } from "../formatters/colors.ts";

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
    urls?: boolean;
  }
): Effect.Effect<void, never> =>
  pipe(
    operations.getBuilds(locator, options.limit),
    Effect.map((builds) => {
      if (builds.length === 0) {
        if (!options.urls) {
          console.log(
            options.xml ? formatBuildsXml([]) : yellow("No builds found.")
          );
        }
        return;
      }

      if (options.urls) {
        for (const build of builds) {
          console.log(build._links.self.href);
        }
        return;
      }

      if (options.xml) {
        console.log(formatBuildsXml(builds));
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
        process.exit(1);
      })
    )
  );
