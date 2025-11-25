import { Schema } from "effect";

/**
 * Jenkins Blue Ocean API Response Schemas
 * Based on: /blue/rest/organizations/jenkins/pipelines/{path}/runs/{num}/nodes/
 */

/**
 * Build result status
 */
export const BuildResultSchema = Schema.Literal(
  "SUCCESS",
  "FAILURE",
  "UNSTABLE",
  "ABORTED",
  "NOT_BUILT"
);
export type BuildResult = Schema.Schema.Type<typeof BuildResultSchema>;

/**
 * Build state
 */
export const BuildStateSchema = Schema.Literal(
  "FINISHED",
  "RUNNING",
  "QUEUED",
  "PAUSED",
  "SKIPPED",
  "NOT_BUILT"
);
export type BuildState = Schema.Schema.Type<typeof BuildStateSchema>;

/**
 * Action link for sub-builds
 */
export const ActionLinkSchema = Schema.Struct({
  href: Schema.String,
});
export type ActionLink = Schema.Schema.Type<typeof ActionLinkSchema>;

/**
 * Action with optional link
 */
export const ActionSchema = Schema.Struct({
  link: Schema.optional(ActionLinkSchema),
});
export type Action = Schema.Schema.Type<typeof ActionSchema>;

/**
 * Build node (stage/step in a build)
 */
export const BuildNodeSchema = Schema.Struct({
  id: Schema.String,
  displayName: Schema.String,
  result: Schema.optional(Schema.NullOr(BuildResultSchema)),
  state: BuildStateSchema,
  startTime: Schema.optional(Schema.NullOr(Schema.String)),
  durationInMillis: Schema.optional(Schema.NullOr(Schema.Number)),
  actions: Schema.Array(ActionSchema),
});
export type BuildNode = Schema.Schema.Type<typeof BuildNodeSchema>;

/**
 * Array of build nodes (main API response)
 */
export const BuildNodesResponseSchema = Schema.Array(BuildNodeSchema);
export type BuildNodesResponse = Schema.Schema.Type<
  typeof BuildNodesResponseSchema
>;

/**
 * Console log response (plain text)
 */
export const ConsoleLogSchema = Schema.String;
export type ConsoleLog = Schema.Schema.Type<typeof ConsoleLogSchema>;

/**
 * Pipeline info extracted from URL or locator
 */
export const PipelineInfoSchema = Schema.Struct({
  path: Schema.String,
  buildNumber: Schema.Number,
});
export type PipelineInfo = Schema.Schema.Type<typeof PipelineInfoSchema>;

/**
 * Failure report (aggregated from build nodes)
 */
export interface FailureReport {
  readonly pipeline: string;
  readonly buildNumber: number;
  readonly nodeId: string;
  readonly displayName: string;
  readonly result: BuildResult;
  readonly url: string;
  readonly consoleOutput?: string;
  readonly subBuilds?: readonly FailureReport[];
}

export const FailureReportSchema: Schema.Schema<FailureReport> = Schema.Struct({
  pipeline: Schema.String,
  buildNumber: Schema.Number,
  nodeId: Schema.String,
  displayName: Schema.String,
  result: BuildResultSchema,
  url: Schema.String,
  consoleOutput: Schema.optional(Schema.String),
  subBuilds: Schema.optional(
    Schema.Array(Schema.suspend((): Schema.Schema<FailureReport> => FailureReportSchema))
  ),
});

/**
 * Job info (pipeline without build number)
 */
export const JobInfoSchema = Schema.Struct({
  path: Schema.String,
});
export type JobInfo = Schema.Schema.Type<typeof JobInfoSchema>;

/**
 * Build summary from runs list endpoint
 */
export const BuildSummarySchema = Schema.Struct({
  id: Schema.String,
  result: Schema.optional(Schema.NullOr(BuildResultSchema)),
  state: BuildStateSchema,
  startTime: Schema.optional(Schema.NullOr(Schema.String)),
  durationInMillis: Schema.optional(Schema.NullOr(Schema.Number)),
  runSummary: Schema.optional(Schema.NullOr(Schema.String)),
  _links: Schema.Struct({
    self: Schema.Struct({
      href: Schema.String,
    }),
  }),
  changeSet: Schema.optional(
    Schema.Array(
      Schema.Struct({
        commitId: Schema.String,
        msg: Schema.String,
      })
    )
  ),
  causes: Schema.optional(
    Schema.Array(
      Schema.Struct({
        shortDescription: Schema.String,
      })
    )
  ),
});
export type BuildSummary = Schema.Schema.Type<typeof BuildSummarySchema>;
