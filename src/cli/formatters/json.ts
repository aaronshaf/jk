import type { BuildNode, BuildSummary } from "../../lib/jenkins/schemas.ts";

/**
 * JSON formatting for structured output
 */

/**
 * Format build nodes as JSON
 */
export const formatBuildNodesJson = (nodes: BuildNode[]): string => {
  const mapped = nodes.map((node) => ({
    id: node.id,
    displayName: node.displayName,
    state: node.state ?? "UNKNOWN",
    result: node.result ?? null,
    startTime: node.startTime ?? null,
    durationInMillis: node.durationInMillis ?? null,
  }));
  return JSON.stringify(mapped, null, 2);
};

/**
 * Format builds list as JSON (flattened for easier consumption)
 */
export const formatBuildsJson = (builds: BuildSummary[]): string => {
  const flattened = builds.map((build) => ({
    id: build.id,
    result: build.result ?? null,
    state: build.state ?? null,
    startTime: build.startTime ?? null,
    durationInMillis: build.durationInMillis ?? null,
    runSummary: build.runSummary ?? null,
    url: build._links.self.href,
    changeSet: build.changeSet?.map((c) => ({
      commitId: c.commitId,
      message: c.msg,
    })) ?? [],
    causes: build.causes?.map((c) => c.shortDescription) ?? [],
  }));
  return JSON.stringify(flattened, null, 2);
};
