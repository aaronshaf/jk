/**
 * Semantic exit codes for jk CLI
 *
 * Following BSD sysexits.h conventions where applicable.
 * These codes allow scripts to distinguish between different failure modes.
 *
 * @example
 * ```bash
 * jk failures pipelines/my-job/123
 * case $? in
 *   0) echo "No failures" ;;
 *   1) echo "Build has failures" ;;
 *   2) echo "Config error - run jk setup" ;;
 *   3) echo "Auth failed - check credentials" ;;
 *   4) echo "Network error - check Jenkins URL" ;;
 *   5) echo "Build not found" ;;
 *   64) echo "Invalid arguments" ;;
 *   70) echo "Internal error" ;;
 * esac
 * ```
 */
export const EXIT_CODES = {
  /** Success - command completed without issues */
  SUCCESS: 0,

  /** Failures found - build has failed nodes (expected outcome for failures command) */
  FAILURES_FOUND: 1,

  /** Configuration error - missing or invalid config file */
  CONFIG_ERROR: 2,

  /** Authentication error - invalid credentials or token */
  AUTH_ERROR: 3,

  /** Network error - cannot reach Jenkins server */
  NETWORK_ERROR: 4,

  /** Not found - build, pipeline, or node doesn't exist */
  NOT_FOUND: 5,

  /** Invalid arguments - bad CLI usage (BSD EX_USAGE) */
  INVALID_ARGS: 64,

  /** Internal error - unexpected failure (BSD EX_SOFTWARE) */
  INTERNAL_ERROR: 70,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

/**
 * Maps typed errors to appropriate exit codes
 */
export const getExitCodeForError = (error: { readonly _tag: string }): ExitCode => {
  switch (error._tag) {
    case "ConfigError":
    case "ConfigNotFoundError":
      return EXIT_CODES.CONFIG_ERROR;

    case "AuthenticationError":
      return EXIT_CODES.AUTH_ERROR;

    case "NetworkError":
      return EXIT_CODES.NETWORK_ERROR;

    case "BuildNotFoundError":
    case "NodeNotFoundError":
      return EXIT_CODES.NOT_FOUND;

    case "InvalidLocatorError":
      return EXIT_CODES.INVALID_ARGS;

    case "ValidationError":
      return EXIT_CODES.INTERNAL_ERROR;

    default:
      return EXIT_CODES.INTERNAL_ERROR;
  }
};
