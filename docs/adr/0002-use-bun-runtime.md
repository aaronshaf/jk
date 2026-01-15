# ADR 0002: Use Bun Runtime

## Status

Accepted

## Context

Need to choose a JavaScript runtime for the CLI. Options:

1. **Node.js** - Established, widely compatible
2. **Deno** - Modern, TypeScript-first
3. **Bun** - Fast, TypeScript native, modern tooling

## Decision

Use Bun as the primary JavaScript runtime.

## Rationale

- **Native TypeScript**: No compilation step for development
- **Fast startup**: CLI tools benefit from quick execution
- **Built-in test runner**: `bun test` is fast and sufficient
- **Package management**: `bun install` is significantly faster
- **Ecosystem match**: Consistent with ger and cn projects

## Consequences

### Positive
- Sub-second test runs
- No separate TypeScript build for development
- Single tool for runtime, package management, and testing
- Modern ESM support with `.ts` imports

### Negative
- Less mature than Node.js
- Some Node.js APIs may behave differently
- Requires Bun installation on target systems
- Smaller community for troubleshooting

## Implementation

```json
// package.json
{
  "scripts": {
    "dev": "bun run src/index.ts",
    "test": "bun test",
    "build": "bun build src/index.ts --outdir dist --target bun"
  },
  "engines": {
    "bun": ">=1.0.0"
  }
}
```

## File Structure

```typescript
// Direct .ts imports work without compilation
import { parseLocator } from "./locator.ts";
import type { BuildNode } from "./schemas.ts";
```
