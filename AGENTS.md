# Agent Instructions for jk CLI

> Instructions for AI code assistants (Claude Code, GitHub Copilot, etc.)

## Project Overview

**jk** is a fast, API-driven Jenkins CLI built with:
- **Bun** (runtime and package manager)
- **TypeScript** (strict mode)
- **Effect** (functional error handling and composition)
- **Effect Schema** (runtime validation)

Inspired by prior CLI work done by Evan Battaglia.

### Core Philosophy

1. **API-First**: Direct Jenkins Blue Ocean API calls for always-fresh data (no local state)
2. **Read-Only**: Inspect builds, don't modify them (security by design)
3. **Effect-First**: All operations use Effect for type-safe error handling
4. **Human & LLM Outputs**: Colored terminal output by default, XML output (`--xml`) for LLMs
5. **Security-Focused**: Path sanitization, input validation, secure credential storage

## Project Structure

```
src/
├── index.ts                     # CLI entry point (shebang, arg parsing, routing)
├── cli/
│   ├── args.ts                  # Simple argument parser (no external deps)
│   ├── router.ts                # Command router with config loading
│   ├── commands/                # Command implementations (all use Effect)
│   │   ├── setup.ts             # Interactive setup wizard
│   │   ├── build.ts             # Display build information
│   │   ├── failures.ts          # Show failures (with --recursive for sub-builds)
│   │   ├── console.ts           # Get console output (pipeable)
│   │   └── help.ts              # Help text
│   └── formatters/              # Output formatting
│       ├── colors.ts            # ANSI color codes
│       ├── duration.ts          # Time formatting utilities
│       ├── failures.ts          # Failure report formatting (human-readable)
│       └── xml.ts               # XML formatting for LLM consumption
└── lib/
    ├── config/
    │   ├── schema.ts            # Config schema (Effect Schema)
    │   ├── manager.ts           # Config CRUD + XDG support + path validation
    │   └── wizard.ts            # Interactive setup prompts
    ├── jenkins/
    │   ├── schemas.ts           # Blue Ocean API response schemas
    │   ├── client.ts            # HTTP client with Basic Auth
    │   ├── locator.ts           # URL/path parsing with security validation
    │   └── operations.ts        # Build operations (all return Effect)
    └── effects/
        └── errors.ts            # Typed error hierarchy (Data.TaggedError)
```

## Key Design Decisions

### 1. Effect-Based Architecture

**All async operations use Effect** for composable, type-safe error handling:

```typescript
// ✅ Correct: Use Effect with explicit error types
const getBuildNodes = (locator: string): Effect.Effect<
  BuildNode[],
  InvalidLocatorError | NetworkError | AuthenticationError | ValidationError
> =>
  pipe(
    parseLocator(locator),
    Effect.flatMap((pipelineInfo) =>
      client.getValidated(buildNodesApiPath(pipelineInfo), BuildNodesResponseSchema)
    )
  );

// ❌ Incorrect: Don't use raw Promises
const getBuildNodes = async (locator: string): Promise<BuildNode[]> => {
  // Loses type-safe error handling
};
```

### 2. Schema Validation

**All external data validated with Effect Schema**:

```typescript
// ✅ Define schemas for API responses
export const BuildNodeSchema = Schema.Struct({
  id: Schema.String,
  displayName: Schema.String,
  result: Schema.optional(BuildResultSchema),
  state: BuildStateSchema,
  startTime: Schema.optional(Schema.String),
  durationInMillis: Schema.optional(Schema.Number),
  actions: Schema.Array(ActionSchema),
});

// ✅ Validate with schema
const nodes = yield* Schema.decodeUnknown(BuildNodesResponseSchema)(data).pipe(
  Effect.mapError(error => new ValidationError({ message: `Validation failed: ${error}` }))
);
```

### 3. Security-First Design

**Implemented security features** (DO NOT remove these):

