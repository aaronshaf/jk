import { Schema } from "effect";

/**
 * Configuration schema for Jenkins CLI
 * Stored at ~/.config/jk/config.json
 */

/**
 * Direct username/password authentication
 */
export const DirectAuthSchema = Schema.Struct({
  type: Schema.Literal("direct"),
  username: Schema.String.pipe(Schema.minLength(1)),
  apiToken: Schema.String.pipe(Schema.minLength(1)),
});
export type DirectAuth = Schema.Schema.Type<typeof DirectAuthSchema>;

/**
 * Environment variable authentication
 */
export const EnvAuthSchema = Schema.Struct({
  type: Schema.Literal("env"),
});
export type EnvAuth = Schema.Schema.Type<typeof EnvAuthSchema>;

/**
 * Auth schema - either direct or env
 */
export const AuthSchema = Schema.Union(DirectAuthSchema, EnvAuthSchema);
export type Auth = Schema.Schema.Type<typeof AuthSchema>;

/**
 * Main configuration
 */
export const ConfigSchema = Schema.Struct({
  jenkinsUrl: Schema.String.pipe(
    Schema.pattern(/^https?:\/\/.+/),
    Schema.annotations({
      title: "Jenkins Base URL",
      description: "Base URL of your Jenkins server (e.g., https://jenkins.example.com)",
    })
  ),
  auth: AuthSchema,
});
export type Config = Schema.Schema.Type<typeof ConfigSchema>;

/**
 * Default config template for setup wizard
 */
export const createDefaultConfig = (
  jenkinsUrl: string,
  username: string,
  apiToken: string
): Config => ({
  jenkinsUrl: jenkinsUrl.replace(/\/$/, ""), // Remove trailing slash
  auth: {
    type: "direct",
    username,
    apiToken,
  },
});
