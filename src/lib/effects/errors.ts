import { Data } from "effect";

/**
 * Base error class for all Jenkins CLI errors
 */
export abstract class JenkinsError extends Data.TaggedError("JenkinsError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {
  abstract readonly module: string;
}

/**
 * Configuration-related errors
 */
export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string;
  readonly field?: string;
  readonly cause?: unknown;
}> {
  readonly module = "config";
}

export class ConfigNotFoundError extends Data.TaggedError(
  "ConfigNotFoundError"
)<{
  readonly message: string;
  readonly path: string;
}> {
  readonly module = "config";
}

/**
 * Network and HTTP errors
 */
export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly message: string;
  readonly url?: string;
  readonly statusCode?: number;
  readonly cause?: unknown;
}> {
  readonly module = "network";
}

export class AuthenticationError extends Data.TaggedError(
  "AuthenticationError"
)<{
  readonly message: string;
  readonly url?: string;
}> {
  readonly module = "network";
}

/**
 * Validation errors
 */
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly field?: string;
  readonly value?: unknown;
  readonly cause?: unknown;
}> {
  readonly module = "validation";
}

/**
 * Jenkins API errors
 */
export class BuildNotFoundError extends Data.TaggedError("BuildNotFoundError")<{
  readonly message: string;
  readonly pipeline: string;
  readonly buildNumber: number;
}> {
  readonly module = "jenkins";
}

export class NodeNotFoundError extends Data.TaggedError("NodeNotFoundError")<{
  readonly message: string;
  readonly pipeline: string;
  readonly buildNumber: number;
  readonly nodeId: string;
}> {
  readonly module = "jenkins";
}

/**
 * CLI argument parsing errors
 */
export class InvalidLocatorError extends Data.TaggedError(
  "InvalidLocatorError"
)<{
  readonly message: string;
  readonly locator: string;
}> {
  readonly module = "cli";
}

/**
 * Type guard to check if error is a JenkinsError
 */
export const isJenkinsError = (error: unknown): error is JenkinsError => {
  return error instanceof JenkinsError;
};

/**
 * Type for all possible errors in the application
 */
export type AppError =
  | ConfigError
  | ConfigNotFoundError
  | NetworkError
  | AuthenticationError
  | ValidationError
  | BuildNotFoundError
  | NodeNotFoundError
  | InvalidLocatorError;
