import { Effect, pipe } from "effect";
import * as readline from "readline";
import type { BuildOperations } from "../../lib/jenkins/operations.ts";
import type { BuildSummary, FailureReport } from "../../lib/jenkins/schemas.ts";
import { parseJobLocator } from "../../lib/jenkins/locator.ts";
import { notify } from "../../lib/platform/notifications.ts";
import { copyToClipboard } from "../../lib/platform/clipboard.ts";
import { formatFailuresXml } from "../formatters/xml.ts";
import { red, green, yellow, gray, cyan, bold } from "../formatters/colors.ts";

// ANSI escape codes for cursor control
const CURSOR_HOME = "\x1b[H";        // Move cursor to top-left
const CLEAR_SCREEN = "\x1b[2J";      // Clear entire screen
const CLEAR_TO_END = "\x1b[J";       // Clear from cursor to end of screen
const HIDE_CURSOR = "\x1b[?25l";     // Hide cursor
const SHOW_CURSOR = "\x1b[?25h";     // Show cursor

export interface WatchOptions {
  interval?: number;
  limit?: number;
  noNotify?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

interface PipelineState {
  locator: string;
  displayName: string;
  highWaterMark: number;
}

interface FailedBuild {
  locator: string;
  pipelineDisplayName: string;
  build: BuildSummary;
  failedNodes: string[];
}

// Constants
const COUNTDOWN_UPDATE_INTERVAL_MS = 1000;
const MAX_RECENT_FAILURES = 10;
const INITIAL_BUILDS_TO_FETCH = 30;
const SMART_TAIL_LINES = 100;
const UI_REFRESH_DELAY_MS = 1500;

/**
 * Sort failures by timestamp (oldest first, newest at bottom) and trim to max limit.
 * Modifies the array in place and returns the bounded selection index.
 */
const sortAndTrimFailures = (failures: FailedBuild[], currentIndex: number): number => {
  failures.sort((a, b) => {
    const timeA = a.build.startTime ? new Date(a.build.startTime).getTime() : 0;
    const timeB = b.build.startTime ? new Date(b.build.startTime).getTime() : 0;
    return timeA - timeB;
  });
  if (failures.length > MAX_RECENT_FAILURES) {
    failures.splice(0, failures.length - MAX_RECENT_FAILURES);
  }
  // Ensure selection index is within bounds
  return Math.max(0, Math.min(currentIndex, failures.length - 1));
};

/**
 * Watch command - monitor pipelines for failures
 */
export const watchCommand = (
  operations: BuildOperations,
  locators: string[],
  options: WatchOptions
): Effect.Effect<void, never> => {
  const intervalSeconds = options.interval ?? 60;
  const intervalMs = intervalSeconds * 1000;
  const limit = options.limit ?? 20;

  return Effect.async<void, never>((resume) => {
    const pipelineStates: PipelineState[] = [];
    const recentFailures: FailedBuild[] = [];
    let selectedIndex = 0;
    let lastCheckTime: Date | null = null;
    let nextCheckTime: Date | null = null;
    let isRunning = true;
    let isPolling = false;
    let hasPolledOnce = false;
    let pollIntervalId: ReturnType<typeof setInterval> | null = null;
    let countdownIntervalId: ReturnType<typeof setInterval> | null = null;

    // Event handler references for cleanup
    let keypressHandler: ((str: string, key: readline.Key) => void) | null = null;
    let sigintHandler: (() => void) | null = null;

    // Setup raw mode for keyboard input
    if (process.stdin.isTTY) {
      readline.emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
      process.stdin.resume();

      keypressHandler = (_str: string, key: readline.Key) => {
        if (!key) return;

        if (key.name === "q" || (key.ctrl && key.name === "c")) {
          cleanup();
          resume(Effect.void);
        } else if (key.name === "r") {
          // Immediate refresh (skip if already polling)
          if (!isPolling) {
            if (!options.quiet) {
              console.log(gray("\nRefreshing..."));
            }
            poll();
          }
        } else if (key.name === "c") {
          // Copy selected failure to clipboard
          if (recentFailures.length > 0 && selectedIndex < recentFailures.length) {
            copyFailure(recentFailures[selectedIndex], operations);
          } else {
            console.log(gray("\nNo failures to copy"));
          }
        } else if (key.name === "up" || key.name === "k") {
          // Move selection up
          if (recentFailures.length > 0) {
            selectedIndex = Math.max(0, selectedIndex - 1);
            renderStatus();
          }
        } else if (key.name === "down" || key.name === "j") {
          // Move selection down
          if (recentFailures.length > 0) {
            selectedIndex = Math.min(recentFailures.length - 1, selectedIndex + 1);
            renderStatus();
          }
        }
      };

      process.stdin.on("keypress", keypressHandler);
    }

    // Handle Ctrl+C gracefully
    sigintHandler = () => {
      cleanup();
      resume(Effect.void);
    };
    process.on("SIGINT", sigintHandler);

    let hasCleanedUp = false;

    const cleanup = (): void => {
      // Prevent multiple cleanups
      if (hasCleanedUp) return;
      hasCleanedUp = true;
      isRunning = false;

      if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
      }
      if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
      }
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        if (keypressHandler) {
          process.stdin.removeListener("keypress", keypressHandler);
          keypressHandler = null;
        }
      }
      if (sigintHandler) {
        process.removeListener("SIGINT", sigintHandler);
        sigintHandler = null;
      }
      // Restore cursor visibility
      process.stdout.write(SHOW_CURSOR);
      console.log(gray("\nStopped watching."));
    };

