import { Effect } from "effect";
import { spawn } from "child_process";

/**
 * Cross-platform system notification support
 * - macOS: osascript (built-in)
 * - Linux: notify-send (libnotify)
 */

export interface NotificationOptions {
  readonly title: string;
  readonly subtitle?: string;
  readonly body: string;
  readonly sound?: boolean;
}

/**
 * Send a system notification
 */
export const notify = (
  options: NotificationOptions
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    const platform = process.platform;

    try {
      if (platform === "darwin") {
        notifyMacOS(options);
      } else if (platform === "linux") {
        notifyLinux(options);
      }
      // Windows/other platforms: silently skip
    } catch {
      // Silently ignore notification failures - they're non-critical
    }
  });

/**
 * Escape a string for use in AppleScript
 * Handles quotes, backslashes, and other special characters
 */
const escapeAppleScript = (s: string): string => {
  return s
    .replace(/\\/g, "\\\\")  // Backslashes first
    .replace(/"/g, '\\"')    // Double quotes
    .replace(/\n/g, "\\n")   // Newlines
    .replace(/\r/g, "\\r")   // Carriage returns
    .replace(/\t/g, "\\t");  // Tabs
};

/**
 * macOS notification via osascript
 * Uses stdin to pass script to avoid command injection via arguments
 */
const notifyMacOS = (options: NotificationOptions): void => {
  const { title, subtitle, body, sound = true } = options;

  // Build AppleScript - escape all user-provided strings
  let script = `display notification "${escapeAppleScript(body)}" with title "${escapeAppleScript(title)}"`;

  if (subtitle) {
    script += ` subtitle "${escapeAppleScript(subtitle)}"`;
  }

  if (sound) {
    script += ` sound name "default"`;
  }

  // Pass script via stdin to avoid shell interpretation issues
  const proc = spawn("osascript", ["-"], {
    stdio: ["pipe", "ignore", "ignore"],
    detached: true,
  });

  proc.stdin.write(script);
  proc.stdin.end();
  proc.unref();
};

/**
 * Linux notification via notify-send
 * Arguments are passed directly to spawn (no shell), so no injection risk
 */
const notifyLinux = (options: NotificationOptions): void => {
  const { title, subtitle, body } = options;

  // Combine subtitle and body for Linux (notify-send doesn't have subtitle)
  const fullBody = subtitle ? `${subtitle}\n${body}` : body;

  // Fire and forget - spawn bypasses shell, so no injection risk
  const proc = spawn(
    "notify-send",
    [
      "--urgency=critical",
      "--app-name=jk",
      title,
      fullBody,
    ],
    {
      stdio: "ignore",
      detached: true,
    }
  );
  proc.unref();
};
