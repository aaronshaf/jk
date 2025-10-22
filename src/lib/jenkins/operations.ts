import { Effect, pipe, Array as EffectArray } from "effect";
import type { JenkinsHttpClient } from "./client.ts";
import type { Config } from "../config/schema.ts";
import {
  BuildNodesResponseSchema,
  type BuildNode,
  type FailureReport,
  type PipelineInfo,
} from "./schemas.ts";
import {
  parseLocator,
  buildNodesApiPath,
  buildNodeConsoleApiPath,
  buildNodeWebUrl,
} from "./locator.ts";
import {
  BuildNotFoundError,
  NodeNotFoundError,
  InvalidLocatorError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../effects/errors.ts";

/**
 * Jenkins build operations
 */

export interface BuildOperations {
  /**
   * Get all nodes (stages/steps) for a build
   */
  readonly getBuildNodes: (
    locator: string
  ) => Effect.Effect<
    BuildNode[],
    | InvalidLocatorError
    | NetworkError
    | AuthenticationError
    | ValidationError
    | BuildNotFoundError
  >;

  /**
   * Get console output for a specific node
   */
  readonly getNodeConsole: (
    locator: string,
    nodeId: string
  ) => Effect.Effect<
    string,
    | InvalidLocatorError
    | NetworkError
    | AuthenticationError
    | NodeNotFoundError
  >;

  /**
   * Get all failed nodes from a build
   */
  readonly getFailedNodes: (
    locator: string
  ) => Effect.Effect<
    BuildNode[],
    | InvalidLocatorError
    | NetworkError
    | AuthenticationError
    | ValidationError
    | BuildNotFoundError
  >;

  /**
   * Get failure report with optional full console output
   */
  readonly getFailureReport: (
    locator: string,
    includeFull: boolean
  ) => Effect.Effect<
    FailureReport[],
    | InvalidLocatorError
    | NetworkError
    | AuthenticationError
    | ValidationError
    | BuildNotFoundError
  >;

  /**
   * Get failure report recursively traversing sub-builds
   */
  readonly getFailureReportRecursive: (
    locator: string,
    includeFull: boolean
  ) => Effect.Effect<
    FailureReport[],
    | InvalidLocatorError
    | NetworkError
    | AuthenticationError
    | ValidationError
    | BuildNotFoundError
  >;
}

/**
 * Create build operations
 */
export const createBuildOperations = (
  client: JenkinsHttpClient,
  config: Config
): BuildOperations => ({
  getBuildNodes: (locator: string) =>
    pipe(
      parseLocator(locator),
      Effect.flatMap((pipelineInfo) =>
        pipe(
          client.getValidated(
            buildNodesApiPath(pipelineInfo),
            BuildNodesResponseSchema
          ),
          Effect.map((nodes) => Array.from(nodes)),
          Effect.mapError((error) => {
            if (
              error._tag === "NetworkError" &&
              error.statusCode === 404
            ) {
              return new BuildNotFoundError({
                message: `Build not found: ${pipelineInfo.path}/${pipelineInfo.buildNumber}`,
                pipeline: pipelineInfo.path,
                buildNumber: pipelineInfo.buildNumber,
              });
            }
            return error;
          })
        )
      )
    ),

  getNodeConsole: (locator: string, nodeId: string) =>
    pipe(
      parseLocator(locator),
      Effect.flatMap((pipelineInfo) =>
        pipe(
          client.getText(buildNodeConsoleApiPath(pipelineInfo, nodeId)),
          Effect.mapError((error) => {
            if (
              error._tag === "NetworkError" &&
              error.statusCode === 404
            ) {
              return new NodeNotFoundError({
                message: `Node not found: ${nodeId} in build ${pipelineInfo.path}/${pipelineInfo.buildNumber}`,
                pipeline: pipelineInfo.path,
                buildNumber: pipelineInfo.buildNumber,
                nodeId,
              });
            }
            return error;
          })
        )
      )
    ),

  getFailedNodes: (locator: string) =>
    pipe(
      parseLocator(locator),
      Effect.flatMap((pipelineInfo) =>
        pipe(
          client.getValidated(
            buildNodesApiPath(pipelineInfo),
            BuildNodesResponseSchema
          ),
          Effect.map((nodes) =>
            nodes.filter((node) => node.result === "FAILURE")
          )
        )
      )
    ),

  getFailureReport: (locator: string, includeFull: boolean) =>
    pipe(
      parseLocator(locator),
      Effect.flatMap((pipelineInfo) =>
        buildFailureReport(client, config, pipelineInfo, includeFull, new Set())
      )
    ),

  getFailureReportRecursive: (locator: string, includeFull: boolean) =>
    pipe(
      parseLocator(locator),
      Effect.flatMap((pipelineInfo) =>
        buildFailureReportRecursive(
          client,
          config,
          pipelineInfo,
          includeFull,
          new Set()
        )
      )
    ),
});

/**
 * Build failure report for a single build
 */
const buildFailureReport = (
  client: JenkinsHttpClient,
  config: Config,
  pipelineInfo: PipelineInfo,
  includeFull: boolean,
  visited: Set<string>
): Effect.Effect<
  FailureReport[],
  NetworkError | AuthenticationError | ValidationError | BuildNotFoundError
> =>
  pipe(
    client.getValidated(
      buildNodesApiPath(pipelineInfo),
      BuildNodesResponseSchema
    ),
    Effect.flatMap((nodes) => {
      const failedNodes = nodes.filter((node) => node.result === "FAILURE");

      return pipe(
        failedNodes,
        EffectArray.map((node) => {
          if (includeFull) {
            return pipe(
              client.getText(buildNodeConsoleApiPath(pipelineInfo, node.id)),
              Effect.map((consoleOutput): FailureReport => ({
                pipeline: pipelineInfo.path,
                buildNumber: pipelineInfo.buildNumber,
                nodeId: node.id,
                displayName: node.displayName,
                result: node.result!,
                url: buildNodeWebUrl(config.jenkinsUrl, pipelineInfo, node.id),
                consoleOutput,
              }))
            );
          } else {
            return Effect.succeed<FailureReport>({
              pipeline: pipelineInfo.path,
              buildNumber: pipelineInfo.buildNumber,
              nodeId: node.id,
              displayName: node.displayName,
              result: node.result!,
              url: buildNodeWebUrl(config.jenkinsUrl, pipelineInfo, node.id),
            });
          }
        }),
        Effect.all
      );
    })
  );

/**
 * Build failure report recursively traversing sub-builds
 */
const buildFailureReportRecursive = (
  client: JenkinsHttpClient,
  config: Config,
  pipelineInfo: PipelineInfo,
  includeFull: boolean,
  visited: Set<string>
): Effect.Effect<
  FailureReport[],
  NetworkError | AuthenticationError | ValidationError | BuildNotFoundError
> => {
  const key = `${pipelineInfo.path}/${pipelineInfo.buildNumber}`;

  // Prevent infinite loops
  if (visited.has(key)) {
    return Effect.succeed([]);
  }
  visited.add(key);

  return pipe(
    client.getValidated(
      buildNodesApiPath(pipelineInfo),
      BuildNodesResponseSchema
    ),
    Effect.mapError((error) => {
      if (
        error._tag === "NetworkError" &&
        error.statusCode === 404
      ) {
        return new BuildNotFoundError({
          message: `Build not found: ${pipelineInfo.path}/${pipelineInfo.buildNumber}`,
          pipeline: pipelineInfo.path,
          buildNumber: pipelineInfo.buildNumber,
        });
      }
      return error;
    }),
    Effect.flatMap((nodes) => {
      const failedNodes = nodes.filter((node) => node.result === "FAILURE");

      // Get failure reports for this build
      const currentFailures = pipe(
        failedNodes,
        EffectArray.map((node) => {
          if (includeFull) {
            return pipe(
              client.getText(buildNodeConsoleApiPath(pipelineInfo, node.id)),
              Effect.map((consoleOutput): FailureReport => ({
                pipeline: pipelineInfo.path,
                buildNumber: pipelineInfo.buildNumber,
                nodeId: node.id,
                displayName: node.displayName,
                result: node.result!,
                url: buildNodeWebUrl(config.jenkinsUrl, pipelineInfo, node.id),
                consoleOutput,
              }))
            );
          } else {
            return Effect.succeed<FailureReport>({
              pipeline: pipelineInfo.path,
              buildNumber: pipelineInfo.buildNumber,
              nodeId: node.id,
              displayName: node.displayName,
              result: node.result!,
              url: buildNodeWebUrl(config.jenkinsUrl, pipelineInfo, node.id),
            });
          }
        }),
        Effect.all
      );

      // Extract sub-build links from actions and get failure reports recursively
      // If a sub-build doesn't exist (404), log and continue
      const subBuildFailures = pipe(
        extractSubBuildLinks(nodes),
        Effect.flatMap((subBuildLinks) =>
          pipe(
            subBuildLinks,
            EffectArray.map((subPipeline) =>
              pipe(
                buildFailureReportRecursive(
                  client,
                  config,
                  subPipeline,
                  includeFull,
                  visited
                ),
                Effect.catchTag("BuildNotFoundError", () => Effect.succeed([]))
              )
            ),
            Effect.all,
            Effect.map((results) => results.flat())
          )
        )
      );

      // Combine current and sub-build failures
      return pipe(
        Effect.all([currentFailures, subBuildFailures]),
        Effect.map(([current, sub]) => [...current, ...sub])
      );
    })
  );
};

/**
 * Extract sub-build links from action links in nodes
 */
const extractSubBuildLinks = (
  nodes: readonly BuildNode[]
): Effect.Effect<PipelineInfo[], never> => {
  // Collect all link parsing Effects
  const parseEffects: Effect.Effect<PipelineInfo | null, never>[] = [];

  for (const node of nodes) {
    for (const action of node.actions) {
      if (action.link?.href) {
        const parseEffect = pipe(
          parseLocator(action.link.href),
          Effect.catchAll(() => Effect.succeed(null))
        );
        parseEffects.push(parseEffect);
      }
    }
  }

  // Run all parse operations and filter/deduplicate
  return pipe(
    Effect.all(parseEffects),
    Effect.map((results) => {
      const validLinks = results.filter(
        (parsed): parsed is PipelineInfo => parsed !== null
      );

      // Deduplicate by key
      const seen = new Set<string>();
      return validLinks.filter((link) => {
        const key = `${link.path}/${link.buildNumber}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    })
  );
};
