# ADR 0006: Jenkins Blue Ocean REST API

## Status

Accepted

## Context

Jenkins offers multiple APIs for accessing build information:

1. **Classic Jenkins API** - `/job/.../api/json`
2. **Blue Ocean REST API** - `/blue/rest/organizations/jenkins/pipelines/...`
3. **Jenkins CLI** - Java-based command-line tool

## Decision

Use the Blue Ocean REST API exclusively.

**Base Path**: `/blue/rest/organizations/jenkins`

## Rationale

- **Structured data**: Blue Ocean API returns well-structured JSON
- **Pipeline-native**: Designed for modern pipeline builds
- **Node information**: Direct access to build stages/steps
- **Console output**: Clean API for step-level console logs
- **Sub-build links**: Action links to downstream builds

## Consequences

### Positive
- Clean, consistent API structure
- Direct access to pipeline stages and nodes
- Console output per node (not just per build)
- Links to sub-builds in action objects

### Negative
- Requires Blue Ocean plugin installed
- Less documentation than classic API
- Some information only in classic API (build parameters)

## Key Endpoints

```
# Build nodes (stages/steps)
GET /blue/rest/organizations/jenkins/pipelines/{path}/runs/{buildNumber}/nodes/

# Node console output
GET /blue/rest/organizations/jenkins/pipelines/{path}/runs/{buildNumber}/nodes/{nodeId}/log/

# Recent builds for a job
GET /blue/rest/organizations/jenkins/pipelines/{path}/runs/?limit=N
```

## Locator Formats

The CLI accepts multiple URL formats and normalizes them:

```typescript
// Job URL format
https://jenkins.example.com/job/MyProject/job/main/123/
-> pipelines/MyProject/main/123

// Blue Ocean URL format
https://jenkins.example.com/blue/.../pipelines/MyProject/main/runs/123
-> pipelines/MyProject/main/123

// Pipeline path
pipelines/MyProject/main/123
-> pipelines/MyProject/main/123

// Node URL (for console command)
https://jenkins.example.com/blue/.../detail/main/123/pipeline/456
-> { path: "pipelines/...", buildNumber: 123, nodeId: "456" }
```

## Sub-Build Discovery

```typescript
// Nodes contain action links to downstream builds
{
  "id": "5",
  "displayName": "Run Tests",
  "actions": [{
    "link": {
      "href": "/blue/.../pipelines/test-suite/runs/789"
    }
  }]
}
```