    const extractDisplayName = (locator: string): string => {
      // Extract a short display name from the locator
      // e.g., "https://jenkins.example.com/job/Canvas/job/main-postmerge/" -> "Canvas/main-postmerge"
      const jobMatch = locator.match(/\/job\/([^/]+(?:\/job\/[^/]+)*)/);
      if (jobMatch) {
        return jobMatch[1].replace(/\/job\//g, "/");
      }
      const pipelineMatch = locator.match(/pipelines\/(.+)/);
      if (pipelineMatch) {
        return pipelineMatch[1].replace(/\/$/, "");
      }
      return locator;
    };

    const formatTime = (date: Date): string => {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    };

    const formatCommitMessage = (build: BuildSummary): string => {
      if (build.changeSet?.length) {
        const msg = build.changeSet[0].msg;
        // Truncate to first line and max 50 chars
        const firstLine = msg.split("\n")[0];
        return firstLine.length > 50 ? firstLine.slice(0, 47) + "..." : firstLine;
      }
      if (build.causes?.length) {
        return build.causes[0].shortDescription;
      }
      return "";
    };

    const formatBuildTime = (build: BuildSummary): string => {
      if (!build.startTime) return "";
      const date = new Date(build.startTime);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();

      if (isToday) {
        // Just show time for today
        return date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      } else {
        // Show date and time for older builds
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      }
    };

    const renderStatus = (): void => {
      if (options.quiet) return;

      // Build output as array of lines, then write all at once
      const lines: string[] = [];

      lines.push(
        bold(`Watching ${pipelineStates.length} pipeline${pipelineStates.length > 1 ? "s" : ""} (polling every ${intervalSeconds}s)`)
      );

      for (const state of pipelineStates) {
        lines.push(`  ${cyan("•")} ${state.displayName} ${gray(`(last: #${state.highWaterMark})`)}`);
      }

      lines.push("");

      if (lastCheckTime && nextCheckTime) {
        const secondsUntilNext = Math.max(
          0,
          Math.ceil((nextCheckTime.getTime() - Date.now()) / 1000)
        );
        lines.push(
          `Last check: ${formatTime(lastCheckTime)} ${gray("|")} Next in ${secondsUntilNext}s`
        );
      } else {
        lines.push(gray("Initializing..."));
      }

      lines.push(gray(`[↑/↓] select | [c] copy | [r] refresh | [q] quit`));
      lines.push("");

      // Show recent failures or status message
      if (recentFailures.length > 0) {
        lines.push(gray("─".repeat(60)));
        for (let i = 0; i < recentFailures.length; i++) {
          const failure = recentFailures[i];
          const isSelected = i === selectedIndex;
          const commitMsg = formatCommitMessage(failure.build);
          const buildTime = formatBuildTime(failure.build);
          const prefix = isSelected ? cyan("▶") : " ";
          const timeStr = buildTime ? gray(`${buildTime}  `) : "";
          const lineContent = `${failure.pipelineDisplayName} ${bold(`#${failure.build.id}`)}  ${timeStr}${gray(`"${commitMsg}"`)}`;
          lines.push(
            `${prefix} ${red("●")} ${isSelected ? bold(lineContent) : lineContent}`
          );
          for (const nodeName of failure.failedNodes) {
            lines.push(`    ${red("✗")} ${nodeName}`);
          }
        }
        lines.push(gray("─".repeat(60)));
      } else if (hasPolledOnce) {
        lines.push(green("Watching for failures..."));
      } else {
        lines.push(gray("Connecting..."));
      }

      // Write all at once: move cursor home, hide cursor, write content, clear remaining, show cursor
      process.stdout.write(
        HIDE_CURSOR +
        CURSOR_HOME +
        lines.join("\n") +
        "\n" +
        CLEAR_TO_END +
        SHOW_CURSOR
      );
    };

    const checkPipeline = async (state: PipelineState): Promise<FailedBuild[]> => {
      const newFailures: FailedBuild[] = [];

      try {
        const result = await Effect.runPromise(
          pipe(
            operations.getBuilds(state.locator, limit),
            Effect.catchAll(() => Effect.succeed([] as BuildSummary[]))
          )
        );

        // Find new failed builds (id > highWaterMark and result === FAILURE)
        for (const build of result) {
          const buildId = parseInt(build.id, 10);
          if (isNaN(buildId)) continue;
          if (buildId > state.highWaterMark && build.result === "FAILURE") {
            // Get failed nodes for this build
            const buildLocator = `${state.locator.replace(/\/$/, "")}/${build.id}/`;
            const failedNodes = await getFailedNodeNames(operations, buildLocator);

            newFailures.push({
              locator: buildLocator,
              pipelineDisplayName: state.displayName,
              build,
              failedNodes,
            });
          }
        }

        // Update high water mark to latest build
        if (result.length > 0) {
          const buildIds = result
            .map((b) => parseInt(b.id, 10))
            .filter((id) => !isNaN(id));
          if (buildIds.length > 0) {
            state.highWaterMark = Math.max(...buildIds);
          }
        }
      } catch {
        // Silently ignore errors during polling
      }

      return newFailures;
    };

    const getFailedNodeNames = async (
      ops: BuildOperations,
      locator: string
    ): Promise<string[]> => {
      try {
        const nodes = await Effect.runPromise(
          pipe(
            ops.getBuildNodes(locator),
            Effect.catchAll(() => Effect.succeed([]))
          )
        );
        return nodes
          .filter((n) => n.result === "FAILURE")
          .map((n) => n.displayName);
      } catch {
        return [];
      }
    };

    const poll = async (): Promise<void> => {
      if (!isRunning || isPolling) return;

      isPolling = true;

      try {
        const allNewFailures: FailedBuild[] = [];

        for (const state of pipelineStates) {
          const failures = await checkPipeline(state);
          allNewFailures.push(...failures);
        }

        // Send notifications for new failures
        if (allNewFailures.length > 0 && !options.noNotify) {
          for (const failure of allNewFailures) {
            const commitMsg = formatCommitMessage(failure.build);
            const failureCount =
              failure.failedNodes.length > 0
                ? `${failure.failedNodes.length} failed stage${failure.failedNodes.length > 1 ? "s" : ""}`
                : "Build failed";

            await Effect.runPromise(
              notify({
                title: "Jenkins Build Failed",
                subtitle: `${failure.pipelineDisplayName} #${failure.build.id}`,
                body: commitMsg ? `"${commitMsg}"\n${failureCount}` : failureCount,
                sound: true,
              })
            );
          }

          // Add to recent failures list, sort, trim, and reset selection to newest
          recentFailures.push(...allNewFailures);
          selectedIndex = sortAndTrimFailures(recentFailures, recentFailures.length - 1);
        }

        hasPolledOnce = true;
        lastCheckTime = new Date();
        nextCheckTime = new Date(Date.now() + intervalMs);
        renderStatus();
      } finally {
        isPolling = false;
      }
    };

    const copyFailure = async (
      failure: FailedBuild,
      ops: BuildOperations
    ): Promise<void> => {
      console.log(gray(`\nFetching failure details for #${failure.build.id}...`));

      try {
        // Get smart failure report
        const failures = await Effect.runPromise(
          pipe(
            ops.getFailureReportRecursive(failure.locator, true),
            Effect.catchAll(() => Effect.succeed([] as FailureReport[]))
          )
        );

        // Process with smart filtering (same as failures --smart)
        const processedFailures = failures.map((f) => {
          if (!f.consoleOutput) return f;

          const lines = f.consoleOutput.split("\n");
          const errorLines = lines.filter((line) =>
            /error|fail|exception|fatal/i.test(line)
          );
          const tail = lines.slice(-SMART_TAIL_LINES);
          const combined = [...new Set([...errorLines, ...tail])];

          return { ...f, consoleOutput: combined.join("\n") };
        });

        // Format as XML
        const xml = formatFailuresXml(processedFailures, { smart: true });

        // Copy to clipboard
        const success = await Effect.runPromise(copyToClipboard(xml));

        if (success) {
          console.log(
            green(`✓ Copied failures for #${failure.build.id} to clipboard`)
          );
        } else {
          console.log(
            yellow(`⚠ Could not copy to clipboard (xclip/pbcopy not available)`)
          );
        }
      } catch {
        console.log(red(`✗ Failed to fetch failure details`));
      }

      // Re-render after a moment
      setTimeout(renderStatus, UI_REFRESH_DELAY_MS);
    };

    // Initialize pipeline states
    const initialize = async (): Promise<void> => {
      // Clear screen once at startup
      if (!options.quiet) {
        process.stdout.write(CLEAR_SCREEN + CURSOR_HOME);
        console.log(gray("Initializing watch..."));
      }

      for (const locator of locators) {
        const displayName = extractDisplayName(locator);

        // Validate the locator first
        const validateResult = await Effect.runPromise(
          pipe(
            parseJobLocator(locator),
            Effect.map(() => true),
            Effect.catchAll(() => Effect.succeed(false))
          )
        );

        if (!validateResult) {
          console.error(red(`Invalid pipeline locator: ${locator}`));
          continue;
        }

        // Get recent builds to establish high water mark and show initial failures
        const builds = await Effect.runPromise(
          pipe(
            operations.getBuilds(locator, INITIAL_BUILDS_TO_FETCH),
            Effect.catchAll(() => Effect.succeed([] as BuildSummary[]))
          )
        );

        const highWaterMark =
          builds.length > 0 ? parseInt(builds[0].id, 10) : 0;

        pipelineStates.push({
          locator,
          displayName,
          highWaterMark,
        });

        // Collect initial failures from recent builds
        const failedBuilds = builds.filter((b) => b.result === "FAILURE");
        for (const build of failedBuilds) {
          const buildLocator = `${locator.replace(/\/$/, "")}/${build.id}/`;
          const failedNodes = await getFailedNodeNames(operations, buildLocator);
          recentFailures.push({
            locator: buildLocator,
            pipelineDisplayName: displayName,
            build,
            failedNodes,
          });
        }
      }

      // Sort, trim, and default selection to newest
      selectedIndex = sortAndTrimFailures(recentFailures, recentFailures.length - 1);

      if (pipelineStates.length === 0) {
        console.error(red("No valid pipelines to watch"));
        cleanup();
        resume(Effect.void);
        return;
      }

      // Mark as polled since we've loaded initial data
      hasPolledOnce = true;
      lastCheckTime = new Date();
      nextCheckTime = new Date(Date.now() + intervalMs);

      // Initial render
      renderStatus();

      // Start polling interval
      pollIntervalId = setInterval(poll, intervalMs);

      // Start countdown timer update (every second)
      countdownIntervalId = setInterval(() => {
        if (isRunning && !isPolling && !options.quiet) {
          renderStatus();
        }
      }, COUNTDOWN_UPDATE_INTERVAL_MS);
    };

    initialize().catch((error) => {
      console.error(red(`Failed to initialize watch: ${error}`));
      cleanup();
      resume(Effect.void);
    });
  });
};
