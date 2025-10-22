import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { parseLocator, parseNodeUrl } from "../src/lib/jenkins/locator.ts";

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
