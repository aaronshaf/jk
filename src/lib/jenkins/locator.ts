import { Effect } from "effect";
import { InvalidLocatorError } from "../effects/errors.ts";
import type { PipelineInfo } from "./schemas.ts";

/**
 * Parse various Jenkins locator formats into pipeline path and build number
 *
 * Supported formats:
 * 1. Full Jenkins URL with /job/: https://jenkins.example.com/job/MyProject/job/main/123/
 * 2. Full Jenkins URL with /pipelines/: https://jenkins.example.com/blue/.../pipelines/MyProject/main/runs/123
 * 3. Pipeline path with build: pipelines/MyProject/main/123
 * 4. Pipeline path with /runs/: pipelines/MyProject/main/runs/123
 */

// Regex patterns for different locator formats
const JOB_URL_REGEX = /\/job\/([^/]+(?:\/job\/[^/]+)*)\/(\d+)/;
const PIPELINE_URL_REGEX = /\/pipelines\/([^/]+(?:\/[^/]+)*)\/runs\/(\d+)/;
const PIPELINE_PATH_REGEX = /^pipelines\/([^/]+(?:\/[^/]+)*)\/(\d+)$/;
const PIPELINE_PATH_WITH_RUNS_REGEX =
  /^pipelines\/([^/]+(?:\/[^/]+)*)\/runs\/(\d+)$/;

// Blue Ocean node URL format: .../pipelines/Path/detail/BranchName/BuildNumber/pipeline/NodeId
const PIPELINE_NODE_URL_REGEX = /\/pipelines\/([^/]+(?:\/[^/]+)*)\/detail\/[^/]+\/(\d+)\/pipeline\/(\d+)/;

// Valid characters for pipeline path segments: alphanumeric, underscore, hyphen, dot
const SAFE_PATH_SEGMENT_REGEX = /^[a-zA-Z0-9_.-]+$/;

/**
 * Validate that a pipeline path only contains safe characters
 * Prevents path traversal and shell injection attacks
 */
const validatePipelinePath = (path: string): boolean => {
  const segments = path.split('/').filter(seg => seg.length > 0);

  // Check each segment contains only safe characters
  for (const segment of segments) {
    if (!SAFE_PATH_SEGMENT_REGEX.test(segment)) {
      return false;
    }
    // Prevent path traversal attempts
    if (segment === '..' || segment === '.') {
      return false;
    }
  }

  return segments.length > 0;
};

/**
 * Parse a locator string into pipeline info
 */
