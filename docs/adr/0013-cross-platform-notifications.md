# ADR 0013: Cross-Platform System Notifications

## Status

Accepted

## Context

The watch command needs to alert users when builds fail, even when terminal is not visible. Options:

1. **Terminal bell** - Works everywhere, not visible when backgrounded
2. **External library** - node-notifier, etc.
3. **Native commands** - osascript (macOS), notify-send (Linux)

## Decision

Use native system commands for notifications, no external dependencies.

- **macOS**: `osascript` with display notification
- **Linux**: `notify-send` (libnotify)
- **Windows/other**: Silently skip (non-critical feature)

## Rationale

- **No dependencies**: Native commands available on target platforms
- **Rich notifications**: Title, subtitle, body, sound
- **Non-blocking**: Fire and forget (notifications are non-critical)
- **Security**: No shell injection via spawn

## Consequences

### Positive
- Zero npm dependencies for notifications
- Native look and feel on each platform
- Sound support on macOS
- Non-blocking (doesn't slow down CLI)

### Negative
- Different capabilities per platform
- User must have notify-send on Linux
- No Windows support currently

## Implementation

```typescript
// platform/notifications.ts

export interface NotificationOptions {
  readonly title: string;
  readonly subtitle?: string;
  readonly body: string;
  readonly sound?: boolean;
}

export const notify = (options: NotificationOptions): Effect.Effect<void, never> =>
  Effect.sync(() => {
    try {
      if (process.platform === "darwin") {
        notifyMacOS(options);
      } else if (process.platform === "linux") {
        notifyLinux(options);
      }
      // Other platforms: silently skip
    } catch {
      // Non-critical, ignore errors
    }
  });

// macOS via osascript (stdin to avoid injection)
const notifyMacOS = (options: NotificationOptions): void => {
  const script = `display notification "${escapeAppleScript(options.body)}" ` +
                 `with title "${escapeAppleScript(options.title)}"` +
                 (options.subtitle ? ` subtitle "${escapeAppleScript(options.subtitle)}"` : "") +
                 (options.sound ? ` sound name "default"` : "");

  const proc = spawn("osascript", ["-"], {
    stdio: ["pipe", "ignore", "ignore"],
    detached: true,
  });
  proc.stdin.write(script);
  proc.stdin.end();
  proc.unref();
};

// Linux via notify-send (args passed directly, no shell)
const notifyLinux = (options: NotificationOptions): void => {
  const body = options.subtitle ? `${options.subtitle}\n${options.body}` : options.body;

  const proc = spawn("notify-send", [
    "--urgency=critical",
    "--app-name=jk",
    options.title,
    body,
  ], {
    stdio: "ignore",
    detached: true,
  });
  proc.unref();
};
```

## Security

```typescript
// AppleScript escaping
const escapeAppleScript = (s: string): string => {
  return s
    .replace(/\\/g, "\\\\")   // Backslashes first
    .replace(/"/g, '\\"')     // Double quotes
    .replace(/\n/g, "\\n")    // Newlines
    .replace(/\r/g, "\\r")    // Carriage returns
    .replace(/\t/g, "\\t");   // Tabs
};

// Script passed via stdin, not command args
spawn("osascript", ["-"], { stdio: ["pipe", ...] });
```

## Usage in Watch

```typescript
if (newFailures.length > 0 && !options.noNotify) {
  for (const failure of newFailures) {
    await Effect.runPromise(
      notify({
        title: "Jenkins Build Failed",
        subtitle: `${failure.pipeline} #${failure.buildId}`,
        body: `${failure.failedNodes.length} failed stages`,
        sound: true,
      })
    );
  }
}
```
