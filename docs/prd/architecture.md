# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  build  │ │failures │ │ console │ │  watch  │  ...      │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
└───────┼───────────┼───────────┼───────────┼─────────────────┘
        │           │           │           │
┌───────┴───────────┴───────────┴───────────┴─────────────────┐
│                      Operations Layer                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ BuildOps     │ │ JenkinsClient│ │ ConfigManager│        │
│  │              │ │              │ │              │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└───────┬─────────────────────────────────────────────────────┘
        │
┌───────┴─────────────────────────────────────────────────────┐
│                     External Systems                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ Jenkins API  │ │ File System  │ │ Clipboard/   │        │
│  │ (Blue Ocean) │ │ (~/.config)  │ │ Notifications│        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── index.ts                     # CLI entry point
├── cli/
│   ├── args.ts                  # Argument parser
│   ├── router.ts                # Command router
│   ├── commands/                # Command implementations
│   │   ├── build.ts             # Show build info
│   │   ├── builds.ts            # List recent builds
│   │   ├── failures.ts          # Show failed nodes
│   │   ├── console.ts           # Get console output
│   │   ├── watch.ts             # Monitor pipelines
│   │   ├── setup.ts             # Configuration wizard
│   │   └── help.ts              # Help text
│   └── formatters/              # Output formatting
│       ├── colors.ts            # ANSI colors
│       ├── duration.ts          # Time formatting
│       ├── failures.ts          # Human-readable failures
│       ├── xml.ts               # XML for LLMs
│       └── icons.ts             # Unicode icons
│
└── lib/
    ├── config/
    │   ├── schema.ts            # Config schema
    │   ├── manager.ts           # Config CRUD
    │   ├── wizard.ts            # Setup prompts
    │   └── index.ts             # Exports
    ├── jenkins/
    │   ├── schemas.ts           # API response schemas
    │   ├── client.ts            # HTTP client
    │   ├── locator.ts           # URL parsing
    │   ├── operations.ts        # Build operations
    │   └── index.ts             # Exports
    ├── platform/
    │   ├── clipboard.ts         # Cross-platform clipboard
    │   ├── notifications.ts     # System notifications
    │   └── index.ts             # Exports
    ├── effects/
    │   ├── errors.ts            # Error types
    │   ├── exit-codes.ts        # Exit code constants
    │   └── index.ts             # Exports
    └── index.ts                 # Library exports

test/
├── args.test.ts                 # Argument parsing tests
├── locator.test.ts              # URL parsing tests
├── schemas.test.ts              # Schema validation tests
└── icons.test.ts                # Icon rendering tests
```

## Data Flow

### Read Operation (failures command)

```
User: jk failures --smart --xml <url>
         │
         ▼
┌─────────────────────┐
│ Parse arguments     │
│ Read stdin if empty │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Parse locator       │
│ Validate path       │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Load config         │
│ (~/.config/jk)      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ GET /nodes/ API     │
│ Validate response   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Filter failures     │
│ Get console output  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Recursive: follow   │
│ sub-build links     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Smart filter        │
│ (errors + tail 100) │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Format as XML       │
│ Output to stdout    │
└─────────────────────┘
```

### Watch Flow

```
User: jk watch <pipeline>...
         │
         ▼
┌─────────────────────┐
│ Parse pipelines     │
│ Get initial builds  │
│ Set high water mark │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Raw mode keyboard   │
│ Setup listeners     │
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌───────┐   ┌───────────┐
│ Poll  │   │ Keyboard  │
│ Timer │   │ Events    │
└───┬───┘   └─────┬─────┘
    │             │
    ▼             ▼
┌───────────────────────┐
│ Check for new builds  │
│ Filter failures       │
│ Send notifications    │
│ Update display        │
└───────────────────────┘
```

## Error Handling

Tagged errors with Effect:

```typescript
// Define error types
export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly message: string;
  readonly url?: string;
  readonly statusCode?: number;
}> {}

export class AuthenticationError extends Data.TaggedError("AuthenticationError")<{
  readonly message: string;
  readonly url?: string;
}> {}

// Error union type
export type AppError =
  | ConfigError
  | ConfigNotFoundError
  | NetworkError
  | AuthenticationError
  | ValidationError
  | BuildNotFoundError
  | NodeNotFoundError
  | InvalidLocatorError;

// Handle by tag
Effect.catchTag("NetworkError", (error) =>
  Effect.sync(() => {
    console.error(`Network issue: ${error.message}`);
    process.exit(EXIT_CODES.NETWORK_ERROR);
  })
)
```

## Configuration Architecture

```
Priority: Config File > Environment Variables > Error

┌─────────────────────────────────────┐
│ ~/.config/jk/config.json            │
│ {                                   │
│   "jenkinsUrl": "https://...",      │
│   "auth": {                         │
│     "type": "direct",               │
│     "username": "user",             │
│     "apiToken": "token"             │
│   }                                 │
│ }                                   │
└─────────────────────────────────────┘
              │
              ▼ (type: "env")
┌─────────────────────────────────────┐
│ Environment Variables               │
│ JENKINS_URL                         │
│ JENKINS_USERNAME                    │
│ JENKINS_API_TOKEN                   │
└─────────────────────────────────────┘
              │
              ▼ (missing)
┌─────────────────────────────────────┐
│ ConfigNotFoundError                 │
│ "Run 'jk setup' to configure"       │
└─────────────────────────────────────┘
```

## Security Model

```
┌─────────────────────────────────────────────────────────────┐
│ Input Validation                                            │
│ - Path segment regex: /^[a-zA-Z0-9_.-]+$/                  │
│ - Path traversal prevention (no .. or .)                   │
│ - ReDoS prevention (pattern complexity limits)             │
│ - XDG_CONFIG_HOME validation (absolute, in safe location)  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Credential Protection                                       │
│ - Config file mode 0600                                    │
│ - URLs only shown with --verbose                           │
│ - No credentials in error messages                         │
│ - No shell execution (spawn only)                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Notification Security                                       │
│ - AppleScript via stdin (no arg injection)                 │
│ - notify-send via spawn (no shell)                         │
│ - String escaping for AppleScript                          │
└─────────────────────────────────────────────────────────────┘
```

## Testing Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Test Runner (Bun)                      │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌───────────────┐                         ┌───────────────┐
│  Unit Tests   │                         │  Manual E2E   │
│               │                         │               │
│ - args.test   │                         │ - Real Jenkins│
│ - locator.test│                         │ - Full flows  │
│ - schemas.test│                         │               │
│ - icons.test  │                         │               │
└───────────────┘                         └───────────────┘
```

## Package Exports

```typescript
// Main library export
import { createBuildOperations, createJenkinsClient } from "@aaronshaf/jk";

// Subpath exports
import { parseLocator } from "@aaronshaf/jk/jenkins";
import { readConfig } from "@aaronshaf/jk/config";
import { NetworkError } from "@aaronshaf/jk/effects";
```
