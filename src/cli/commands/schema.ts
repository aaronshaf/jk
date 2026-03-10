import { Effect, Schema, JSONSchema } from "effect";
import { FailureReportSchema } from "../../lib/jenkins/schemas.ts";
import { red } from "../formatters/colors.ts";

/**
 * Output schemas matching what jk JSON formatters actually produce.
 * These differ from the API response schemas (which reflect raw Jenkins data)
 * because the formatters transform/flatten/coerce fields.
 */

const BuildNodeOutputSchema = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    displayName: Schema.String,
    state: Schema.String,
    result: Schema.NullOr(Schema.String),
    startTime: Schema.NullOr(Schema.String),
    durationInMillis: Schema.NullOr(Schema.Number),
  })
);

const BuildsOutputSchema = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    result: Schema.NullOr(Schema.String),
    state: Schema.NullOr(Schema.String),
    startTime: Schema.NullOr(Schema.String),
    durationInMillis: Schema.NullOr(Schema.Number),
    runSummary: Schema.NullOr(Schema.String),
    url: Schema.String,
    changeSet: Schema.Array(
      Schema.Struct({
        commitId: Schema.String,
        message: Schema.String,
      })
    ),
    causes: Schema.Array(Schema.String),
  })
);

const ActionResultSchema = Schema.Union(
  Schema.Struct({
    status: Schema.Literal("ok"),
    action: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal("error"),
    action: Schema.String,
    message: Schema.String,
    url: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.String),
  })
);

/**
 * Schema command - output JSON Schema for each command's --json output.
 * Note: `console` is excluded as it has no --json mode (outputs raw text).
 * The `failures` schema uses $defs for the recursive subBuilds field.
 */
export const schemaCommand = (): Effect.Effect<void, never> =>
  Effect.sync(() => {
    try {
      const schemas: Record<string, unknown> = {
        build: JSONSchema.make(BuildNodeOutputSchema),
        builds: JSONSchema.make(BuildsOutputSchema),
        failures: JSONSchema.make(Schema.Array(FailureReportSchema)),
        stop: JSONSchema.make(ActionResultSchema),
        retrigger: JSONSchema.make(ActionResultSchema),
      };
      console.log(JSON.stringify(schemas, null, 2));
    } catch (error) {
      console.error(red(`Error generating schema: ${error}`));
      process.exit(1);
    }
  });
