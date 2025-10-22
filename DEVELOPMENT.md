# Development Guide

## Quick Start

```bash
# Install dependencies
bun install

# Run type checking and tests
bun run typecheck
bun test

# Run in development mode
bun run dev

# Build for production
bun run build
```

## Project Structure

```
jk/
├── src/
│   ├── index.ts                     # CLI entry point
│   ├── cli/
│   │   ├── args.ts                  # Argument parsing
│   │   ├── router.ts                # Command routing
│   │   ├── commands/                # Command implementations
│   │   │   ├── setup.ts             # Interactive setup wizard
│   │   │   ├── build.ts             # Show build information
│   │   │   ├── failures.ts          # Show failures with optional console output
│   │   │   ├── console.ts           # Get console output for specific node
│   │   │   └── help.ts              # Help system
│   │   └── formatters/              # Output formatting
│   │       ├── colors.ts            # ANSI color codes
│   │       ├── duration.ts          # Time formatting
│   │       ├── failures.ts          # Failure report formatting
│   │       └── xml.ts               # XML formatting for LLM consumption
│   └── lib/
│       ├── config/
│       │   ├── schema.ts            # Config schema with Effect Schema
│       │   ├── manager.ts           # Config CRUD with XDG support
│       │   └── wizard.ts            # Interactive setup wizard
│       ├── jenkins/
│       │   ├── schemas.ts           # API response schemas
│       │   ├── client.ts            # HTTP client with Basic Auth
│       │   ├── locator.ts           # URL/path parsing with validation
│       │   └── operations.ts        # Build operations
│       └── effects/
│           └── errors.ts            # Error hierarchy with tagged errors
├── test/
│   └── locator.test.ts              # Locator parsing tests
├── dist/                            # Build output (gitignored)
├── package.json
├── tsconfig.json
└── bun.lock
```

## Architecture

### Effect-Based Design

