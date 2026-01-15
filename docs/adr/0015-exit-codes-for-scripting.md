# ADR 0015: Semantic Exit Codes for Scripting

## Status

Accepted

## Context

CLI tools return exit codes to indicate success/failure. Need a strategy for:

- Normal success (no failures found)
- Failures found (expected, but build failed)
- Errors (unexpected problems)
- Different error types

## Decision

Use semantic exit codes that distinguish between "failures found" and "execution errors".

## Exit Codes

| Code | Name | Meaning |
|------|------|---------|
| 0 | SUCCESS | Command succeeded, no failures |
| 1 | FAILURES_FOUND | Build failures found (expected) |
| 2 | CONFIG_ERROR | Configuration problem |
| 3 | NETWORK_ERROR | Network/HTTP error |
| 4 | AUTH_ERROR | Authentication failed |
| 5 | NOT_FOUND | Build/node not found |
| 6 | VALIDATION_ERROR | Invalid data/response |
| 7 | INVALID_INPUT | Bad arguments/locator |
| 99 | INTERNAL_ERROR | Unexpected error |

## Rationale

- **Scriptability**: Scripts can distinguish failure types
- **CI integration**: Different handling for "failures found" vs "tool error"
- **Debugging**: Exit code hints at problem category
- **Standard practice**: Non-zero for errors, but differentiated

## Consequences

### Positive
- Scripts can handle different scenarios
- CI pipelines can distinguish tool errors from build failures
- Easy to check specific failure types
- Self-documenting exit status

### Negative
- More complex than simple 0/1
- Need to document all codes
- Some scripts may only check `!= 0`

## Implementation

```typescript
// lib/effects/exit-codes.ts
export const EXIT_CODES = {
  SUCCESS: 0,
  FAILURES_FOUND: 1,
  CONFIG_ERROR: 2,
  NETWORK_ERROR: 3,
  AUTH_ERROR: 4,
  NOT_FOUND: 5,
  VALIDATION_ERROR: 6,
  INVALID_INPUT: 7,
  INTERNAL_ERROR: 99,
} as const;

export const getExitCodeForError = (error: { _tag: string }): number => {
  switch (error._tag) {
    case "ConfigError":
    case "ConfigNotFoundError":
      return EXIT_CODES.CONFIG_ERROR;
    case "NetworkError":
      return EXIT_CODES.NETWORK_ERROR;
    case "AuthenticationError":
      return EXIT_CODES.AUTH_ERROR;
    case "BuildNotFoundError":
    case "NodeNotFoundError":
      return EXIT_CODES.NOT_FOUND;
    case "ValidationError":
      return EXIT_CODES.VALIDATION_ERROR;
    case "InvalidLocatorError":
      return EXIT_CODES.INVALID_INPUT;
    default:
      return EXIT_CODES.INTERNAL_ERROR;
  }
};
```

## Usage in Commands

```typescript
// commands/failures.ts
Effect.map((failures) => {
  // Output formatting...

  // Exit code based on whether failures were found
  if (processedFailures.length > 0) {
    process.exit(EXIT_CODES.FAILURES_FOUND);
  }
  // Implicit exit 0 (SUCCESS)
}),
Effect.catchAll((error) =>
  Effect.sync(() => {
    console.error(red(`Error: ${error.message}`));
    const exitCode = getExitCodeForError(error);
    process.exit(exitCode);
  })
)
```

## Script Examples

```bash
# Check if failures were found
jk failures <build>
if [ $? -eq 1 ]; then
  echo "Build has failures"
fi

# Handle specific error types
jk failures <build>
case $? in
  0) echo "No failures" ;;
  1) echo "Failures found" ;;
  3) echo "Network error - retry?" ;;
  4) echo "Auth error - check credentials" ;;
  5) echo "Build not found" ;;
  *) echo "Other error: $?" ;;
esac

# CI integration: fail on tool errors, not on "failures found"
jk failures <build> --xml > failures.xml
exit_code=$?
if [ $exit_code -gt 1 ]; then
  echo "Tool error, failing CI"
  exit 1
fi
# Exit 0 or 1 both ok for CI
```
