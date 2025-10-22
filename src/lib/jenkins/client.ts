import { Effect, pipe } from "effect";
import { Schema } from "effect";
import {
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../effects/errors.ts";
import type { Config } from "../config/schema.ts";
import { getAuthHeader } from "../config/manager.ts";

/**
 * Jenkins HTTP client for Blue Ocean REST API
 * Base path: /blue/rest/organizations/jenkins
 */

export interface JenkinsHttpClient {
  /**
   * Make a GET request to Jenkins API
   */
  readonly get: (
    path: string
  ) => Effect.Effect<unknown, NetworkError | AuthenticationError>;

  /**
   * Make a GET request and validate response with schema
   */
  readonly getValidated: <A, I>(
    path: string,
    schema: Schema.Schema<A, I, never>
  ) => Effect.Effect<
    A,
    NetworkError | AuthenticationError | ValidationError
  >;

  /**
   * Get raw text response (for console logs)
   */
  readonly getText: (
    path: string
  ) => Effect.Effect<string, NetworkError | AuthenticationError>;
}

/**
 * Create Jenkins HTTP client
 */
export const createJenkinsClient = (
  config: Config
): Effect.Effect<JenkinsHttpClient, never> =>
  Effect.succeed({
    get: (path: string) => makeRequest(config, path, "json"),
    getValidated: <A, I>(path: string, schema: Schema.Schema<A, I, never>) =>
      pipe(
        makeRequest(config, path, "json"),
        Effect.flatMap((data) =>
          Schema.decodeUnknown(schema)(data).pipe(
            Effect.mapError(
              (error) =>
                new ValidationError({
                  message: `Failed to validate Jenkins API response: ${error}`,
                  cause: error,
                })
            )
          )
        )
      ),
    getText: (path: string) =>
      makeRequest(config, path, "text") as Effect.Effect<
        string,
        NetworkError | AuthenticationError
      >,
  });

/**
 * Build full Jenkins API URL
 */
const buildUrl = (config: Config, path: string): string => {
  const baseUrl = config.jenkinsUrl.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
};

/**
 * Make HTTP request to Jenkins
 */
const makeRequest = (
  config: Config,
  path: string,
  responseType: "json" | "text"
): Effect.Effect<unknown, NetworkError | AuthenticationError> =>
  Effect.gen(function* () {
    const url = buildUrl(config, path);
    const authHeader = getAuthHeader(config);

    try {
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(url, {
            headers: {
              Authorization: authHeader,
              Accept:
                responseType === "json"
                  ? "application/json"
                  : "text/plain",
            },
            signal: AbortSignal.timeout(30000), // 30 second timeout
          }),
        catch: (error) =>
          new NetworkError({
            message: `Failed to fetch from Jenkins: ${error}`,
            url,
            cause: error,
          }),
      });

      // Check for authentication errors
      if (response.status === 401 || response.status === 403) {
        return yield* Effect.fail(
          new AuthenticationError({
            message: "Authentication failed. Check your username and API token.",
            url,
          })
        );
      }

      // Check for other HTTP errors
      if (!response.ok) {
        return yield* Effect.fail(
          new NetworkError({
            message: `HTTP ${response.status}: ${response.statusText}`,
            url,
            statusCode: response.status,
          })
        );
      }

      // Parse response based on type
      if (responseType === "json") {
        return yield* Effect.tryPromise({
          try: () => response.json(),
          catch: (error) =>
            new NetworkError({
              message: `Failed to parse JSON response: ${error}`,
              url,
              cause: error,
            }),
        });
      } else {
        return yield* Effect.tryPromise({
          try: () => response.text(),
          catch: (error) =>
            new NetworkError({
              message: `Failed to read text response: ${error}`,
              url,
              cause: error,
            }),
        });
      }
    } catch (error) {
      return yield* Effect.fail(
        new NetworkError({
          message: `Unexpected error during request: ${error}`,
          url,
          cause: error,
        })
      );
    }
  });
