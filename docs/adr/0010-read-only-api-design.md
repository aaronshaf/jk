# ADR 0010: Write Operations Support

## Status

Superseded (originally "Read-Only API Design", updated to allow write operations)

## Context

Jenkins API supports both read and write operations:

- **Read**: Get builds, nodes, console output
- **Write**: Trigger builds, cancel builds, replay

The original decision was to be strictly read-only. As the tool matured,
write operations (stop, retrigger) became clearly valuable for the primary
developer workflow of investigating and recovering from failed builds.

## Decision

jk supports both read and write operations. Write commands are explicit
named operations (`stop`, `retrigger`) and do not modify read command behavior.

## Rationale

- **Workflow completeness**: Stopping a runaway build or replaying a failure
  are natural follow-ons to inspecting it — forcing a context switch to the
  browser adds friction
- **Explicit safety**: Write operations require an explicit command name;
  no read command can accidentally trigger a write
- **API token scope**: Users whose tokens are read-only will get a clear
  auth error; the tool does not require write access for read commands

## Consequences

### Positive
- Full inspect-and-act workflow without leaving the terminal
- `stop` and `retrigger` compose naturally with stdin piping

### Negative
- API tokens need write permissions for write commands
- Risk of accidental build cancellation/replay (mitigated by explicit command names)

## Supported Operations

| Command | Operation | Type |
|---------|-----------|------|
| `build` | GET build information and nodes | Read |
| `builds` | GET recent builds for a job | Read |
| `failures` | GET failed nodes with console output | Read |
| `console` | GET console output for a node | Read |
| `watch` | GET polling for new failures | Read |
| `stop` | POST stop a running build | Write |
| `retrigger` | POST replay a build or restart from a stage | Write |
