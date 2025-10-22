import { Effect, Console } from "effect";
import * as readline from "readline";
import { createDefaultConfig, type Config } from "./schema.ts";
import { writeConfig, getConfigPath } from "./manager.ts";
import { ConfigError } from "../effects/errors.ts";

/**
 * Interactive setup wizard for Jenkins CLI configuration
 */

/**
 * Create readline interface for user input
 */
const createInterface = () =>
  readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

/**
 * Prompt user for input
 */
const prompt = (question: string): Effect.Effect<string, never> =>
  Effect.async<string>((resume) => {
    const rl = createInterface();
    rl.question(question, (answer) => {
      rl.close();
      resume(Effect.succeed(answer.trim()));
    });
  });

/**
 * Validate Jenkins URL format
 */
const validateJenkinsUrl = (url: string): boolean => {
  return /^https?:\/\/.+/.test(url);
};

/**
 * Prompt for Jenkins URL with validation
 */
const promptJenkinsUrl = (): Effect.Effect<string, ConfigError> =>
  Effect.gen(function* () {
    const url = yield* prompt(
      "Enter your Jenkins base URL (e.g., https://jenkins.example.com): "
    );

    if (!url) {
      yield* Console.error("Jenkins URL cannot be empty");
      return yield* promptJenkinsUrl();
    }

    if (!validateJenkinsUrl(url)) {
      yield* Console.error(
        "Invalid URL format. Must start with http:// or https://"
      );
      return yield* promptJenkinsUrl();
    }

    return url.replace(/\/$/, ""); // Remove trailing slash
  });

/**
 * Prompt for username
 */
const promptUsername = (): Effect.Effect<string, ConfigError> =>
  Effect.gen(function* () {
    const username = yield* prompt("Enter your Jenkins username: ");

    if (!username) {
      yield* Console.error("Username cannot be empty");
      return yield* promptUsername();
    }

    return username;
  });

/**
 * Display detailed instructions for getting a Jenkins API token
 */
const showApiTokenInstructions = (jenkinsUrl: string): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    yield* Console.log("\n🔑 Getting your Jenkins API token\n");
    yield* Console.log("1️⃣  Go to your Jenkins instance:");
    yield* Console.log(`   ${jenkinsUrl}`);
    yield* Console.log("2️⃣  Click on your username in the upper right corner");
    yield* Console.log("3️⃣  Click 'Configure' in the left sidebar");
    yield* Console.log("4️⃣  Scroll down to the 'API Token' section");
    yield* Console.log("5️⃣  Click 'Add new Token' and give it a name (e.g., 'jk-cli')");
    yield* Console.log("6️⃣  Copy the generated token and paste it below\n");
  });

/**
 * Prompt for API token with detailed instructions
 */
const promptApiToken = (jenkinsUrl: string): Effect.Effect<string, ConfigError> =>
  Effect.gen(function* () {
    yield* showApiTokenInstructions(jenkinsUrl);

    const token = yield* prompt("Enter your Jenkins API token: ");

    if (!token) {
      yield* Console.error("API token cannot be empty");
      return yield* promptApiToken(jenkinsUrl);
    }

    return token;
  });

/**
 * Prompt for auth method
 */
const promptAuthMethod = (): Effect.Effect<"direct" | "env", ConfigError> =>
  Effect.gen(function* () {
    yield* Console.log("How would you like to configure jk?\n");
    yield* Console.log("  1. Environment variables (recommended - most secure)");
    yield* Console.log("  2. Config file (stores credentials in plain text)\n");

    const choice = yield* prompt("Enter your choice (1 or 2): ");

    if (choice === "1") {
      return "env";
    } else if (choice === "2") {
      return "direct";
    } else {
      yield* Console.error("Invalid choice. Please enter 1 or 2.");
      return yield* promptAuthMethod();
    }
  });

/**
 * Run the interactive setup wizard
 */
export const runSetupWizard = (): Effect.Effect<void, ConfigError> =>
  Effect.gen(function* () {
    yield* Console.log("\n=== Jenkins CLI Setup ===\n");

    // Ask auth method FIRST
    const authMethod = yield* promptAuthMethod();

    if (authMethod === "env") {
      // Environment variables - don't prompt for anything, just show instructions
      const config: Config = {
        auth: { type: "env" },
      };

      yield* writeConfig(config);
      yield* Console.log(`\n✓ Configuration saved to: ${getConfigPath()}\n`);
      yield* Console.log("📋 Required Environment Variables\n");
      yield* Console.log("Add these to your shell profile (~/.bashrc, ~/.zshrc, etc.):\n");
      yield* Console.log("  export JENKINS_URL='https://jenkins.example.com'");
      yield* Console.log("  export JENKINS_USERNAME='your-username'");
      yield* Console.log("  export JENKINS_API_TOKEN='your-api-token'\n");

      yield* Console.log("🔑 Getting your Jenkins API token\n");
      yield* Console.log("1️⃣  Go to your Jenkins instance");
      yield* Console.log("2️⃣  Click on your username in the upper right corner");
      yield* Console.log("3️⃣  Click 'Configure' in the left sidebar");
      yield* Console.log("4️⃣  Scroll down to the 'API Token' section");
      yield* Console.log("5️⃣  Click 'Add new Token' and give it a name (e.g., 'jk-cli')");
      yield* Console.log("6️⃣  Copy the generated token\n");

      yield* Console.log("After setting environment variables, reload your shell:");
      yield* Console.log("  source ~/.zshrc  # or ~/.bashrc\n");
      yield* Console.log("Then verify with:");
      yield* Console.log("  jk build <your-build-url>\n");
    } else {
      // Config file - prompt for everything
      yield* Console.log("\n⚠️  Warning: This will store credentials in plain text!");
      yield* Console.log("   Consider using environment variables instead.\n");

      const confirmed = yield* prompt("Continue with config file? (y/n): ");
      if (confirmed.toLowerCase() !== "y" && confirmed.toLowerCase() !== "yes") {
        yield* Console.log("Setup cancelled.");
        return;
      }

      const jenkinsUrl = yield* promptJenkinsUrl();
      const username = yield* promptUsername();
      const apiToken = yield* promptApiToken(jenkinsUrl);

      const config = createDefaultConfig(jenkinsUrl, username, apiToken);

      yield* writeConfig(config);
      yield* Console.log(`\n✓ Configuration saved to: ${getConfigPath()}`);
      yield* Console.log(
        "\nCredentials stored with secure file permissions (600)."
      );
      yield* Console.log(
        "Consider using environment variables for better security (run 'jk setup' again to switch).\n"
      );
    }
  });
