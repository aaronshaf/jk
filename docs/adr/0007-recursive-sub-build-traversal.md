# ADR 0007: Recursive Sub-Build Traversal

## Status

Accepted

## Context

Jenkins pipeline builds often trigger downstream builds (test suites, deployments, etc.). When a parent build fails, the actual failure is often in a sub-build. Users need to find the root cause.

Options:
1. **Shallow inspection** - Only show failures in the requested build
2. **Recursive traversal** - Follow sub-build links to find all failures
3. **User choice** - Let user decide via flag

## Decision

Recursive traversal is the **default behavior** for the `failures` command. Use `--shallow` to disable.

## Rationale

- **Root cause discovery**: Actual failures often in sub-builds
- **Time savings**: Don't manually chase through build chains
- **Better LLM context**: AI tools get complete failure information
- **Cycle detection**: Prevents infinite loops in circular build references

## Consequences

### Positive
- One command shows all failures across build chain
- Root cause failures surfaced automatically
- Useful default for most debugging scenarios

### Negative
- More API calls for deep build chains
- May include irrelevant sub-build failures
- Need to handle missing sub-builds gracefully

## Implementation

```typescript
// Default: recursive
jk failures <build>

// Explicit recursive (same as default)
jk failures --recursive <build>

// Shallow: only the specified build
jk failures --shallow <build>
```

```typescript
// operations.ts
const buildFailureReportRecursive = (
  client, config, pipelineInfo, includeFull, visited: Set<string>
): Effect.Effect<FailureReport[], AppError> => {
  const key = `${pipelineInfo.path}/${pipelineInfo.buildNumber}`;

  // Cycle detection
  if (visited.has(key)) {
    return Effect.succeed([]);
  }
  visited.add(key);

  return pipe(
    client.getValidated(buildNodesApiPath(pipelineInfo), BuildNodesResponseSchema),
    Effect.flatMap((nodes) => {
      // Get failures in current build
      const currentFailures = /* ... */;

      // Extract and follow sub-build links
      const subBuildLinks = extractSubBuildLinks(nodes);
      const subFailures = pipe(
        subBuildLinks,
        EffectArray.map((subPipeline) =>
          buildFailureReportRecursive(client, config, subPipeline, includeFull, visited)
        ),
        Effect.all,
        Effect.map((results) => results.flat())
      );

      // Combine current and sub-build failures
      return Effect.all([currentFailures, subFailures])
        .pipe(Effect.map(([current, sub]) => [...current, ...sub]));
    }),
    // Handle missing sub-builds gracefully
    Effect.catchTag("BuildNotFoundError", () => Effect.succeed([]))
  );
};
```

## Sub-Build Link Extraction

```typescript
const extractSubBuildLinks = (nodes: BuildNode[]): PipelineInfo[] => {
  const links: PipelineInfo[] = [];

  for (const node of nodes) {
    for (const action of node.actions) {
      if (action.link?.href) {
        const parsed = parseLocator(action.link.href);
        if (parsed) links.push(parsed);
      }
    }
  }

  // Deduplicate by path/buildNumber
  return deduplicateLinks(links);
};
```
