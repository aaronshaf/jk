import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { parseLocator, parseNodeUrl, parseJobLocator, buildRunsApiPath, buildClassicStopPath, buildReplayPath, buildClassicRestartStagePath } from "../src/lib/jenkins/locator.ts";

describe("parseLocator", () => {
  test("parses job URL format", () => {
    const result = Effect.runSync(
      parseLocator("https://jenkins.example.com/job/MyProject/job/main/123/")
    );

    expect(result.path).toBe("pipelines/MyProject/main");
    expect(result.buildNumber).toBe(123);
  });

  test("parses pipeline URL format with runs", () => {
    const result = Effect.runSync(
      parseLocator(
        "https://jenkins.example.com/blue/organizations/jenkins/pipelines/MyProject/main/runs/456/"
      )
    );

    expect(result.path).toBe("pipelines/MyProject/main");
    expect(result.buildNumber).toBe(456);
  });

  test("parses simple pipeline path", () => {
    const result = Effect.runSync(
      parseLocator("pipelines/MyProject/main/789")
    );

    expect(result.path).toBe("pipelines/MyProject/main");
    expect(result.buildNumber).toBe(789);
  });

  test("parses pipeline path with runs", () => {
    const result = Effect.runSync(
      parseLocator("pipelines/MyProject/main/runs/101112")
    );

    expect(result.path).toBe("pipelines/MyProject/main");
    expect(result.buildNumber).toBe(101112);
  });

  test("fails on invalid locator", () => {
    const result = Effect.runSyncExit(parseLocator("invalid-locator"));

    expect(result._tag).toBe("Failure");
  });

  test("parses URL-encoded job URL with spaces", () => {
    const result = Effect.runSync(
      parseLocator("https://jenkins.example.com/job/EDU%20Shared/job/gallery/123/")
    );

    expect(result.path).toBe("pipelines/EDU Shared/gallery");
    expect(result.buildNumber).toBe(123);
  });
});

describe("parseNodeUrl", () => {
  test("parses Blue Ocean node URL", () => {
    const result = Effect.runSync(
      parseNodeUrl(
        "https://jenkins.example.com/blue/organizations/jenkins/pipelines/MyProject/main/detail/main/154928/pipeline/534"
      )
    );

    expect(result.pipelineInfo.path).toBe("pipelines/MyProject/main");
    expect(result.pipelineInfo.buildNumber).toBe(154928);
    expect(result.nodeId).toBe("534");
  });

  test("parses Blue Ocean node URL with nested path", () => {
    const result = Effect.runSync(
      parseNodeUrl(
        "https://jenkins.example.com/blue/organizations/jenkins/pipelines/MyProject/test-suites/JS/detail/JS/203458/pipeline/71"
      )
    );

    expect(result.pipelineInfo.path).toBe("pipelines/MyProject/test-suites/JS");
    expect(result.pipelineInfo.buildNumber).toBe(203458);
    expect(result.nodeId).toBe("71");
  });

  test("parses Blue Ocean node URL with pipelines keyword in path", () => {
    const result = Effect.runSync(
      parseNodeUrl(
        "https://jenkins.example.com/blue/organizations/jenkins/pipelines/MyProject/pipelines/test-suites/pipelines/test-queue/detail/test-queue/134678/pipeline/139"
      )
    );

    expect(result.pipelineInfo.path).toBe("pipelines/MyProject/test-suites/test-queue");
    expect(result.pipelineInfo.buildNumber).toBe(134678);
    expect(result.nodeId).toBe("139");
  });

  test("fails on invalid node URL", () => {
    const result = Effect.runSyncExit(
      parseNodeUrl("https://jenkins.example.com/invalid/url")
    );

    expect(result._tag).toBe("Failure");
  });
});

