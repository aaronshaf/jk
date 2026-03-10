import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { createBuildOperations } from "../src/lib/jenkins/operations.ts";
import {
  NetworkError,
  AuthenticationError,
  BuildNotFoundError,
} from "../src/lib/effects/errors.ts";
import type { JenkinsHttpClient } from "../src/lib/jenkins/client.ts";
import type { Config } from "../src/lib/config/schema.ts";

const mockConfig: Config = {
  jenkinsUrl: "https://jenkins.example.com",
  auth: { type: "direct", username: "user", apiToken: "token" },
};

const makeClient = (
  postImpl: (path: string) => Effect.Effect<void, NetworkError | AuthenticationError>
): JenkinsHttpClient => ({
  get: () => Effect.succeed({}),
  getValidated: () => Effect.succeed([] as any),
  getText: () => Effect.succeed(""),
  post: postImpl,
});

describe("retriggerBuild", () => {
  test("succeeds on 2xx", () => {
    const client = makeClient(() => Effect.void);
    const ops = createBuildOperations(client, mockConfig);
    const result = Effect.runSyncExit(
      ops.retriggerBuild("https://jenkins.example.com/job/Canvas/job/main/1234/")
    );
    expect(result._tag).toBe("Success");
  });

  test("maps 404 NetworkError to BuildNotFoundError", () => {
    const client = makeClient(() =>
      Effect.fail(new NetworkError({ message: "Not Found", statusCode: 404 }))
    );
    const ops = createBuildOperations(client, mockConfig);
    const result = Effect.runSyncExit(
      ops.retriggerBuild("https://jenkins.example.com/job/Canvas/job/main/1234/")
    );
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = result.cause;
      expect((error as any)._tag).toBe("Fail");
      expect((error as any).error._tag).toBe("BuildNotFoundError");
    }
  });

  test("passes through AuthenticationError unchanged", () => {
    const client = makeClient(() =>
      Effect.fail(new AuthenticationError({ message: "Unauthorized" }))
    );
    const ops = createBuildOperations(client, mockConfig);
    const result = Effect.runSyncExit(
      ops.retriggerBuild("https://jenkins.example.com/job/Canvas/job/main/1234/")
    );
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect((result.cause as any).error._tag).toBe("AuthenticationError");
    }
  });

  test("passes through non-404 NetworkError unchanged", () => {
    const client = makeClient(() =>
      Effect.fail(new NetworkError({ message: "Server Error", statusCode: 500 }))
    );
    const ops = createBuildOperations(client, mockConfig);
    const result = Effect.runSyncExit(
      ops.retriggerBuild("https://jenkins.example.com/job/Canvas/job/main/1234/")
    );
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect((result.cause as any).error._tag).toBe("NetworkError");
      expect((result.cause as any).error.statusCode).toBe(500);
    }
  });

  test("uses restart-stage path when stageName provided", () => {
    const calledPaths: string[] = [];
    const client = makeClient((path) => {
      calledPaths.push(path);
      return Effect.void;
    });
    const ops = createBuildOperations(client, mockConfig);
    Effect.runSync(
      ops.retriggerBuild(
        "https://jenkins.example.com/job/Canvas/job/main/1234/",
        "JavaScript Tests"
      )
    );
    expect(calledPaths[0]).toContain("restartPipeline");
    expect(calledPaths[0]).toContain("JavaScript%20Tests");
  });

  test("uses replay path when no stageName provided", () => {
    const calledPaths: string[] = [];
    const client = makeClient((path) => {
      calledPaths.push(path);
      return Effect.void;
    });
    const ops = createBuildOperations(client, mockConfig);
    Effect.runSync(
      ops.retriggerBuild("https://jenkins.example.com/job/Canvas/job/main/1234/")
    );
    expect(calledPaths[0]).toContain("/replay/");
    expect(calledPaths[0]).not.toContain("restartPipeline");
  });

  test("passes through redirect NetworkError (302) unchanged", () => {
    const client = makeClient(() =>
      Effect.fail(new NetworkError({ message: "Unexpected redirect (302) to: /login", statusCode: 302 }))
    );
    const ops = createBuildOperations(client, mockConfig);
    const result = Effect.runSyncExit(
      ops.retriggerBuild("https://jenkins.example.com/job/Canvas/job/main/1234/")
    );
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect((result.cause as any).error._tag).toBe("NetworkError");
    }
  });

  test("fails on invalid locator", () => {
    const client = makeClient(() => Effect.void);
    const ops = createBuildOperations(client, mockConfig);
    const result = Effect.runSyncExit(ops.retriggerBuild("not-a-valid-locator"));
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect((result.cause as any).error._tag).toBe("InvalidLocatorError");
    }
  });
});

describe("stopBuild", () => {
  test("maps 404 NetworkError to BuildNotFoundError", () => {
    const client = makeClient(() =>
      Effect.fail(new NetworkError({ message: "Not Found", statusCode: 404 }))
    );
    const ops = createBuildOperations(client, mockConfig);
    const result = Effect.runSyncExit(
      ops.stopBuild("https://jenkins.example.com/job/Canvas/job/main/1234/")
    );
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect((result.cause as any).error._tag).toBe("BuildNotFoundError");
    }
  });
});
