# ADR 0001: Use Effect for Error Handling

## Status

Accepted

## Context

We need to decide on a strategy for handling side effects (API calls, file I/O, errors) in the `jk` CLI. Options considered:

1. **Traditional try/catch** - Simple but errors lose type information
2. **Result types (manual)** - Explicit but verbose
3. **Effect library** - Type-safe, composable operations with error tracking

## Decision

Use the Effect library for all async operations and error handling.

## Rationale

- **Type-safe errors**: Effect tracks error types at compile time via tagged unions
- **Composability**: Operations compose naturally with `Effect.gen` and `pipe()`
- **Error propagation**: Errors flow through the pipeline with full type information
- **Retry logic**: Built-in support for retries and timeouts
- **Consistent patterns**: Matches other tools in the ecosystem (ger, cn)

## Consequences

### Positive
- Compile-time error tracking with `Effect.catchTag`
- Clear error handling paths without try/catch
- No runtime surprises from unhandled errors
- Typed error union (`AppError`) documents all possible failures

### Negative
- Learning curve for Effect newcomers
- Additional dependency (~100KB)
- More verbose than simple async/await
- Requires understanding of functional programming patterns

## Example

```typescript
// Tagged error types
export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly message: string;
  readonly url?: string;
  readonly statusCode?: number;
}> {}

// Effect-based operation
export const getBuildNodes = (locator: string): Effect.Effect<
  BuildNode[],
  InvalidLocatorError | NetworkError | AuthenticationError | ValidationError
> =>
  pipe(
    parseLocator(locator),
    Effect.flatMap((pipelineInfo) =>
      client.getValidated(buildNodesApiPath(pipelineInfo), BuildNodesResponseSchema)
    )
  );

// Handle specific error types
Effect.catchTag("NetworkError", (error) =>
  Effect.sync(() => console.error(`Network issue: ${error.message}`))
)
```