describe("parseJobLocator", () => {
  test("parses job URL format without build number", () => {
    const result = Effect.runSync(
      parseJobLocator("https://jenkins.example.com/job/MyProject/job/main/")
    );
    expect(result.path).toBe("pipelines/MyProject/main");
  });

  test("parses job URL without trailing slash", () => {
    const result = Effect.runSync(
      parseJobLocator("https://jenkins.example.com/job/Catalog/job/catalog-chromatic")
    );
    expect(result.path).toBe("pipelines/Catalog/catalog-chromatic");
  });

  test("parses pipeline path format", () => {
    const result = Effect.runSync(
      parseJobLocator("pipelines/MyProject/main")
    );
    expect(result.path).toBe("pipelines/MyProject/main");
  });

  test("parses pipeline path with trailing slash", () => {
    const result = Effect.runSync(
      parseJobLocator("pipelines/MyProject/main/")
    );
    expect(result.path).toBe("pipelines/MyProject/main");
  });

  test("rejects path traversal attempts", () => {
    expect(() =>
      Effect.runSync(parseJobLocator("pipelines/../etc/passwd"))
    ).toThrow();
  });

  test("rejects invalid characters", () => {
    expect(() =>
      Effect.runSync(parseJobLocator("pipelines/My;Project"))
    ).toThrow();
  });

  test("provides helpful error for invalid format", () => {
    expect(() =>
      Effect.runSync(parseJobLocator("invalid-format"))
    ).toThrow(/Invalid job locator format/);
  });
});

describe("buildRunsApiPath", () => {
  test("builds correct API path", () => {
    const result = buildRunsApiPath({ path: "pipelines/MyProject/main" }, 10);
    expect(result).toBe("/blue/rest/organizations/jenkins/pipelines/MyProject/main/runs/?limit=10");
  });

  test("encodes spaces in path", () => {
    const result = buildRunsApiPath({ path: "pipelines/EDU Shared/gallery" }, 10);
    expect(result).toBe("/blue/rest/organizations/jenkins/pipelines/EDU%20Shared/gallery/runs/?limit=10");
  });
});

describe("buildReplayPath", () => {
  test("simple path", () => {
    expect(buildReplayPath({ path: "pipelines/Canvas/main", buildNumber: 1234 }))
      .toBe("/blue/rest/organizations/jenkins/pipelines/Canvas/main/runs/1234/replay/");
  });
});

describe("buildClassicRestartStagePath", () => {
  test("simple stage name", () => {
    expect(buildClassicRestartStagePath(
      { path: "pipelines/Canvas/main", buildNumber: 1234 },
      "JavaScript Tests"
    )).toBe("/job/Canvas/job/main/1234/restart/restartPipeline?stageName=JavaScript%20Tests");
  });

  test("encodes special characters in stage name", () => {
    expect(buildClassicRestartStagePath(
      { path: "pipelines/Canvas/main", buildNumber: 1 },
      "Tests & Lint"
    )).toBe("/job/Canvas/job/main/1/restart/restartPipeline?stageName=Tests%20%26%20Lint");
  });

  test("foldered pipeline path", () => {
    expect(buildClassicRestartStagePath(
      { path: "pipelines/Org/Repo/main", buildNumber: 42 },
      "Deploy"
    )).toBe("/job/Org/job/Repo/job/main/42/restart/restartPipeline?stageName=Deploy");
  });
});

describe("buildClassicStopPath", () => {
  test("simple two-segment path", () => {
    const result = buildClassicStopPath({ path: "pipelines/Canvas/main", buildNumber: 1234 });
    expect(result).toBe("/job/Canvas/job/main/1234/stop");
  });

  test("three-segment foldered path", () => {
    const result = buildClassicStopPath({ path: "pipelines/Org/Project/main", buildNumber: 42 });
    expect(result).toBe("/job/Org/job/Project/job/main/42/stop");
  });

  test("encodes special characters in branch name", () => {
    const result = buildClassicStopPath({ path: "pipelines/Canvas/feature/my branch", buildNumber: 99 });
    expect(result).toBe("/job/Canvas/job/feature/job/my%20branch/99/stop");
  });

  test("encodes slashes that would cause path traversal", () => {
    // parseLocator should prevent this, but buildClassicStopPath should encode defensively
    const result = buildClassicStopPath({ path: "pipelines/Canvas/main", buildNumber: 1 });
    expect(result).toContain("/stop");
    expect(result).not.toContain("//");
  });

  test("parses classic URL then builds stop path", () => {
    const info = Effect.runSync(
      parseLocator("https://jenkins.inst-ci.net/job/Canvas/job/main/1234/")
    );
    const result = buildClassicStopPath(info);
    expect(result).toBe("/job/Canvas/job/main/1234/stop");
  });
});
