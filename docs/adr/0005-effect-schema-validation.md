# ADR 0005: Effect Schema for Validation

## Status

Accepted

## Context

Need a strategy for validating external data (Jenkins API responses, config files). Options:

1. **Manual validation** - Type guards and assertions
2. **Zod** - Popular schema library
3. **Effect Schema** - Part of Effect ecosystem

## Decision

Use Effect Schema for all runtime validation.

## Rationale

- **Effect integration**: Natural fit with Effect error handling
- **Type inference**: Schema defines both runtime and compile-time types
- **Composable**: Schemas compose and transform naturally
- **Single ecosystem**: Already using Effect for error handling
- **Decode/encode**: Bidirectional transformation support

## Consequences

### Positive
- Single source of truth for types
- Runtime validation with compile-time type inference
- Detailed validation error messages
- Consistent with Effect error handling

### Negative
- Larger bundle than minimal validators
- Learning curve for Schema combinators
- Verbose for simple types

## Implementation

```typescript
// jenkins/schemas.ts

// Build result enum
export const BuildResultSchema = Schema.Literal(
  "SUCCESS", "FAILURE", "UNSTABLE", "ABORTED", "NOT_BUILT", "UNKNOWN"
);
export type BuildResult = Schema.Schema.Type<typeof BuildResultSchema>;

// Build node structure
export const BuildNodeSchema = Schema.Struct({
  id: Schema.String,
  displayName: Schema.String,
  result: Schema.optional(Schema.NullOr(BuildResultSchema)),
  state: BuildStateSchema,
  startTime: Schema.optional(Schema.NullOr(Schema.String)),
  durationInMillis: Schema.optional(Schema.NullOr(Schema.Number)),
  actions: Schema.Array(ActionSchema),
});
export type BuildNode = Schema.Schema.Type<typeof BuildNodeSchema>;

// Validation in client
const response = yield* client.getValidated(
  buildNodesApiPath(pipelineInfo),
  BuildNodesResponseSchema
);

// getValidated implementation
getValidated: <A, I>(path: string, schema: Schema.Schema<A, I, never>) =>
  pipe(
    makeRequest(config, path, "json"),
    Effect.flatMap((data) =>
      Schema.decodeUnknown(schema)(data).pipe(
        Effect.mapError((error) =>
          new ValidationError({
            message: `Failed to validate Jenkins API response: ${error}`,
          })
        )
      )
    )
  ),
```

## Config Schema

```typescript
// config/schema.ts
export const ConfigSchema = Schema.Struct({
  jenkinsUrl: Schema.optional(
    Schema.String.pipe(
      Schema.pattern(/^https?:\/\/.+/),
      Schema.annotations({
        title: "Jenkins Base URL",
        description: "Base URL of your Jenkins server",
      })
    )
  ),
  auth: AuthSchema,
});
```
