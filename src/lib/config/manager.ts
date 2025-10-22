import { Effect, pipe } from "effect";
import { Schema } from "effect";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Config, ConfigSchema } from "./schema.ts";
import { ConfigError, ConfigNotFoundError, ValidationError } from "../effects/errors.ts";

/**
 * Configuration manager for reading/writing Jenkins CLI config
 */

/**
 * Get the XDG config directory path
 */
export const getConfigDir = (): string => {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  const home = os.homedir();

  // Validate XDG_CONFIG_HOME if set
  const baseDir = (() => {
    if (!xdgConfigHome) {
      return path.join(home, ".config");
    }

    // Ensure it's an absolute path
    if (!path.isAbsolute(xdgConfigHome)) {
      console.warn(`Warning: XDG_CONFIG_HOME is not an absolute path, using default ~/.config`);
      return path.join(home, ".config");
    }

    // Use path.resolve to get canonical path and check for path traversal
    const resolved = path.resolve(xdgConfigHome);
    const homeResolved = path.resolve(home);

    // Ensure the resolved path doesn't escape user's home directory
    // Allow XDG_CONFIG_HOME to be anywhere in home dir or system-wide config dirs
    const isInHome = resolved.startsWith(homeResolved);
    const isSystemConfig = resolved.startsWith('/etc') ||
                          resolved.startsWith('/usr/local/etc') ||
                          resolved === '/opt/config';

    if (!isInHome && !isSystemConfig) {
      console.warn(`Warning: XDG_CONFIG_HOME points outside safe directories, using default ~/.config`);
      return path.join(home, ".config");
    }

    return resolved;
  })();

  return path.join(baseDir, "jk");
};

/**
 * Get the full path to the config file
 */
export const getConfigPath = (): string => {
  return path.join(getConfigDir(), "config.json");
};

/**
 * Check if config file exists
 */
export const configExists = (): Effect.Effect<boolean, never> =>
  Effect.sync(() => {
    try {
      return fs.existsSync(getConfigPath());
    } catch {
      return false;
    }
  });

/**
 * Ensure config directory exists
 */
export const ensureConfigDir = (): Effect.Effect<void, ConfigError> =>
  Effect.try({
    try: () => {
      const dir = getConfigDir();
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    },
    catch: (error) =>
      new ConfigError({
        message: `Failed to create config directory: ${error}`,
        cause: error,
      }),
  });

/**
 * Read and parse config file
 */
export const readConfig = (): Effect.Effect<
  Config,
  ConfigNotFoundError | ConfigError | ValidationError
> =>
  pipe(
    Effect.try({
      try: () => {
        const configPath = getConfigPath();
        if (!fs.existsSync(configPath)) {
          throw new Error("Config file not found");
        }
        return fs.readFileSync(configPath, "utf-8");
      },
      catch: (error) => {
        if (error instanceof Error && error.message === "Config file not found") {
          return new ConfigNotFoundError({
            message: `Config file not found. Run 'jk setup' to create it.`,
            path: getConfigPath(),
          });
        }
        return new ConfigError({
          message: `Failed to read config file: ${error}`,
          cause: error,
        });
      },
    }),
    Effect.flatMap((content) =>
      Effect.try({
        try: () => JSON.parse(content),
        catch: (error) =>
          new ConfigError({
            message: `Failed to parse config file: ${error}`,
            cause: error,
          }),
      })
    ),
    Effect.flatMap((data) =>
      Schema.decodeUnknown(ConfigSchema)(data).pipe(
        Effect.mapError(
          (error) =>
            new ConfigError({
              message: `Invalid config format: ${error}`,
              cause: error,
            })
        )
      )
    )
  );

/**
 * Write config file
 */
export const writeConfig = (
  config: Config
): Effect.Effect<void, ConfigError> =>
  pipe(
    ensureConfigDir(),
    Effect.flatMap(() =>
      Effect.try({
        try: () => {
          const configPath = getConfigPath();
          const content = JSON.stringify(config, null, 2);
          fs.writeFileSync(configPath, content, { mode: 0o600 }); // chmod 600
        },
        catch: (error) =>
          new ConfigError({
            message: `Failed to write config file: ${error}`,
            cause: error,
          }),
      })
    )
  );

/**
 * Get Jenkins URL from config or environment
 */
export const getJenkinsUrl = (config: Config): string => {
  // If using env auth, check JENKINS_URL env var first
  if (config.auth.type === "env") {
    const envUrl = process.env.JENKINS_URL;
    if (envUrl) {
      return envUrl.replace(/\/$/, ""); // Remove trailing slash
    }
  }

  // Fall back to config file
  if (config.jenkinsUrl) {
    return config.jenkinsUrl;
  }

  throw new Error(
    "Jenkins URL not configured. Set JENKINS_URL environment variable or run 'jk setup'"
  );
};

/**
 * Get the basic auth header value
 */
export const getAuthHeader = (config: Config): string => {
  let username: string;
  let apiToken: string;

  if (config.auth.type === "direct") {
    username = config.auth.username;
    apiToken = config.auth.apiToken;
  } else {
    // env type - read from environment variables
    username = process.env.JENKINS_USERNAME || "";
    apiToken = process.env.JENKINS_API_TOKEN || "";

    if (!username || !apiToken) {
      throw new Error(
        "Environment variable auth configured but JENKINS_USERNAME or JENKINS_API_TOKEN not set"
      );
    }
  }

  const credentials = `${username}:${apiToken}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
};
