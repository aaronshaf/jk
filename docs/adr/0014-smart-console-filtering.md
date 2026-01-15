# ADR 0014: Smart Console Output Filtering

## Status

Accepted

## Context

Jenkins console output can be thousands of lines, mostly noise. LLMs have context limits and work better with focused input. Options:

1. **Full output** - Everything, let user filter
2. **Tail only** - Last N lines
3. **Grep only** - Pattern matching
4. **Smart mode** - Combination of heuristics

## Decision

Implement `--smart` flag that combines tail and error pattern extraction for optimal LLM consumption.

**Smart mode formula**: Last 100 lines + all lines matching error patterns

## Rationale

- **LLM optimization**: Focused context improves AI analysis
- **Error surfacing**: Important errors appear anywhere in output
- **Context preservation**: Tail provides recent execution context
- **Single flag**: One option for common use case

## Consequences

### Positive
- Compact output suitable for LLMs
- Captures errors anywhere in log
- Recent context preserved
- Simple to use (`--smart`)

### Negative
- May miss some relevant context
- Heuristic patterns may have false positives/negatives
- Fixed 100-line tail may not suit all cases

## Console Output Modes

| Mode | Flag | Behavior |
|------|------|----------|
| None | (default) | Metadata only, no console |
| Full | `--full` | Complete console output |
| Tail | `--tail N` | Last N lines |
| Grep | `--grep PATTERN` | Lines matching pattern |
| Smart | `--smart` | Tail 100 + error lines |

## Implementation

```typescript
// commands/failures.ts
if (options.smart) {
  const lines = processedOutput.split('\n');

  // Extract error lines from anywhere
  const errorLines = lines.filter(line =>
    /error|fail|exception|fatal/i.test(line)
  );

  // Get last 100 lines
  const tail = lines.slice(-100);

  // Combine and deduplicate
  const combined = [...new Set([...errorLines, ...tail])];
  processedOutput = combined.join('\n');
}
```

## Error Patterns

```typescript
// Case-insensitive matching
/error|fail|exception|fatal/i
```

**Matches**:
- `ERROR: Build failed`
- `FAILURE in test suite`
- `Exception: NullPointerException`
- `FATAL: Cannot connect`

## Usage Examples

```bash
# Basic failures (no console)
jk failures <build>

# Smart mode for LLM
jk failures --smart --xml <build>

# Full console for manual inspection
jk failures --full <build>

# Custom tail
jk failures --tail 200 --xml <build>

# Pattern search
jk failures --grep "TypeScript|ESLint" --xml <build>
```

## Workflow Integration

```bash
# Get smart analysis and pipe to Claude
jk failures --smart --xml <build> | claude "Analyze these test failures"

# Copy to clipboard for AI paste
jk failures --smart --xml <build> | pbcopy
```

## Watch Command Integration

The watch command uses smart mode when copying failures:

```typescript
const copyFailure = async (failure: FailedBuild) => {
  const failures = await getFailureReportRecursive(failure.locator, true);

  // Apply smart filtering
  const processed = failures.map(f => {
    if (!f.consoleOutput) return f;
    const lines = f.consoleOutput.split('\n');
    const errorLines = lines.filter(l => /error|fail|exception|fatal/i.test(l));
    const tail = lines.slice(-100);
    return { ...f, consoleOutput: [...new Set([...errorLines, ...tail])].join('\n') };
  });

  const xml = formatFailuresXml(processed, { smart: true });
  await copyToClipboard(xml);
};
```