```typescript
// ✅ Path sanitization in locator.ts
const validatePipelinePath = (path: string): boolean => {
  const segments = path.split('/').filter(seg => seg.length > 0);
  for (const segment of segments) {
    if (!SAFE_PATH_SEGMENT_REGEX.test(segment)) return false;
    if (segment === '..' || segment === '.') return false;  // Path traversal prevention
  }
  return segments.length > 0;
};

// ✅ XDG_CONFIG_HOME validation in config/manager.ts
if (xdgConfigHome && !path.isAbsolute(xdgConfigHome)) {
  console.warn(`Warning: XDG_CONFIG_HOME is not an absolute path, using default ~/.config`);
}

// ✅ Error URL filtering in commands (only show with --verbose)
if (options.verbose && "url" in error && error.url) {
  console.error(gray(`URL: ${error.url}`));
}

// ✅ File permissions (config/manager.ts)
fs.writeFileSync(configPath, content, { mode: 0o600 }); // Owner read/write only
```

### 4. XML Output for LLMs

**XML is privileged over JSON** for LLM consumption:

```typescript
// ✅ XML formatter for LLMs (xml.ts)
// Uses CDATA for console output (no escaping needed for XML-ish format)
if (failure.consoleOutput) {
  lines.push("          <consoleOutput><![CDATA[");
  lines.push(failure.consoleOutput);  // Raw output, no escaping
  lines.push("]]></consoleOutput>");
}
```

**When adding new commands**: Always implement `--xml` flag for structured data output.

### 5. Jenkins Blue Ocean API

**Base Path**: `/blue/rest/organizations/jenkins`

**Key Endpoints**:
- Build nodes: `GET /pipelines/{path}/runs/{buildNumber}/nodes/`
- Console output: `GET /pipelines/{path}/runs/{buildNumber}/nodes/{nodeId}/log/`

**Authentication**: HTTP Basic Auth (`Authorization: Basic base64(username:apiToken)`)

**Locator Formats** (all validated in `locator.ts`):
1. Job URL: `https://jenkins.example.com/job/MyProject/123/`
2. Pipeline URL: `https://jenkins.example.com/.../pipelines/MyProject/runs/123`
3. Pipeline path: `pipelines/MyProject/main/123`
4. Pipeline with runs: `pipelines/MyProject/main/runs/123`

## Development Workflow

### Required Commands After Changes

```bash
# ALWAYS run these before committing
bun run typecheck
bun test
```

### Effect Usage Patterns

#### Pattern 1: Sequential Operations with `pipe()`

```typescript
const getFailureReport = (locator: string): Effect.Effect<FailureReport[], AppError> =>
  pipe(
    parseLocator(locator),                    // Step 1: Parse locator
    Effect.flatMap(getBuildNodes),            // Step 2: Get nodes
    Effect.map(filterFailures),               // Step 3: Filter failures
    Effect.flatMap(enrichWithConsoleOutput)   // Step 4: Add console output
  );
```

#### Pattern 2: Complex Flows with `Effect.gen`

```typescript
const setupWizard = (): Effect.Effect<void, ConfigError> =>
  Effect.gen(function* () {
    const jenkinsUrl = yield* promptJenkinsUrl();
    const username = yield* promptUsername();
    const apiToken = yield* promptApiToken();

    const config = createDefaultConfig(jenkinsUrl, username, apiToken);
    yield* writeConfig(config);

    yield* Console.log(`✓ Configuration saved to: ${getConfigPath()}`);
  });
```

#### Pattern 3: Error Handling

```typescript
// ✅ Catch all errors and handle
Effect.catchAll((error) =>
  Effect.sync(() => {
    console.error(red(`Error: ${error.message}`));
    if (options.verbose) {
      if ("cause" in error) console.error(gray(`Cause: ${error.cause}`));
      if ("url" in error && error.url) console.error(gray(`URL: ${error.url}`));
    }
    process.exit(1);
  })
)

// ✅ Catch specific error types
Effect.catchTag("NetworkError", (error) =>
  Effect.sync(() => console.error(`Network issue: ${error.message}`))
)
```

### Error Types

**All errors use `Data.TaggedError`** for discriminated unions:

```typescript
export class MyError extends Data.TaggedError("MyError")<{
  readonly message: string;
  readonly context?: string;
}> {
  readonly module = "my-module";
}

// Add to union type
export type AppError =
  | ConfigError
  | NetworkError
  | MyError;
```

**Existing Error Types**:
- `ConfigError`, `ConfigNotFoundError`: Configuration issues
- `NetworkError`, `AuthenticationError`: HTTP/network failures
- `ValidationError`: Schema validation failures
- `BuildNotFoundError`, `NodeNotFoundError`: Jenkins API 404s
- `InvalidLocatorError`: Locator parsing errors

