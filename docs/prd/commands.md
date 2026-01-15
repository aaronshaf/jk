# Commands

Complete specification of all CLI commands.

## Build Inspection

### build

Display build information including all stages and their status.

```bash
jk build <build>
jk build <build> --xml
echo <build> | jk build
```

| Option | Description |
|--------|-------------|
| `--verbose`, `-v` | Show detailed node information |
| `--xml` | Output as XML for LLM consumption |

**Output includes:**
- Build ID and pipeline path
- All nodes (stages/steps) with status
- Duration and timing information
- Result status (SUCCESS, FAILURE, etc.)

### builds

List recent builds for a job (no build number required).

```bash
jk builds <job>
jk builds <job> --limit 10
jk builds --urls <job> | head -1
```

| Option | Description |
|--------|-------------|
| `--limit N` | Number of builds to show (default: 5, max: 100) |
| `--urls` | Output only URLs (one per line, for piping) |
| `--xml` | Output as XML |
| `--json` | Output as JSON |
| `--verbose`, `-v` | Show commit info for each build |

**Output includes:**
- Build ID and result
- Start time and duration
- Commit messages (with `--verbose`)
- Build URL

### failures

Show failed nodes in a build with optional console output. By default, recursively traverses sub-builds to find root causes.

```bash
jk failures <build>
jk failures --smart --xml <build>
jk failures --shallow <build>
```

| Option | Description |
|--------|-------------|
| `--full` | Include full console output |
| `--shallow` | Only inspect the specified build (no sub-builds) |
| `--recursive`, `-r` | Recursively traverse sub-builds (default) |
| `--tail N` | Include last N lines of console output |
| `--grep PATTERN` | Filter console output by pattern |
| `--smart` | Smart mode: last 100 lines + error lines |
| `--xml` | Output as XML |
| `--json` | Output as JSON |
| `--verbose`, `-v` | Show detailed error information |

**Console Output Modes:**

| Mode | Flag | Behavior |
|------|------|----------|
| None | (default) | Metadata only |
| Full | `--full` | Complete console output |
| Tail | `--tail N` | Last N lines |
| Grep | `--grep PAT` | Lines matching pattern |
| Smart | `--smart` | Errors + tail 100 |

**Traversal Modes:**

| Mode | Flag | Behavior |
|------|------|----------|
| Recursive | (default) | Follow sub-builds |
| Shallow | `--shallow` | Only specified build |

### console

Get console output for a specific node. Output is plain text, suitable for piping.

```bash
jk console <build> <node-id>
jk console <blue-ocean-node-url>
echo <node-url> | jk console
```

| Option | Description |
|--------|-------------|
| `--verbose`, `-v` | Show detailed error information |

**URL Formats:**
- Traditional: `jk console <build> <node-id>`
- Blue Ocean URL: `jk console https://jenkins.example.com/blue/.../pipeline/534`

## Monitoring

### watch

Monitor one or more pipelines for new failures. Sends system notifications when builds fail.

```bash
jk watch <pipeline>...
jk watch --interval 30 <pipeline>
jk watch --quiet <pipeline>
```

| Option | Description |
|--------|-------------|
| `--interval N` | Seconds between polls (default: 60, min: 10) |
| `--limit N` | Number of recent builds to check (default: 20) |
| `--no-notify` | Disable system notifications |
| `--quiet` | Minimal output (notifications only) |

**Keyboard Controls:**

| Key | Action |
|-----|--------|
| `↑`/`k` | Move selection up |
| `↓`/`j` | Move selection down |
| `c` | Copy selected failure (smart XML) to clipboard |
| `r` | Refresh immediately |
| `q` | Quit |

**Behavior:**
- On startup, records latest build ID (high water mark)
- Only alerts on NEW failures after watch starts
- Press `c` to copy equivalent of `jk failures --smart --xml`

**Notifications:**
- macOS: Native notifications with sound
- Linux: notify-send (requires libnotify)

## Configuration

### setup

Interactive setup wizard for credentials.

```bash
jk setup
```

**Prompts for:**
- Jenkins base URL
- Username
- API token

**Creates:** `~/.config/jk/config.json` with 0600 permissions

**Getting API Token:**
1. Log in to Jenkins
2. Click username → Configure
3. Add new API Token
4. Copy token immediately

### help

Show help for commands.

```bash
jk help
jk help <command>
jk --help
```

## Global Options

Available on most commands:

| Option | Description |
|--------|-------------|
| `--verbose`, `-v` | Show detailed error information |
| `--help`, `-h` | Show help |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success, no failures |
| 1 | Failures found |
| 2 | Configuration error |
| 3 | Network error |
| 4 | Authentication error |
| 5 | Build/node not found |
| 6 | Validation error |
| 7 | Invalid input |
| 99 | Internal error |

## Locator Formats

All commands accept multiple URL formats:

```bash
# Full Jenkins job URL
https://jenkins.example.com/job/MyProject/job/main/123/

# Blue Ocean pipeline URL
https://jenkins.example.com/blue/.../pipelines/MyProject/main/runs/123

# Pipeline path
pipelines/MyProject/main/123

# Pipeline path with /runs/
pipelines/MyProject/main/runs/123
```

## Stdin Piping

All commands that accept locators can read from stdin:

```bash
# From echo
echo "url" | jk failures

# From clipboard (macOS)
pbpaste | jk failures --smart --xml

# From other tools
ger extract-url "build-summary" | tail -1 | jk failures --xml

# Chain commands
jk builds --urls <job> | head -1 | jk failures
```

## Common Workflows

### Investigate CI Failure

```bash
# Get smart failure analysis
jk failures --smart --xml <build-url>

# Pipe to AI for analysis
jk failures --smart --xml <build-url> | claude "Analyze these failures"
```

### Monitor Main Branch

```bash
# Watch with notifications
jk watch https://jenkins.example.com/job/Project/job/main/

# When failure appears, press 'c' to copy for AI analysis
```

### Script Integration

```bash
#!/bin/bash
jk failures <build>
case $? in
  0) echo "Build passed" ;;
  1) echo "Build has failures" ;;
  3) echo "Network error" ;;
  4) echo "Auth error - check credentials" ;;
  *) echo "Error: $?" ;;
esac
```
