import { Effect } from "effect";
import { spawn } from "child_process";

/**
 * Cross-platform clipboard support
 * - macOS: pbcopy (built-in)
 * - Linux: xclip or xsel
 */

/**
 * Copy text to system clipboard
 * Returns success/failure silently
 */
export const copyToClipboard = (text: string): Effect.Effect<boolean, never> =>
  Effect.async<boolean, never>((resume) => {
    const platform = process.platform;
    let hasResumed = false;

    // Prevent double-resume when falling back from xclip to xsel
    const safeResume = (result: boolean): void => {
      if (!hasResumed) {
        hasResumed = true;
        resume(Effect.succeed(result));
      }
    };

    let command: string;
    let args: string[];

    if (platform === "darwin") {
      command = "pbcopy";
      args = [];
    } else if (platform === "linux") {
      // Try xclip first, fall back to xsel
      command = "xclip";
      args = ["-selection", "clipboard"];
    } else {
      // Unsupported platform
      safeResume(false);
      return;
    }

    const proc = spawn(command, args, {
      stdio: ["pipe", "ignore", "ignore"],
    });

    proc.on("error", () => {
      // xclip not found on Linux, try xsel
      if (platform === "linux" && command === "xclip") {
        const fallback = spawn("xsel", ["--clipboard", "--input"], {
          stdio: ["pipe", "ignore", "ignore"],
        });

        fallback.on("error", () => {
          safeResume(false);
        });

        fallback.on("close", (code) => {
          safeResume(code === 0);
        });

        fallback.stdin.write(text);
        fallback.stdin.end();
      } else {
        safeResume(false);
      }
    });

    proc.on("close", (code) => {
      safeResume(code === 0);
    });

    proc.stdin.write(text);
    proc.stdin.end();
  });
