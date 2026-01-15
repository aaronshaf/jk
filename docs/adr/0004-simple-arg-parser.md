# ADR 0004: Custom Argument Parser

## Status

Accepted

## Context

Need to parse command-line arguments. Options:

1. **Commander.js** - Full-featured, widely used
2. **Yargs** - Comprehensive, slightly heavier
3. **Custom parser** - Minimal, no dependencies

## Decision

Implement a simple custom argument parser with no external dependencies.

## Rationale

- **Zero dependencies**: No `commander`, `yargs`, or similar libraries
- **Simplicity**: jk has straightforward command structure
- **Control**: Full control over parsing behavior
- **Stdin handling**: Custom handling for pipe support
- **Smaller bundle**: No additional npm packages

## Consequences

### Positive
- No dependency vulnerabilities or updates
- Exact behavior we need, nothing more
- Stdin synchronous read handled correctly
- Simple maintenance

### Negative
- No advanced features (subcommands, autocomplete)
- Manual documentation of flags
- No automatic help generation

## Implementation

```typescript
// cli/args.ts
export interface ParsedArgs {
  command: string;
  positional: string[];
  flags: {
    verbose?: boolean;
    xml?: boolean;
    recursive?: boolean;
    tail?: number;
    grep?: string;
    smart?: boolean;
    // ...
  };
  stdin: string | null;
}

export const parseArgs = (argv: string[]): ParsedArgs => {
  const [command, ...rest] = argv;
  const flags = { /* defaults */ };
  const positional: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith("--")) {
      // Handle long flags
      const flag = arg.slice(2);
      if (flag === "verbose") flags.verbose = true;
      // ...
    } else if (arg.startsWith("-")) {
      // Handle short flags
    } else {
      positional.push(arg);
    }
  }

  // Read stdin synchronously at parse time
  const stdin = readStdin();

  return { command: command || "help", positional, flags, stdin };
};
```

## Supported Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--verbose` | `-v` | Show detailed errors |
| `--recursive` | `-r` | Traverse sub-builds |
| `--shallow` | | No sub-build traversal |
| `--xml` | | XML output |
| `--json` | | JSON output |
| `--tail N` | | Last N lines |
| `--grep PATTERN` | | Filter by pattern |
| `--smart` | | Smart error extraction |
| `--limit N` | | Max items to fetch |