This project uses [Effect](https://effect.website/) throughout for functional, type-safe operations:

- **Effect**: Functional error handling with discriminated unions
- **Effect Schema**: Runtime validation of all external data (API responses, config files)
- **Type Safety**: All errors are typed and handled explicitly
- **Composition**: Operations composed with `pipe()` for readability

### Key Components

#### 1. Jenkins HTTP Client (`src/lib/jenkins/client.ts`)

HTTP client for Jenkins Blue Ocean REST API:

- **Authentication**: HTTP Basic Auth with username:apiToken
- **Response Types**: JSON (with schema validation) and plain text
- **Error Handling**: Converts HTTP errors to typed Effect errors
- **Validation**: All JSON responses validated with Effect Schema

```typescript
const client = createJenkinsClient(config);
const nodes = await Effect.runPromise(
  client.getValidated('/blue/rest/.../nodes/', BuildNodesResponseSchema)
);
```

#### 2. Build Operations (`src/lib/jenkins/operations.ts`)

Core business logic for Jenkins builds:

- `getBuildNodes(locator)`: Get all stages/steps in a build
- `getNodeConsole(locator, nodeId)`: Get console output for a node
- `getFailedNodes(locator)`: Filter nodes by FAILURE status
- `getFailureReport(locator, includeFull)`: Generate failure report
- `getFailureReportRecursive(locator, includeFull)`: Recursively traverse sub-builds

All operations return `Effect.Effect<T, ErrorType>` for type-safe error handling.

#### 3. Locator Parsing (`src/lib/jenkins/locator.ts`)

Parses various Jenkins URL/path formats with security validation:

**Supported Formats:**
- Job URLs: `https://jenkins.example.com/job/MyProject/123/`
- Pipeline URLs: `https://jenkins.example.com/.../pipelines/MyProject/runs/123`
- Pipeline paths: `pipelines/MyProject/main/123`
- Pipeline with runs: `pipelines/MyProject/main/runs/123`

**Security Features:**
- Path sanitization (alphanumeric, underscore, hyphen, dot only)
- Path traversal prevention (rejects `..` and `.`)
- Validation before API path construction

#### 4. Configuration Management (`src/lib/config/`)

XDG-compliant configuration storage:

- **Location**: `~/.config/jk/config.json` (or `$XDG_CONFIG_HOME/jk/config.json`)
- **Permissions**: `0o600` (owner read/write only)
- **Validation**: Schema validation with Effect Schema
- **Security**: XDG_CONFIG_HOME validation for path traversal

**Configuration Schema:**
```typescript
{
  jenkinsUrl: string;  // https://jenkins.example.com
  auth: {
    type: "direct";
    username: string;
    apiToken: string;
  }
}
```

#### 5. Error Handling (`src/lib/effects/errors.ts`)

Comprehensive typed error hierarchy using `Data.TaggedError`:

**Configuration Errors:**
- `ConfigError`: General config issues
- `ConfigNotFoundError`: Missing config file

**Network Errors:**
- `NetworkError`: HTTP/network failures
- `AuthenticationError`: 401/403 authentication failures

**Validation Errors:**
- `ValidationError`: Schema validation failures

**Jenkins API Errors:**
- `BuildNotFoundError`: Build doesn't exist (404)
- `NodeNotFoundError`: Node doesn't exist (404)
- `InvalidLocatorError`: Invalid locator format

All errors include contextual information (URLs, paths, status codes) displayed only with `--verbose` flag.

## Development Workflow

### Running Commands

```bash
# Type check
bun run typecheck

# Run tests
bun test

# Watch mode
bun test --watch

# Run specific test
bun test test/locator.test.ts

# Development mode (no build)
bun run dev setup

# Build and test
bun run build
./dist/index.js help
```

### Testing

#### Unit Tests with Bun

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
});
```

#### Integration Tests with MSW

MSW (Mock Service Worker) is available for HTTP mocking:

```typescript
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("*/blue/rest/organizations/jenkins/*", () => {
    return HttpResponse.json([
      { id: "1", displayName: "Build", state: "FINISHED", result: "SUCCESS" }
    ]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Jenkins Blue Ocean API

**Base Path:** `/blue/rest/organizations/jenkins`

**Key Endpoints:**
- **Build Nodes**: `GET /pipelines/{path}/runs/{buildNumber}/nodes/`
  - Returns array of build nodes (stages/steps)
- **Console Output**: `GET /pipelines/{path}/runs/{buildNumber}/nodes/{nodeId}/log/`
  - Returns plain text console output

**Authentication:** HTTP Basic Auth
```
Authorization: Basic base64(username:apiToken)
```

## Adding New Features

### Adding a New Command

1. **Create command file** in `src/cli/commands/mycommand.ts`:
```typescript
import { Effect, pipe } from "effect";
import type { BuildOperations } from "../../lib/jenkins/operations.ts";

export const myCommand = (
  operations: BuildOperations,
  options: { verbose?: boolean }
): Effect.Effect<void, never> =>
  pipe(
    operations.someOperation(),
    Effect.map((data) => {
      console.log(formatOutput(data));
    }),
    Effect.catchAll((error) =>
      Effect.sync(() => {
        console.error(`Error: ${error.message}`);
        if (options.verbose && "url" in error && error.url) {
          console.error(`URL: ${error.url}`);
        }
        process.exit(1);
      })
    )
  );
```

2. **Add to router** in `src/cli/router.ts`
3. **Add help text** in `src/cli/commands/help.ts`
4. **Update args** in `src/cli/args.ts` if new flags needed

### Adding New Jenkins Operations

1. **Define schemas** in `src/lib/jenkins/schemas.ts`:
```typescript
export const MyDataSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});
export type MyData = Schema.Schema.Type<typeof MyDataSchema>;
```

2. **Add to operations** in `src/lib/jenkins/operations.ts`:
```typescript
export interface BuildOperations {
  readonly getMyData: (locator: string) => Effect.Effect<
    MyData[],
    InvalidLocatorError | NetworkError | AuthenticationError | ValidationError
  >;
}

// Implementation
getMyData: (locator: string) =>
  pipe(
    parseLocator(locator),
    Effect.flatMap((pipelineInfo) =>
      client.getValidated(buildMyDataApiPath(pipelineInfo), Schema.Array(MyDataSchema))
    )
  ),
```

3. **Add tests**

### Adding New Error Types

1. **Define in** `src/lib/effects/errors.ts`:
```typescript
export class MyError extends Data.TaggedError("MyError")<{
  readonly message: string;
  readonly context?: string;
}> {
  readonly module = "my-module";
}
```

2. **Add to union type**:
```typescript
export type AppError =
  | ConfigError
  | NetworkError
  | MyError;  // Add here
```

3. **Use in operations**:
```typescript
Effect.fail(new MyError({ message: "Something went wrong", context: "details" }))
```

## Security Best Practices

### Implemented Security Features

1. **Path Sanitization**: All pipeline paths validated for safe characters only
2. **XDG_CONFIG_HOME Validation**: Environment variable checked for path traversal
3. **File Permissions**: Config files created with `0o600` (owner-only)
4. **URL Filtering**: Error URLs only shown with `--verbose` flag
5. **No Arbitrary Code Execution**: No `eval()`, `Function()`, or dynamic imports
6. **Input Validation**: All external data validated with schemas

### Security Checklist for New Features

- [ ] Validate all external input with Effect Schema
- [ ] Use Effect error handling (no uncaught exceptions)
- [ ] Sanitize file paths and URLs
- [ ] Don't expose sensitive data in error messages (use `--verbose`)
- [ ] Set appropriate file permissions for sensitive files
- [ ] Never commit credentials or API tokens

## Code Style Guidelines

### TypeScript

- **Strict mode enabled**: Full type safety required
- **No `any` types**: Use proper types or `unknown`
- **Explicit error types**: All Effects must specify error types

### Effect Patterns

- **Use `pipe()`** for sequential operations:
```typescript
pipe(
  parseLocator(input),
  Effect.flatMap(validatePath),
  Effect.map(formatOutput)
)
```

- **Use `Effect.gen`** for complex flows:
```typescript
Effect.gen(function* () {
  const config = yield* readConfig();
  const client = yield* createClient(config);
  const data = yield* client.getData();
  return processData(data);
})
```

- **Always handle errors explicitly**:
```typescript
Effect.catchAll((error) => Effect.sync(() => console.error(error.message)))
```

### Functional Style

- **Immutable data**: No mutation of objects/arrays
- **Pure functions**: No side effects (use Effect for side effects)
- **Composition over inheritance**: Use function composition

## Troubleshooting

### Type Errors

```bash
bun run typecheck
```

Common issues:
- Missing Effect error types in function signatures
- Schema type mismatches
- Missing imports from `effect` package

### Runtime Errors

Enable verbose output:
```bash
jk <command> --verbose
```

This shows:
- Full error causes
- Jenkins API URLs
- Detailed stack traces

### Authentication Issues

1. Verify Jenkins URL: `https://jenkins.example.com` (no trailing slash)
2. Check credentials in `~/.config/jk/config.json`
3. Generate new API token in Jenkins: User menu → Configure → API Token
4. Test network access: `curl -u username:token https://jenkins.example.com/api/json`

### Build Not Found (404)

1. Verify locator format matches one of the supported formats
2. Check build number exists in Jenkins
3. Try different locator format (URL vs path)
4. Use `--verbose` to see the actual API URL being requested

## Future Enhancements

Potential features:

1. **Caching**: Cache build data locally with TTL
2. **Advanced Filtering**: Filter by time range, status, regex patterns
3. **Build Comparison**: Compare failures across multiple builds
4. **Config Profiles**: Support multiple Jenkins servers
5. **Encrypted Credentials**: Encrypt API tokens at rest
6. **Build Triggering**: Add write operations (trigger builds)
7. **Queue Management**: View and manage Jenkins build queue
8. **Notifications**: Slack/email integration for failures

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make changes following code style guidelines
4. Add tests for new functionality
5. Run `bun run typecheck && bun test`
6. Commit with conventional commit format: `feat: add new feature`
7. Submit pull request

## Resources

- [Effect Documentation](https://effect.website/docs/introduction)
- [Effect Schema Documentation](https://effect.website/docs/schema/introduction)
- [Bun Documentation](https://bun.sh/docs)
- [Jenkins Blue Ocean API](https://www.jenkins.io/doc/book/blueocean/rest-api/)
