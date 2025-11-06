/**
 * Effect error types for Jenkins CLI
 * @module lib/effects
 */

export {
  JenkinsError,
  ConfigError,
  ConfigNotFoundError,
  NetworkError,
  AuthenticationError,
  ValidationError,
  BuildNotFoundError,
  NodeNotFoundError,
  InvalidLocatorError,
  isJenkinsError,
} from "./errors.ts";
export type { AppError } from "./errors.ts";