## Code Style Guidelines

### TypeScript Rules

1. **Strict mode enabled**: No `any` types, full type safety
2. **Explicit error types**: All Effects must specify error types
3. **No mutation**: Use immutable data structures
4. **Pure functions**: Side effects only via Effect

### Naming Conventions

- **Files**: lowercase with hyphens (`build-operations.ts`)
- **Functions**: camelCase (`getBuildNodes`)
- **Types**: PascalCase (`BuildNode`)
- **Constants**: UPPER_SNAKE_CASE (`SAFE_PATH_SEGMENT_REGEX`)

### Import Style

```typescript
// ✅ Correct: Import from effect
import { Effect, pipe } from "effect";
import { Schema } from "effect";

// ✅ Correct: Use .ts extension for local imports
import { parseLocator } from "./locator.ts";
import type { BuildNode } from "./schemas.ts";

// ❌ Incorrect: No .ts extension
import { parseLocator } from "./locator";
```

## Adding New Features

### Adding a Command

1. **Create command file**: `src/cli/commands/mycommand.ts`
2. **Use Effect pattern**:
```typescript
export const myCommand = (
  operations: BuildOperations,
  options: { verbose?: boolean; xml?: boolean }
): Effect.Effect<void, never> =>
  pipe(
    operations.getData(),
    Effect.map((data) => {
      if (options.xml) {
        console.log(formatXml(data));
      } else {
        console.log(formatHuman(data));
      }
    }),
    Effect.catchAll((error) =>
      Effect.sync(() => {
        console.error(red(`Error: ${error.message}`));
        if (options.verbose && "url" in error && error.url) {
          console.error(gray(`URL: ${error.url}`));
        }
        process.exit(1);
      })
    )
  );
```
3. **Add to router**: `src/cli/router.ts`
4. **Add help text**: `src/cli/commands/help.ts`
5. **Add args**: `src/cli/args.ts` (if new flags needed)

### Adding a Jenkins Operation

1. **Define schema**: `src/lib/jenkins/schemas.ts`
```typescript
export const MyDataSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});
export type MyData = Schema.Schema.Type<typeof MyDataSchema>;
```

2. **Add to operations interface**: `src/lib/jenkins/operations.ts`
```typescript
export interface BuildOperations {
  readonly getMyData: (locator: string) => Effect.Effect<
    MyData[],
    InvalidLocatorError | NetworkError | AuthenticationError | ValidationError
  >;
}
```

3. **Implement**:
```typescript
getMyData: (locator: string) =>
  pipe(
    parseLocator(locator),
    Effect.flatMap((pipelineInfo) =>
      client.getValidated(
        buildMyDataApiPath(pipelineInfo),
        Schema.Array(MyDataSchema)
      )
    )
  ),
```

4. **Add tests**: `test/mydata.test.ts`

## Security Guidelines

### CRITICAL: Never Remove These

1. **Path sanitization** in `locator.ts` (prevents path traversal)
2. **XDG_CONFIG_HOME validation** in `config/manager.ts` (prevents malicious env vars)
3. **File permissions `0o600`** in `config/manager.ts` (protects credentials)
4. **Verbose-only URL display** in commands (prevents info leakage)

### Security Checklist for New Features

- [ ] Validate all external input with Effect Schema
- [ ] Use Effect error handling (no uncaught exceptions)
- [ ] Sanitize file paths and URLs before use
- [ ] Don't expose sensitive data in error messages (use `--verbose` flag)
- [ ] Set appropriate file permissions for sensitive files
- [ ] Never log or commit credentials/tokens

## Testing Guidelines

### Unit Tests

```typescript
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

describe("parseLocator", () => {
  test("parses job URL format", () => {
    const result = Effect.runSync(
      parseLocator("https://jenkins.example.com/job/MyProject/123/")
    );
    expect(result.path).toBe("pipelines/MyProject");
    expect(result.buildNumber).toBe(123);
  });

  test("rejects path traversal attempts", () => {
    expect(() =>
      Effect.runSync(parseLocator("pipelines/../etc/passwd/123"))
    ).toThrow();
  });
});
```

