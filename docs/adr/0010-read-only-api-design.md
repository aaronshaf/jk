# ADR 0010: Read-Only API Design

## Status

Accepted

## Context

Jenkins API supports both read and write operations:

- **Read**: Get builds, nodes, console output
- **Write**: Trigger builds, cancel builds, replay

## Decision

jk is strictly read-only. No write operations to Jenkins are supported.

## Rationale

- **Security**: Read-only API token sufficient, reduces blast radius
- **Safety**: No accidental build triggers or cancellations
- **Simplicity**: Simpler security model, fewer edge cases
- **Use case**: Primary goal is inspection, not management
- **Auditability**: No actions that need to be logged

## Consequences

### Positive
- Can use read-only API tokens
- No risk of accidental destructive actions
- Simpler error handling (no write conflicts)
- Clear, focused purpose

### Negative
- Cannot trigger rebuilds from CLI
- Cannot cancel running builds
- Need separate tool for write operations

## Supported Operations (All Read-Only)

| Command | Operation |
|---------|-----------|
| `build` | GET build information and nodes |
| `builds` | GET recent builds for a job |
| `failures` | GET failed nodes with console output |
| `console` | GET console output for a node |
| `watch` | GET polling for new failures |

## API Token Requirements

Jenkins allows creating tokens with limited permissions. For jk:

1. Go to Jenkins > User > Configure > API Token
2. Generate token with **read-only** permissions
3. Use with jk (sufficient for all operations)

```bash
# All these only require read access
jk build <url>
jk failures --smart --xml <url>
jk console <node-url>
jk watch <job-url>
```

## Future Considerations

If write operations are ever needed, they should be:
1. In a separate tool or explicit opt-in
2. Require confirmation for destructive actions
3. Use separate API token with write permissions
