import { describe, expect, test } from "bun:test";
import { Schema } from "effect";
import { BuildNodeSchema, BuildSummarySchema } from "../src/lib/jenkins/schemas.ts";

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

  test("validates build with null state", () => {
    const data = {
      id: "200",
      state: null,
      result: "FAILURE",
      _links: { self: { href: "/runs/200/" } },
    };

    const result = Schema.decodeUnknownSync(BuildSummarySchema)(data);
    expect(result.id).toBe("200");
    expect(result.state).toBeNull();
    expect(result.result).toBe("FAILURE");
  });
});

describe("BuildNodeSchema", () => {
  test("validates a complete build node", () => {
    const data = {
      id: "1",
      displayName: "Test Stage",
      result: "SUCCESS",
      state: "FINISHED",
      startTime: "2025-11-25T04:53:00.870+0000",
      durationInMillis: 5000,
      actions: [],
    };

    const result = Schema.decodeUnknownSync(BuildNodeSchema)(data);
    expect(result.id).toBe("1");
    expect(result.displayName).toBe("Test Stage");
    expect(result.result).toBe("SUCCESS");
    expect(result.state).toBe("FINISHED");
  });

  test("validates build node with null state", () => {
    const data = {
      id: "5",
      displayName: "Problematic Stage",
      result: "FAILURE",
      state: null,
      actions: [],
    };

    const result = Schema.decodeUnknownSync(BuildNodeSchema)(data);
    expect(result.id).toBe("5");
    expect(result.displayName).toBe("Problematic Stage");
    expect(result.state).toBeNull();
    expect(result.result).toBe("FAILURE");
  });

  test("validates build node with null result and state", () => {
    const data = {
      id: "10",
      displayName: "Queued Stage",
      result: null,
      state: null,
      actions: [],
    };

    const result = Schema.decodeUnknownSync(BuildNodeSchema)(data);
    expect(result.id).toBe("10");
    expect(result.state).toBeNull();
    expect(result.result).toBeNull();
  });

  test("validates build node with actions containing links", () => {
    const data = {
      id: "3",
      displayName: "Stage with Sub-build",
      state: "FINISHED",
      result: "SUCCESS",
      actions: [
        { link: { href: "/blue/rest/organizations/jenkins/pipelines/sub-build/runs/123/" } },
      ],
    };

    const result = Schema.decodeUnknownSync(BuildNodeSchema)(data);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].link?.href).toContain("/runs/123/");
  });
});
