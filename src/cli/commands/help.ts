import { bold, cyan, gray } from "../formatters/colors.ts";

/**
 * Help command - display usage information
 */
export const showHelp = (command?: string): void => {
  if (command === "setup") {
    showSetupHelp();
  } else if (command === "build") {
    showBuildHelp();
  } else if (command === "failures") {
    showFailuresHelp();
  } else if (command === "console") {
    showConsoleHelp();
  } else {
    showGeneralHelp();
  }
};

const showGeneralHelp = (): void => {
  console.log(`
${bold("jk - Modern Jenkins CLI")}

${bold("Usage:")}
  jk ${cyan("<command>")} ${gray("[options]")}

${bold("Commands:")}
  ${cyan("setup")}              Interactive setup wizard for configuration
  ${cyan("build")} <locator>     Show build information and status
  ${cyan("failures")} <locator>  Show failed nodes in a build
  ${cyan("console")} <locator> <node-id>
                       Get console output for a specific node
  ${cyan("help")} [command]      Show help for a command

${bold("Global Options:")}
  --verbose, -v      Show detailed error information
  --help, -h         Show help

${bold("Examples:")}
  jk setup
  jk build pipelines/MyProject/main/123
  jk failures --recursive pipelines/MyProject/main/123
  jk console pipelines/MyProject/main/123 node-456

${bold("Stdin Piping:")}
  All commands that accept a locator can read it from stdin:
  echo "123" | jk build
  echo "pipelines/MyProject/main/123" | jk failures
  pbpaste | jk console

${bold("Locator Formats:")}
  Full URL:          https://jenkins.example.com/job/MyProject/123/
  Pipeline URL:      https://jenkins.example.com/.../pipelines/MyProject/runs/123
  Pipeline path:     pipelines/MyProject/main/123
  Pipeline with runs: pipelines/MyProject/main/runs/123

For more information on a specific command, run: ${cyan("jk help <command>")}
`);
};

const showSetupHelp = (): void => {
  console.log(`
${bold("jk setup")}

Interactive setup wizard to configure Jenkins credentials.

${bold("Usage:")}
  jk setup

${bold("What it does:")}
  - Prompts for Jenkins base URL
  - Prompts for username
  - Prompts for API token
  - Saves configuration to ~/.config/jk/config.json

${bold("Note:")}
  Your credentials are stored in plain text.
  Make sure to set appropriate file permissions (chmod 600).
`);
};

const showBuildHelp = (): void => {
  console.log(`
${bold("jk build")}

Show build information including all nodes and their status.

${bold("Usage:")}
  jk build <locator> [options]
  echo <locator> | jk build [options]

${bold("Options:")}
  --verbose, -v      Show detailed node information
  --xml              Output as XML (for LLM consumption)
  --help, -h         Show this help

${bold("Examples:")}
  jk build pipelines/MyProject/main/123
  jk build https://jenkins.example.com/job/MyProject/123/
  jk build --verbose pipelines/MyProject/main/123
  jk build --xml pipelines/MyProject/main/123

${bold("Stdin Piping:")}
  echo "pipelines/MyProject/main/123" | jk build
  echo "123" | jk build
  pbpaste | jk build --xml
`);
};

const showFailuresHelp = (): void => {
  console.log(`
${bold("jk failures")}

Show failed nodes in a build with optional console output.
By default, recursively traverses sub-builds to find root causes.

${bold("Usage:")}
  jk failures <locator> [options]
  echo <locator> | jk failures [options]

${bold("Options:")}
  --full             Include full console output for failures
  --shallow          Only inspect the specified build (no sub-builds)
  --recursive, -r    Recursively traverse sub-builds (default behavior)
  --tail <n>         Include last N lines of console output
  --grep <pattern>   Filter console output by pattern (case-insensitive)
  --smart            Smart mode: last 100 lines + all error/fail/exception lines
  --json             Output as JSON
  --xml              Output as XML (for LLM consumption)
  --verbose, -v      Show detailed error information
  --help, -h         Show this help

${bold("Examples:")}
  jk failures pipelines/MyProject/main/123
  jk failures --shallow pipelines/MyProject/main/123
  jk failures --full pipelines/MyProject/main/123
  jk failures --tail 200 --xml pipelines/MyProject/main/123
  jk failures --grep "ERROR|FATAL" --xml pipelines/MyProject/main/123
  jk failures --smart --xml pipelines/MyProject/main/123

${bold("Stdin Piping:")}
  echo "123" | jk failures
  echo "pipelines/MyProject/main/123" | jk failures --xml
  jk failures --xml pipelines/MyProject/main/123 | pbcopy
  pbpaste | jk failures --smart --xml | pbcopy

${bold("Console Output Modes:")}
  (none)             Show failure metadata only (no console output)
  --full             Full console output (can be large!)
  --tail <n>         Last N lines only (recommended: 100-200)
  --grep <pattern>   Only lines matching pattern
  --smart            Auto-extract errors + tail (best for LLMs)

${bold("Traversal Modes:")}
  (default)          Recursive - follows sub-builds to find root causes
  --shallow          Non-recursive - only the specified build
`);
};

const showConsoleHelp = (): void => {
  console.log(`
${bold("jk console")}

Get console output for a specific node in a build.
Output is plain text and can be piped to other commands.

${bold("Usage:")}
  jk console <locator> <node-id> [options]
  jk console <blue-ocean-node-url> [options]
  echo <url> | jk console [options]

${bold("Options:")}
  --verbose, -v      Show detailed error information
  --help, -h         Show this help

${bold("Examples:")}
  ${gray("# Traditional format (locator + node-id):")}
  jk console pipelines/MyProject/main/123 node-456
  jk console pipelines/MyProject/main/123 node-456 | grep ERROR

  ${gray("# Blue Ocean URL (copy-paste from jk failures output):")}
  jk console https://jenkins.example.com/blue/.../pipelines/MyProject/main/detail/main/154928/pipeline/534
  jk console https://jenkins.example.com/blue/.../pipelines/MyProject/main/detail/main/154928/pipeline/534 | less

${bold("Stdin Piping:")}
  ${gray("# Pipe URL from stdin:")}
  echo "https://jenkins.example.com/blue/.../pipeline/534" | jk console
  pbpaste | jk console | grep -i error
  jk failures --xml pipelines/MyProject/main/123 | grep -oP 'url="\\K[^"]+' | head -1 | jk console

${bold("Tip:")}
  Run ${cyan("jk failures <locator>")} to see all failed nodes with URLs,
  then copy-paste any URL directly into ${cyan("jk console <url>")}
`);
};