export const parseLocator = (
  locator: string
): Effect.Effect<PipelineInfo, InvalidLocatorError> => {
  // Try to match /job/ URL format
  const jobMatch = locator.match(JOB_URL_REGEX);
  if (jobMatch) {
    const jobPath = jobMatch[1];
    const buildNumber = parseInt(jobMatch[2], 10);
    // Convert /job/Foo/job/Bar to pipelines/Foo/Bar
    const pipelinePath = `pipelines/${jobPath.replace(/\/job\//g, "/")}`;

    // Validate path contains only safe characters
    if (!validatePipelinePath(pipelinePath)) {
      return Effect.fail(
        new InvalidLocatorError({
          message: "Pipeline path contains invalid characters. Only alphanumeric, underscore, hyphen, and dot are allowed.",
          locator,
        })
      );
    }

    return Effect.succeed({
      path: pipelinePath,
      buildNumber,
    });
  }

  // Try to match /pipelines/ URL format
  const pipelineUrlMatch = locator.match(PIPELINE_URL_REGEX);
  if (pipelineUrlMatch) {
    // Remove all /pipelines/ prefixes that appear in the Blue Ocean API path
    // Example: "MyProject/pipelines/test-suites/pipelines/JS" -> "MyProject/test-suites/JS"
    const rawPath = pipelineUrlMatch[1].replace(/\/pipelines\//g, "/");
    const pipelinePath = `pipelines/${rawPath}`;
    const buildNumber = parseInt(pipelineUrlMatch[2], 10);

    // Validate path contains only safe characters
    if (!validatePipelinePath(pipelinePath)) {
      return Effect.fail(
        new InvalidLocatorError({
          message: "Pipeline path contains invalid characters. Only alphanumeric, underscore, hyphen, and dot are allowed.",
          locator,
        })
      );
    }

    return Effect.succeed({
      path: pipelinePath,
      buildNumber,
    });
  }

  // Try to match pipeline path with /runs/
  const pipelineRunsMatch = locator.match(PIPELINE_PATH_WITH_RUNS_REGEX);
  if (pipelineRunsMatch) {
    const pipelinePath = `pipelines/${pipelineRunsMatch[1]}`;
    const buildNumber = parseInt(pipelineRunsMatch[2], 10);

    // Validate path contains only safe characters
    if (!validatePipelinePath(pipelinePath)) {
      return Effect.fail(
        new InvalidLocatorError({
          message: "Pipeline path contains invalid characters. Only alphanumeric, underscore, hyphen, and dot are allowed.",
          locator,
        })
      );
    }

    return Effect.succeed({
      path: pipelinePath,
      buildNumber,
    });
  }

  // Try to match simple pipeline path
  const pipelinePathMatch = locator.match(PIPELINE_PATH_REGEX);
  if (pipelinePathMatch) {
    const pipelinePath = `pipelines/${pipelinePathMatch[1]}`;
    const buildNumber = parseInt(pipelinePathMatch[2], 10);

    // Validate path contains only safe characters
    if (!validatePipelinePath(pipelinePath)) {
      return Effect.fail(
        new InvalidLocatorError({
          message: "Pipeline path contains invalid characters. Only alphanumeric, underscore, hyphen, and dot are allowed.",
          locator,
        })
      );
    }

    return Effect.succeed({
      path: pipelinePath,
      buildNumber,
    });
  }

  // No match found
  return Effect.fail(
    new InvalidLocatorError({
      message: `Invalid locator format. Expected one of:
  - Jenkins URL: https://jenkins.example.com/job/MyProject/123/
  - Pipeline URL: https://jenkins.example.com/.../pipelines/MyProject/runs/123
  - Pipeline path: pipelines/MyProject/123
  - Pipeline path with runs: pipelines/MyProject/runs/123`,
      locator,
    })
  );
};

/**
 * Build the Blue Ocean API path for build nodes
 */
export const buildNodesApiPath = (pipelineInfo: PipelineInfo): string => {
  return `/blue/rest/organizations/jenkins/${pipelineInfo.path}/runs/${pipelineInfo.buildNumber}/nodes/`;
};

/**
 * Build the Blue Ocean API path for node console output
 */
export const buildNodeConsoleApiPath = (
  pipelineInfo: PipelineInfo,
  nodeId: string
): string => {
  return `/blue/rest/organizations/jenkins/${pipelineInfo.path}/runs/${pipelineInfo.buildNumber}/nodes/${nodeId}/log/`;
};

/**
 * Build a human-readable URL for a build
 */
export const buildWebUrl = (
  jenkinsBaseUrl: string,
  pipelineInfo: PipelineInfo
): string => {
  const baseUrl = jenkinsBaseUrl.replace(/\/$/, "");
  return `${baseUrl}/blue/organizations/jenkins/${pipelineInfo.path}/detail/${pipelineInfo.path.split("/").pop()}/${pipelineInfo.buildNumber}/`;
};

/**
 * Build a human-readable URL for a specific node
 */
export const buildNodeWebUrl = (
  jenkinsBaseUrl: string,
  pipelineInfo: PipelineInfo,
  nodeId: string
): string => {
  return `${buildWebUrl(jenkinsBaseUrl, pipelineInfo)}pipeline/${nodeId}`;
};

/**
 * Parse a Blue Ocean node URL to extract pipeline info and node ID
 * Example: https://jenkins.example.com/blue/.../pipelines/MyProject/main/detail/main/154928/pipeline/534
 * Returns: { pipelineInfo: { path: "pipelines/MyProject/main", buildNumber: 154928 }, nodeId: "534" }
 */
export const parseNodeUrl = (
  url: string
): Effect.Effect<
  { pipelineInfo: PipelineInfo; nodeId: string },
  InvalidLocatorError
> => {
  const nodeMatch = url.match(PIPELINE_NODE_URL_REGEX);
  if (!nodeMatch) {
    return Effect.fail(
      new InvalidLocatorError({
        message: `Invalid node URL format. Expected Blue Ocean pipeline node URL like:
  https://jenkins.example.com/blue/.../pipelines/Project/Branch/detail/Branch/BuildNumber/pipeline/NodeId`,
        locator: url,
      })
    );
  }

  // Remove all /pipelines/ prefixes that appear in the Blue Ocean API path
  const rawPath = nodeMatch[1].replace(/\/pipelines\//g, "/");
  const pipelinePath = `pipelines/${rawPath}`;
  const buildNumber = parseInt(nodeMatch[2], 10);
  const nodeId = nodeMatch[3];

  // Validate path contains only safe characters
  if (!validatePipelinePath(pipelinePath)) {
    return Effect.fail(
      new InvalidLocatorError({
        message:
          "Pipeline path contains invalid characters. Only alphanumeric, underscore, hyphen, and dot are allowed.",
        locator: url,
      })
    );
  }

  return Effect.succeed({
    pipelineInfo: {
      path: pipelinePath,
      buildNumber,
    },
    nodeId,
  });
};
