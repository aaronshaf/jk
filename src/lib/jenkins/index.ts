/**
 * Jenkins API client and operations
 * @module lib/jenkins
 */

// Client
export { createJenkinsClient } from "./client.ts";
export type { JenkinsHttpClient } from "./client.ts";

// Operations
export { createBuildOperations } from "./operations.ts";
export type { BuildOperations } from "./operations.ts";

// Schemas and types
export {
  BuildResultSchema,
  BuildStateSchema,
  ActionLinkSchema,
  ActionSchema,
  BuildNodeSchema,
  BuildNodesResponseSchema,
  ConsoleLogSchema,
  PipelineInfoSchema,
  FailureReportSchema,
} from "./schemas.ts";
export type {
  BuildResult,
  BuildState,
  ActionLink,
  Action,
  BuildNode,
  BuildNodesResponse,
  ConsoleLog,
  PipelineInfo,
  FailureReport,
} from "./schemas.ts";

// Locator utilities
export {
  parseLocator,
  buildNodesApiPath,
  buildNodeConsoleApiPath,
  buildNodeWebUrl,
} from "./locator.ts";
