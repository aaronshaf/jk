# jk

Fast, API-driven Jenkins CLI for inspecting builds and failures. Built with Bun, TypeScript, and Effect.

Inspired by prior CLI work done by Evan Battaglia.

## Quick Start

```bash
# 1. Install jk
bun install -g @aaronshaf/jk

# 2. Configure your Jenkins server
jk setup

# 3. Inspect failures (recursively finds root causes)
jk failures https://jenkins.example.com/job/MyProject/123/

# 4. Copy-paste any failure URL to get console output
jk console https://jenkins.example.com/blue/.../pipeline/534

# 5. For LLMs: Get XML output with smart filtering
jk failures --smart --xml https://jenkins.example.com/job/MyProject/123/ | pbcopy
```

## Installation

**Prerequisites:** [Bun runtime](https://bun.sh) v1.0.0 or later

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Install jk globally
bun install -g @aaronshaf/jk

# Configure Jenkins credentials
jk setup
```

**Setup options:**
- **Direct storage**: Credentials saved to `~/.config/jk/config.json` (file permissions: 600)
- **Environment variables**: Use `JENKINS_USERNAME` and `JENKINS_API_TOKEN` (more secure)

## Commands

### Inspect Builds

```bash
# View build information
jk build pipelines/MyProject/main/123

# View with full URL
jk build https://jenkins.example.com/job/MyProject/123/
```

### Inspect Failures

```bash
# List failed nodes (recursively traverses sub-builds by default)
jk failures pipelines/MyProject/main/456

# Only inspect the specified build (no sub-builds)
jk failures --shallow pipelines/MyProject/main/456

# Show failures with full console output
jk failures --full pipelines/MyProject/main/456

# LLM-optimized output (reduces context window)
jk failures --smart --xml pipelines/MyProject/main/456
jk failures --tail 200 --xml pipelines/MyProject/main/456
jk failures --grep "ERROR|FATAL" --xml pipelines/MyProject/main/456
```

### Console Output

```bash
# Traditional format (locator + node-id)
jk console pipelines/MyProject/main/456 node-123

# Copy-paste Blue Ocean URLs directly from failures output
jk console https://jenkins.example.com/blue/.../pipelines/MyProject/main/detail/main/154928/pipeline/534

# Pipe to other tools
jk console <url> | grep ERROR
jk console <url> | less
```

**Pro tip:** Run `jk failures` to see all failed nodes with URLs, then copy-paste any URL directly into `jk console`.

## Key Features

### XML Output for LLMs

```bash
jk build --xml pipelines/MyProject/main/123
jk failures --xml pipelines/MyProject/main/456
```

XML output is optimized for consumption by LLMs (Claude, etc.) and provides structured, easily parseable build data.

**Console output filtering** (avoids context window explosions):
- `--smart`: Last 100 lines + all error/fail/exception lines (recommended for LLMs)
- `--tail <n>`: Last N lines only
- `--grep <pattern>`: Lines matching regex pattern
- `--full`: Full console output (can be very large)

All filters apply **per failed node** - when using `--recursive`, each sub-build failure is filtered individually.

**Example LLM workflow:**
```bash
# Extract failures for debugging
jk failures --smart --xml <build> | pbcopy
# Paste into Claude Code for analysis
```

### Flexible Locator Formats

jk accepts multiple formats for identifying builds:

**Build locators:**
- **Full Jenkins URL**: `https://jenkins.example.com/job/MyProject/123/`
- **Pipeline URL**: `https://jenkins.example.com/.../pipelines/MyProject/runs/123`
- **Pipeline path**: `pipelines/MyProject/main/123`
- **Pipeline with runs**: `pipelines/MyProject/main/runs/123`

**Node URLs** (for `jk console`):
- **Blue Ocean node URL**: `https://jenkins.example.com/blue/.../pipelines/Project/Branch/detail/Branch/BuildNumber/pipeline/NodeId`
- **Traditional**: `<locator> <node-id>` (still supported)

### Recursive Failure Inspection (Default)

**By default**, `jk failures` recursively traverses sub-builds to find root causes:

```bash
# Follows sub-builds automatically
jk failures pipelines/MyProject/main/456

# Explicitly request recursive (same as default)
jk failures --recursive pipelines/MyProject/main/456

# Opt out of recursion with --shallow
jk failures --shallow pipelines/MyProject/main/456
```

When a parent build triggers sub-builds (e.g., MyProject/main → test-suites/JS), the tool automatically gathers failures from all levels. This ensures you see the actual test failures instead of just "wrapper failed" messages.

Combine with filtering for optimal LLM analysis:
```bash
jk failures --tail 200 --xml pipelines/MyProject/main/456
```

## Documentation

- [**Development Guide**](DEVELOPMENT.md) - Setup, architecture, and contributing
- [**Agent Instructions**](AGENTS.md) - Instructions for AI code assistants

## Upgrading

To upgrade jk to the latest version:

```bash
bun update -g @aaronshaf/jk
```

After upgrading, you may want to review new configuration options:

```bash
jk setup  # Review and update your configuration
```

## License

MIT
