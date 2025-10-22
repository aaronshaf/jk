import { Effect, pipe } from "effect";
import type { BuildOperations } from "../../lib/jenkins/operations.ts";
import { formatDuration } from "../formatters/duration.ts";
import { formatBuildNodesXml } from "../formatters/xml.ts";
import { red, green, yellow, gray, bold } from "../formatters/colors.ts";

/**
 * Build command - get build information
 */
export const buildCommand = (
  operations: BuildOperations,
  locator: string,
  options: {
    verbose?: boolean;
    xml?: boolean;
  }
): Effect.Effect<void, never> =>
  pipe(
    operations.getBuildNodes(locator),
    Effect.map((nodes) => {
      if (nodes.length === 0) {
        console.log(options.xml ? formatBuildNodesXml([]) : yellow("No nodes found for this build."));
        return;
      }

      // XML output
      if (options.xml) {
        console.log(formatBuildNodesXml(nodes));
        return;
      }

      // Human-readable output
      console.log(bold(`\nBuild Information:\n`));

      for (const node of nodes) {
        const statusIcon =
          node.result === "SUCCESS"
            ? green("✓")
            : node.result === "FAILURE"
              ? red("✗")
              : node.result === "UNSTABLE"
                ? yellow("⚠")
                : gray("○");

        const resultText =
          node.result === "SUCCESS"
            ? green(node.result)
            : node.result === "FAILURE"
              ? red(node.result)
              : node.result === "UNSTABLE"
                ? yellow(node.result)
                : gray(node.state);

        console.log(`  ${statusIcon} ${node.displayName} - ${resultText}`);

        if (options.verbose) {
          console.log(gray(`     ID: ${node.id}`));
          console.log(gray(`     State: ${node.state}`));
          if (node.durationInMillis) {
            console.log(
              gray(`     Duration: ${formatDuration(node.durationInMillis)}`)
            );
          }
        }
      }

      console.log("");

      const failureCount = nodes.filter(
        (n) => n.result === "FAILURE"
      ).length;
      const successCount = nodes.filter(
        (n) => n.result === "SUCCESS"
      ).length;

      console.log(bold("Summary:"));
      console.log(`  Total nodes: ${nodes.length}`);
      console.log(`  ${green("Successful:")} ${successCount}`);
      console.log(`  ${red("Failed:")} ${failureCount}`);
      console.log("");
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