### Integration Tests (MSW)

```typescript
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("*/blue/rest/organizations/jenkins/pipelines/*/runs/*/nodes/", () => {
    return HttpResponse.json([
      { id: "1", displayName: "Test", state: "FINISHED", result: "SUCCESS", actions: [] }
    ]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Git Commit Guidelines

### Conventional Commits (REQUIRED)

```bash
# ✅ Correct
git commit -m "feat: add recursive failure traversal"
git commit -m "fix: prevent path traversal in locator parsing"
git commit -m "refactor: simplify Effect error handling"
git commit -m "test: add locator security tests"
git commit -m "docs: update AGENTS.md with security guidelines"

# ❌ Incorrect
git commit -m "updated code"
git commit -m "fixes"
```

### Commit Rules

- **ALWAYS** use conventional commit format (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)
- **NEVER** use `--no-verify` (let hooks run)
- Keep messages concise, focus on "why" not "what"
- Example: `feat: add XML output for LLM consumption`

## Common Pitfalls

### ❌ DON'T: Use Promises directly

```typescript
// ❌ Bad
const getData = async (): Promise<Data> => {
  const response = await fetch(url);
  return response.json();
};
```

### ✅ DO: Use Effect

```typescript
// ✅ Good
const getData = (): Effect.Effect<Data, NetworkError | ValidationError> =>
  pipe(
    Effect.tryPromise({
      try: () => fetch(url),
      catch: (error) => new NetworkError({ message: `Fetch failed: ${error}` })
    }),
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => response.json(),
        catch: (error) => new NetworkError({ message: `JSON parse failed: ${error}` })
      })
    ),
    Effect.flatMap((data) => Schema.decodeUnknown(DataSchema)(data).pipe(
      Effect.mapError(error => new ValidationError({ message: `Validation failed: ${error}` }))
    ))
  );
```

### ❌ DON'T: Skip validation

```typescript
// ❌ Bad: No validation
const nodes: BuildNode[] = await response.json();
```

### ✅ DO: Always validate with schemas

```typescript
// ✅ Good: Schema validation
const nodes = yield* Schema.decodeUnknown(BuildNodesResponseSchema)(data).pipe(
  Effect.mapError(error => new ValidationError({ message: `Invalid response: ${error}` }))
);
```

### ❌ DON'T: Expose sensitive data

```typescript
// ❌ Bad: Always shows URL
console.error(`Error: ${error.message} at ${error.url}`);
```

### ✅ DO: Use verbose flag for sensitive info

```typescript
// ✅ Good: URL only with --verbose
console.error(`Error: ${error.message}`);
if (options.verbose && "url" in error && error.url) {
  console.error(`URL: ${error.url}`);
}
```

## Troubleshooting for Agents

### Type Errors

If you encounter Effect type errors:
1. Check error types are specified in function signatures
2. Ensure all pipe operations match types
3. Use `Effect.mapError` to transform error types

### Schema Validation Failures

If schema validation fails:
1. Log the actual data: `console.log(JSON.stringify(data, null, 2))`
2. Compare with schema definition
3. Update schema to match API response

### Build Errors

```bash
# Check types
bun run typecheck

# Run tests
bun test

# Clear cache and rebuild
rm -rf dist && bun run build
```

## Resources

- [Effect Documentation](https://effect.website/docs/introduction)
- [Effect Schema](https://effect.website/docs/schema/introduction)
- [Bun Documentation](https://bun.sh/docs)
- [Jenkins Blue Ocean API](https://www.jenkins.io/doc/book/blueocean/rest-api/)

## Summary for Quick Reference

**DO**:
- ✅ Use Effect for all async operations
- ✅ Validate all external data with Effect Schema
- ✅ Use `pipe()` for sequential operations
- ✅ Handle errors explicitly with typed errors
- ✅ Implement `--xml` flag for structured output
- ✅ Run `bun run typecheck && bun test` before committing
- ✅ Use conventional commit format

**DON'T**:
- ❌ Use raw Promises or async/await
- ❌ Skip schema validation
- ❌ Remove security features (path validation, etc.)
- ❌ Expose sensitive data without `--verbose` flag
- ❌ Use `--no-verify` when committing
- ❌ Mutate data structures
