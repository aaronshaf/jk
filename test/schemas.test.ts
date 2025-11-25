import { describe, expect, test } from "bun:test";
import { Schema } from "effect";
import { BuildSummarySchema } from "../src/lib/jenkins/schemas.ts";

describe("BuildSummarySchema", () => {
  test("validates a complete build summary", () => {
    const data = {
      id: "885",
      result: "FAILURE",
      state: "FINISHED",
      startTime: "2025-11-25T04:53:00.870+0000",
      durationInMillis: 458713,
      runSummary: "broken since build #883",
      _links: {
        self: {
          href: "/blue/rest/organizations/jenkins/pipelines/Catalog/pipelines/catalog-chromatic/runs/885/",
        },
      },
      changeSet: [
        {
          commitId: "69e387b734bc64257638d9bf216f8fcd42934d72",
          msg: "Filter out deleted enrollments",
        },
      ],
      causes: [{ shortDescription: "Started by timer" }],
    };

    const result = Schema.decodeUnknownSync(BuildSummarySchema)(data);
    expect(result.id).toBe("885");
    expect(result.result).toBe("FAILURE");
    expect(result._links.self.href).toContain("/runs/885/");
  });

  test("validates build with null optional fields", () => {
    const data = {
      id: "100",
      result: null,
      state: "RUNNING",
      startTime: null,
      durationInMillis: null,
      _links: { self: { href: "/runs/100/" } },
    };

    const result = Schema.decodeUnknownSync(BuildSummarySchema)(data);
    expect(result.id).toBe("100");
    expect(result.result).toBeNull();
    expect(result.state).toBe("RUNNING");
  });

  test("validates build without optional arrays", () => {
    const data = {
      id: "50",
      state: "FINISHED",
      result: "SUCCESS",
      _links: { self: { href: "/runs/50/" } },
    };

    const result = Schema.decodeUnknownSync(BuildSummarySchema)(data);
    expect(result.changeSet).toBeUndefined();
    expect(result.causes).toBeUndefined();
  });
});
