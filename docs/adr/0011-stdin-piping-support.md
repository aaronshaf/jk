# ADR 0011: Stdin Piping Support

## Status

Accepted

## Context

CLI tools in Unix pipelines receive input via stdin. Need to support:

```bash
echo "url" | jk failures
pbpaste | jk console
ger extract-url "build-summary" | jk failures
```

## Decision

All commands that accept a locator can read it from stdin if no positional argument is provided.

## Rationale

- **Unix philosophy**: Programs should work in pipelines
- **Workflow integration**: Chain with other tools (ger, pbpaste)
- **Copy-paste friendly**: Paste URLs without shell quoting issues
- **Scripting**: Easy to build automated workflows

## Consequences

### Positive
- Works in pipelines with `|`
- Copy-paste from browser works
- Integration with other CLI tools
- Scriptable workflows

### Negative
- Synchronous stdin read blocks startup
- Need to handle pipe race conditions
- Cannot mix stdin and positional args

## Implementation

```typescript
// cli/args.ts
export const readStdin = (): string | null => {
  // If interactive terminal, no stdin
  if (process.stdin.isTTY) {
    return null;
  }

  // Handle pipe race condition with retry
  const maxRetries = 10;
  const retryDelayMs = 10;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const buffer = fs.readFileSync(0, "utf-8");
      const trimmed = buffer.trim();
      return trimmed.length > 0 ? trimmed : null;
    } catch (error: any) {
      // EAGAIN: stdin not ready yet
      if (error.code === "EAGAIN" && attempt < maxRetries - 1) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, retryDelayMs);
        continue;
      }
      return null;
    }
  }
  return null;
};

// Read stdin at parse time (before async operations)
export const parseArgs = (argv: string[]): ParsedArgs => {
  // ...
  const stdin = readStdin();
  return { command, positional, flags, stdin };
};
```

## Usage Patterns

```bash
# Direct argument
jk failures https://jenkins.example.com/job/Project/123/

# From stdin
echo "https://jenkins.example.com/job/Project/123/" | jk failures

# From clipboard (macOS)
pbpaste | jk failures --smart --xml

# From other tools
ger extract-url "build-summary" | tail -1 | jk failures --smart --xml

# Chain multiple commands
jk builds --urls <job> | head -1 | jk failures --xml
```

## Router Logic

```typescript
// cli/router.ts
if (args.command === "failures") {
  // Use stdin if no positional args
  const locator = args.positional[0] || args.stdin;
  if (!locator) {
    console.error(red("Error: Missing required argument <build>"));
    console.error(red("Provide via argument or pipe: echo 'url' | jk failures"));
    process.exit(1);
  }
  return yield* failuresCommand(operations, locator, options);
}
```
