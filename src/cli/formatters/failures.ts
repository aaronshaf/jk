import type { FailureReport } from "../../lib/jenkins/schemas.ts";
import { red, yellow, gray, bold } from "./colors.ts";
import { ICON_FAILURE } from "./icons.ts";

/**
 * Format failure reports for display
 */

interface FormatOptions {
  verbose?: boolean;
  includeFull?: boolean;
}

/**
 * Format a single failure report
 */
export const formatFailure = (
  failure: FailureReport,
  options: FormatOptions = {}
): string => {
  const lines: string[] = [];

  // Display name and result
  lines.push(`  ${red(ICON_FAILURE)} ${bold(failure.displayName)} ${red("(FAILURE)")}`);

  // Node URL
  lines.push(`     ${gray(failure.url)}`);

  // Console output if included
  if (options.includeFull && failure.consoleOutput) {
    lines.push("");
    lines.push(gray("     --- Console Output ---"));
    const outputLines = failure.consoleOutput.split("\n");
    for (const line of outputLines) {
      lines.push(gray(`     ${line}`));
    }
    lines.push(gray("     --- End Output ---"));
  }

  return lines.join("\n");
};

/**
 * Format multiple failure reports grouped by build
 */
export const formatFailures = (
  failures: FailureReport[],
  options: FormatOptions = {}
): string => {
  if (failures.length === 0) {
    return `${bold("No failures found!")} 🎉`;
  }

  const lines: string[] = [];

  // Group failures by build
  const grouped = new Map<string, FailureReport[]>();
  for (const failure of failures) {
    const key = `${failure.pipeline}/${failure.buildNumber}`;
    const group = grouped.get(key);
    if (!group) {
      grouped.set(key, [failure]);
    } else {
      group.push(failure);
    }
  }

  // Format each group
  for (const [buildKey, buildFailures] of grouped) {
    const [pipeline, buildNum] = buildKey.split("/").slice(-2);
    lines.push("");
    lines.push(yellow(`For build ${pipeline}/${buildNum}:`));
    lines.push("");

    for (const failure of buildFailures) {
      lines.push(formatFailure(failure, options));
      lines.push("");
    }
  }

  return lines.join("\n");
};

/**
 * Format failures as JSON
 */
export const formatFailuresJson = (failures: FailureReport[]): string => {
  return JSON.stringify(failures, null, 2);
};
