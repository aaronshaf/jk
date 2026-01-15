# jk - Jenkins CLI Tool

## Overview

`jk` is a fast, API-driven Jenkins CLI for inspecting builds and failures. It provides read-only access to Jenkins Blue Ocean API with LLM-friendly output formats.

## Goals

1. **Fast build inspection** - Quick access to build status, failures, and console output
2. **AI/LLM integration** - Structured XML output optimized for language models
3. **Root cause discovery** - Automatic traversal of sub-builds to find actual failures
4. **Developer ergonomics** - Stdin piping, multiple URL formats, sensible defaults
5. **Type safety** - Full TypeScript with Effect for reliable operations

## Non-Goals

- Replace Jenkins web UI (use browser for complex navigation)
- Write operations (no build triggers, cancellations, or modifications)
- Support Jenkins versions without Blue Ocean plugin
- Real-time streaming (polling-based watch instead)

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript/Bun | Fast runtime, native TS, matches ger/cn |
| Error handling | Effect library | Type-safe errors, composable operations |
| CLI framework | Custom arg parser | Zero dependencies, exact behavior needed |
| Output formats | Text, XML, JSON | Human + LLM + machine readable |
| Credentials | `~/.config/jk/config.json` | XDG-compliant, secure permissions |
| Jenkins API | Blue Ocean REST | Structured, pipeline-native, node-level data |
| Validation | Effect Schema | Single source of truth, type inference |
| Security | Input validation | Path sanitization, ReDoS prevention |

## User Personas

### Individual Developer
- Investigating failed CI builds
- Needs quick failure details
- Wants to pipe output to AI tools

### Build Engineer
- Monitoring multiple pipelines
- Needs notifications on failures
- Wants scriptable CLI for automation

### AI/LLM User
- Using Claude/GPT for failure analysis
- Needs structured, focused output
- Benefits from smart filtering

## Commands Overview

| Category | Commands |
|----------|----------|
| **Inspect** | `build`, `builds`, `failures`, `console` |
| **Monitor** | `watch` |
| **Setup** | `setup`, `help` |

## User Flows

### First-time Setup

```
$ jk setup
? Jenkins URL: https://jenkins.example.com
? Username: john.doe
? API Token: ****
Configuration saved to ~/.config/jk/config.json
```

### Investigate Build Failure

```
$ jk failures --smart --xml https://jenkins.example.com/job/Project/123/
<?xml version="1.0" encoding="UTF-8"?>
<failures mode="smart">
  <metadata>
    <totalFailures>2</totalFailures>
  </metadata>
  <builds>
    <build>
      <nodes>
        <node>
          <displayName>Run Tests</displayName>
          <consoleOutput><![CDATA[
FAIL src/Button.test.tsx
  Expected: "Click"
  Received: "click"
]]></consoleOutput>
        </node>
      </nodes>
    </build>
  </builds>
</failures>
```

### Monitor for Failures

```
$ jk watch https://jenkins.example.com/job/Project/job/main/
Watching 1 pipeline (polling every 60s)
  • Project/main (last: #456)

Last check: 2:30:45 PM | Next in 45s
[↑/↓] select | [c] copy | [r] refresh | [q] quit
────────────────────────────────────────
▶ • Project/main #457  2:25 PM  "Fix login bug"
    ✗ Run Unit Tests
────────────────────────────────────────
```

### AI-Assisted Debugging

```bash
# Pipe failures to Claude for analysis
jk failures --smart --xml <build> | claude "What's causing these test failures?"

# Copy from watch mode
# (press 'c' in watch mode to copy selected failure)
```

## Success Metrics

- Handle builds with 1000+ nodes
- Complete common operations in < 2 seconds
- Recursive traversal handles 10+ sub-builds
- Smart filtering reduces output by 90%+

## References

- [Jenkins Blue Ocean API](https://www.jenkins.io/doc/book/blueocean/rest-api/)
- [Effect library](https://effect.website/)
- [ger project](https://github.com/aaronshaf/ger) - Gerrit CLI (same author)
- [cn project](https://github.com/aaronshaf/cn) - Confluence CLI (same author)
