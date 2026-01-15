# ADR 0012: Watch Command with Keyboard Controls

## Status

Accepted

## Context

Need a way to monitor Jenkins pipelines for new failures over time. Options:

1. **Simple loop** - Poll and print, no interactivity
2. **Interactive TUI** - Full terminal UI library
3. **Lightweight interactive** - Raw mode keyboard handling

## Decision

Implement `watch` command with lightweight raw-mode keyboard controls.

## Rationale

- **No dependencies**: Raw stdin handling, no TUI library
- **Interactive features**: Select failures, copy to clipboard, refresh
- **Notifications**: System notifications on new failures
- **Low overhead**: Minimal screen redraws

## Consequences

### Positive
- Interactive without heavy dependencies
- System notifications alert user
- Keyboard controls for common actions
- Flicker-free display updates

### Negative
- Limited to simple UI
- Raw mode handling complexity
- Platform-specific notification code

## Features

### Keyboard Controls

| Key | Action |
|-----|--------|
| `j`/`k` or arrows | Navigate failure list |
| `c` | Copy selected failure (smart XML) |
| `r` | Refresh immediately |
| `q` | Quit |

### Display

- Shows watched pipelines
- Countdown to next check
- Recent failures list (max 10)
- Selected failure highlighted

### Notifications

- macOS: osascript with sound
- Linux: notify-send

## Implementation

```typescript
// Raw mode setup
if (process.stdin.isTTY) {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  process.stdin.on("keypress", (str, key) => {
    if (key.name === "q" || (key.ctrl && key.name === "c")) {
      cleanup();
    } else if (key.name === "c") {
      copySelectedFailure();
    } else if (key.name === "up" || key.name === "k") {
      selectedIndex = Math.max(0, selectedIndex - 1);
      renderStatus();
    }
    // ...
  });
}

// Flicker-free rendering
const renderStatus = () => {
  const lines: string[] = [];
  // Build output...

  // Write all at once with cursor control
  process.stdout.write(
    HIDE_CURSOR +
    CURSOR_HOME +
    lines.join("\n") +
    "\n" +
    CLEAR_TO_END +
    SHOW_CURSOR
  );
};
```

## Usage

```bash
# Watch single pipeline
jk watch https://jenkins.example.com/job/Project/job/main/

# Watch multiple pipelines
jk watch \
  https://jenkins.example.com/job/Canvas/job/main-postmerge/ \
  https://jenkins.example.com/job/Canvas/job/nightly/

# Custom interval (30 seconds)
jk watch --interval 30 <pipeline>

# Silent mode (notifications only)
jk watch --quiet <pipeline>

# Disable notifications
jk watch --no-notify <pipeline>
```

## Copy to Clipboard

When user presses `c`:
1. Fetch recursive failures for selected build
2. Apply smart filtering (errors + tail 100)
3. Format as XML
4. Copy to system clipboard
5. Show confirmation message
