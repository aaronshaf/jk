# Data Model

Schemas and data structures used throughout the application.

## Jenkins API Types

### BuildNode

A stage or step within a build pipeline.

```typescript
const BuildNodeSchema = Schema.Struct({
  id: Schema.String,
  displayName: Schema.String,
  result: Schema.optional(Schema.NullOr(BuildResultSchema)),
  state: BuildStateSchema,
  startTime: Schema.optional(Schema.NullOr(Schema.String)),
  durationInMillis: Schema.optional(Schema.NullOr(Schema.Number)),
  actions: Schema.Array(ActionSchema),
});

type BuildNode = {
  id: string;
  displayName: string;
  result?: "SUCCESS" | "FAILURE" | "UNSTABLE" | "ABORTED" | "NOT_BUILT" | "UNKNOWN" | null;
  state: "FINISHED" | "RUNNING" | "QUEUED" | "PAUSED" | "SKIPPED" | "NOT_BUILT";
  startTime?: string | null;
  durationInMillis?: number | null;
  actions: Action[];
}
```

### BuildResult

Build result status.

```typescript
const BuildResultSchema = Schema.Literal(
  "SUCCESS",
  "FAILURE",
  "UNSTABLE",
  "ABORTED",
  "NOT_BUILT",
  "UNKNOWN"
);
```

### BuildState

Build execution state.

```typescript
const BuildStateSchema = Schema.Literal(
  "FINISHED",
  "RUNNING",
  "QUEUED",
  "PAUSED",
  "SKIPPED",
  "NOT_BUILT"
);
```

### Action

Action attached to a node, may contain links to sub-builds.

```typescript
const ActionSchema = Schema.Struct({
  link: Schema.optional(ActionLinkSchema),
});

const ActionLinkSchema = Schema.Struct({
  href: Schema.String,
});
```

### BuildSummary

Summary of a build from the runs list endpoint.

```typescript
const BuildSummarySchema = Schema.Struct({
  id: Schema.String,
  result: Schema.optional(Schema.NullOr(BuildResultSchema)),
  state: BuildStateSchema,
  startTime: Schema.optional(Schema.NullOr(Schema.String)),
  durationInMillis: Schema.optional(Schema.NullOr(Schema.Number)),
  runSummary: Schema.optional(Schema.NullOr(Schema.String)),
  _links: Schema.Struct({
    self: Schema.Struct({
      href: Schema.String,
    }),
  }),
  changeSet: Schema.optional(Schema.Array(Schema.Struct({
    commitId: Schema.String,
    msg: Schema.String,
  }))),
  causes: Schema.optional(Schema.Array(Schema.Struct({
    shortDescription: Schema.String,
  }))),
});
```

### PipelineInfo

Parsed pipeline information from a locator.

```typescript
const PipelineInfoSchema = Schema.Struct({
  path: Schema.String,      // e.g., "pipelines/Project/main"
  buildNumber: Schema.Number,
});
```

### JobInfo

Pipeline without build number.

```typescript
const JobInfoSchema = Schema.Struct({
  path: Schema.String,      // e.g., "pipelines/Project/main"
});
```

## Configuration Schema

### Config

Application configuration stored in `~/.config/jk/config.json`.

```typescript
const ConfigSchema = Schema.Struct({
  jenkinsUrl: Schema.optional(Schema.String.pipe(
    Schema.pattern(/^https?:\/\/.+/)
  )),
  auth: AuthSchema,
});
```

### Auth

Authentication configuration (direct or environment-based).

```typescript
const AuthSchema = Schema.Union(DirectAuthSchema, EnvAuthSchema);

const DirectAuthSchema = Schema.Struct({
  type: Schema.Literal("direct"),
  username: Schema.String.pipe(Schema.minLength(1)),
  apiToken: Schema.String.pipe(Schema.minLength(1)),
});

const EnvAuthSchema = Schema.Struct({
  type: Schema.Literal("env"),
});
```

**Direct Auth Example:**
```json
{
  "jenkinsUrl": "https://jenkins.example.com",
  "auth": {
    "type": "direct",
    "username": "john.doe",
    "apiToken": "abc123xyz"
  }
}
```

**Environment Auth Example:**
```json
{
  "auth": { "type": "env" }
}
```
Uses: `JENKINS_URL`, `JENKINS_USERNAME`, `JENKINS_API_TOKEN`

## Internal Types

### FailureReport

Aggregated failure information for output.

