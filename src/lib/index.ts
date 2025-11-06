/**
 * Jenkins CLI Library
 * @module @aaronshaf/jk
 *
 * This library provides programmatic access to Jenkins Blue Ocean API
 * using Effect for type-safe error handling.
 *
 * @example
 * ```typescript
 * import { Effect, pipe } from "effect";
 * import { createJenkinsClient, createBuildOperations, readConfig } from "@aaronshaf/jk";
 *
 * const program = Effect.gen(function* () {
 *   // Load config from ~/.config/jk/config.json
 *   const config = yield* readConfig();
 *
 *   // Create client and operations
 *   const client = yield* createJenkinsClient(config);
 *   const operations = createBuildOperations(client, config);
 *
 *   // Get build nodes
 *   const nodes = yield* operations.getBuildNodes("pipelines/MyProject/main/123");
 *
 *   console.log(`Found ${nodes.length} nodes`);
 * });
 *
 * Effect.runPromise(program);
 * ```
 */

// Re-export everything from subdirectories
export * from "./jenkins/index.ts";
export * from "./config/index.ts";
export * from "./effects/index.ts";
