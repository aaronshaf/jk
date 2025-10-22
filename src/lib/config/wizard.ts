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
    yield* Console.log("\nHow would you like to provide credentials?");
    yield* Console.log("  1. Store in config file (plain text with 600 permissions)");
    yield* Console.log("  2. Use environment variables (JENKINS_USERNAME, JENKINS_API_TOKEN)");

    const choice = yield* prompt("\nEnter your choice (1 or 2): ");

    if (choice === "1") {
      return "direct";
    } else if (choice === "2") {
      return "env";
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

    const jenkinsUrl = yield* promptJenkinsUrl();
    const authMethod = yield* promptAuthMethod();

    let config: Config;

    if (authMethod === "direct") {
      const username = yield* promptUsername();
      const apiToken = yield* promptApiToken(jenkinsUrl);
      config = createDefaultConfig(jenkinsUrl, username, apiToken);

      yield* writeConfig(config);
      yield* Console.log(`\n✓ Configuration saved to: ${getConfigPath()}`);
      yield* Console.log(
        "\nNote: Your credentials are stored in plain text with secure file permissions (600)."
      );
      yield* Console.log(
        "Consider using environment variables for better security (run 'jk setup' again to switch).\n"
      );
    } else {
      // env method
      config = {
        jenkinsUrl,
        auth: { type: "env" },
      };

      yield* writeConfig(config);
      yield* Console.log(`\n✓ Configuration saved to: ${getConfigPath()}`);
      yield* Console.log(
        "\nBefore using jk, set these environment variables:"
      );
      yield* Console.log("  export JENKINS_USERNAME='your-username'");
      yield* Console.log("  export JENKINS_API_TOKEN='your-api-token'\n");

      yield* showApiTokenInstructions(jenkinsUrl);
    }
  });