```typescript
interface FailureReport {
  readonly pipeline: string;
  readonly buildNumber: number;
  readonly nodeId: string;
  readonly displayName: string;
  readonly result: BuildResult;
  readonly url: string;
  readonly consoleOutput?: string;
  readonly subBuilds?: readonly FailureReport[];
}
```

### ParsedArgs

Parsed command-line arguments.

```typescript
interface ParsedArgs {
  command: string;
  positional: string[];
  flags: {
    verbose?: boolean;
    full?: boolean;
    recursive?: boolean;
    shallow?: boolean;
    json?: boolean;
    xml?: boolean;
    help?: boolean;
    tail?: number;
    grep?: string;
    smart?: boolean;
    limit?: number;
    urls?: boolean;
    format?: "json" | "xml";
    interval?: number;
    noNotify?: boolean;
    quiet?: boolean;
  };
  stdin: string | null;
}
```

## Error Types

All errors use `Data.TaggedError` for discriminated unions.

### ConfigError

Configuration issues.

```typescript
class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string;
  readonly field?: string;
  readonly cause?: unknown;
}> {}
```

### ConfigNotFoundError

Config file not found.

```typescript
class ConfigNotFoundError extends Data.TaggedError("ConfigNotFoundError")<{
  readonly message: string;
  readonly path: string;
}> {}
```

### NetworkError

HTTP/network failures.

```typescript
class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly message: string;
  readonly url?: string;
  readonly statusCode?: number;
  readonly cause?: unknown;
}> {}
```

### AuthenticationError

401/403 responses.

```typescript
class AuthenticationError extends Data.TaggedError("AuthenticationError")<{
  readonly message: string;
  readonly url?: string;
}> {}
```

### ValidationError

Schema validation failures.

```typescript
class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly field?: string;
  readonly value?: unknown;
  readonly cause?: unknown;
}> {}
```

### BuildNotFoundError

Build 404.

```typescript
class BuildNotFoundError extends Data.TaggedError("BuildNotFoundError")<{
  readonly message: string;
  readonly pipeline: string;
  readonly buildNumber: number;
}> {}
```

### NodeNotFoundError

Node 404.

```typescript
class NodeNotFoundError extends Data.TaggedError("NodeNotFoundError")<{
  readonly message: string;
  readonly pipeline: string;
  readonly buildNumber: number;
  readonly nodeId: string;
}> {}
```

### InvalidLocatorError

Locator parsing errors.

```typescript
class InvalidLocatorError extends Data.TaggedError("InvalidLocatorError")<{
  readonly message: string;
  readonly locator: string;
}> {}
```

### AppError Union

```typescript
type AppError =
  | ConfigError
  | ConfigNotFoundError
  | NetworkError
  | AuthenticationError
  | ValidationError
  | BuildNotFoundError
  | NodeNotFoundError
  | InvalidLocatorError;
```

## Output Formats

### Human (Default)

Colored terminal output:

```
Build #123 - pipelines/Project/main

Nodes:
  ✓ Checkout          SUCCESS   2.3s
  ✓ Build             SUCCESS  45.2s
  ✗ Run Tests         FAILURE  12.1s
  ○ Deploy            SKIPPED     -
```

### XML (--xml)

LLM-friendly structured output:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<failures mode="smart">
  <metadata>
    <totalFailures>1</totalFailures>
    <smartMode>true</smartMode>
  </metadata>
  <builds>
    <build>
      <pipeline>Project/main</pipeline>
      <buildNumber>123</buildNumber>
      <nodes>
        <node>
          <id>5</id>
          <displayName>Run Tests</displayName>
          <result>FAILURE</result>
          <url>https://jenkins.example.com/blue/.../pipeline/5</url>
          <consoleOutput><![CDATA[
FAIL src/test.ts
  Expected: 1
  Received: 2
]]></consoleOutput>
        </node>
      </nodes>
    </build>
  </builds>
</failures>
```

### JSON (--json)

Machine-parseable output:

```json
[
  {
    "id": "123",
    "result": "FAILURE",
    "state": "FINISHED",
    "startTime": "2024-01-15T10:30:00Z",
    "durationInMillis": 62100,
    "url": "/blue/rest/.../runs/123"
  }
]
```

### URLs Only (--urls)

One URL per line for piping:

```
/blue/rest/organizations/jenkins/pipelines/Project/main/runs/125
/blue/rest/organizations/jenkins/pipelines/Project/main/runs/124
/blue/rest/organizations/jenkins/pipelines/Project/main/runs/123
```
