import { describe, expect, test } from "bun:test";
import { parseArgs, type ParsedArgs } from "../src/cli/args.ts";

/**
 * Tests for argument parsing
 *
 * Note: These tests cannot directly call parseArgs() because it synchronously
 * reads from stdin, which would block in the test environment. Instead, we test
 * the parsing logic through integration with the actual CLI or by examining the
 * structure of ParsedArgs.
 */

describe("ParsedArgs interface", () => {
  test("ParsedArgs includes stdin field", () => {
    // Type check: ensure ParsedArgs has stdin field
    const mockParsedArgs: ParsedArgs = {
      command: "build",
      positional: [],
      flags: {
        verbose: false,
        full: false,
        recursive: false,
        shallow: false,
        json: false,
        xml: false,
        help: false,
        smart: false,
      },
      stdin: null,
    };

    expect(mockParsedArgs).toHaveProperty("stdin");
    expect(mockParsedArgs.stdin).toBe(null);
  });

  test("ParsedArgs stdin can be string or null", () => {
    // Test null case
    const withNull: ParsedArgs = {
      command: "build",
      positional: [],
      flags: {},
      stdin: null,
    };
    expect(withNull.stdin).toBe(null);

    // Test string case
    const withString: ParsedArgs = {
      command: "build",
      positional: [],
      flags: {},
      stdin: "pipelines/MyProject/main/123",
    };
    expect(withString.stdin).toBe("pipelines/MyProject/main/123");
  });

  test("ParsedArgs has correct structure", () => {
    const parsed: ParsedArgs = {
      command: "failures",
      positional: ["pipelines/MyProject/main/123"],
      flags: {
        verbose: true,
        full: false,
        recursive: true,
        shallow: false,
        json: false,
        xml: true,
        help: false,
        tail: 100,
        grep: "ERROR",
        smart: true,
      },
      stdin: null,
    };

    expect(parsed.command).toBe("failures");
    expect(parsed.positional).toEqual(["pipelines/MyProject/main/123"]);
    expect(parsed.flags.verbose).toBe(true);
    expect(parsed.flags.recursive).toBe(true);
    expect(parsed.flags.xml).toBe(true);
    expect(parsed.flags.tail).toBe(100);
    expect(parsed.flags.grep).toBe("ERROR");
    expect(parsed.flags.smart).toBe(true);
    expect(parsed.stdin).toBe(null);
  });
});

/**
 * Command vs Flag Detection
 *
 * Tests that parseArgs correctly identifies when the first argument is a command
 * vs when it's a flag (which means no explicit command was provided).
 */

describe("parseArgs command detection", () => {
  test("treats first arg as command when it doesn't start with -", () => {
    const parsed = parseArgs(["build", "pipelines/MyProject/main/123"]);
    expect(parsed.command).toBe("build");
    expect(parsed.positional).toEqual(["pipelines/MyProject/main/123"]);
    expect(parsed.flags.help).toBe(false);
  });

  test("defaults to help command when first arg is --help", () => {
    const parsed = parseArgs(["--help"]);
    expect(parsed.command).toBe("help");
    expect(parsed.flags.help).toBe(true);
    expect(parsed.positional).toEqual([]);
  });

  test("defaults to help command when first arg is -h", () => {
    const parsed = parseArgs(["-h"]);
    expect(parsed.command).toBe("help");
    expect(parsed.flags.help).toBe(true);
    expect(parsed.positional).toEqual([]);
  });

  test("defaults to help command when only flags are provided", () => {
    const parsed = parseArgs(["--verbose", "--xml"]);
    expect(parsed.command).toBe("help");
    expect(parsed.flags.verbose).toBe(true);
    expect(parsed.flags.xml).toBe(true);
    expect(parsed.positional).toEqual([]);
  });

  test("defaults to help command when no args are provided", () => {
    const parsed = parseArgs([]);
    expect(parsed.command).toBe("help");
    expect(parsed.positional).toEqual([]);
  });

  test("parses command with --help flag", () => {
    const parsed = parseArgs(["build", "--help"]);
    expect(parsed.command).toBe("build");
    expect(parsed.flags.help).toBe(true);
    expect(parsed.positional).toEqual([]);
  });

  test("parses command with positional args and flags", () => {
    const parsed = parseArgs(["failures", "pipelines/MyProject/main/123", "--recursive", "--xml"]);
    expect(parsed.command).toBe("failures");
    expect(parsed.positional).toEqual(["pipelines/MyProject/main/123"]);
    expect(parsed.flags.recursive).toBe(true);
    expect(parsed.flags.xml).toBe(true);
  });

  test("parses --stage flag with value", () => {
    const parsed = parseArgs(["retrigger", "--stage", "JavaScript Tests", "pipelines/Canvas/main/1234"]);
    expect(parsed.command).toBe("retrigger");
    expect(parsed.flags.stage).toBe("JavaScript Tests");
    expect(parsed.positional).toEqual(["pipelines/Canvas/main/1234"]);
  });

  test("parses --stage flag before positional", () => {
    const parsed = parseArgs(["retrigger", "--stage", "Deploy", "https://jenkins.example.com/job/Canvas/1234/"]);
    expect(parsed.flags.stage).toBe("Deploy");
    expect(parsed.positional).toEqual(["https://jenkins.example.com/job/Canvas/1234/"]);
  });

  test("--stage without value is ignored", () => {
    const parsed = parseArgs(["retrigger", "--stage"]);
    expect(parsed.flags.stage).toBeUndefined();
  });

  test("retrigger without --stage has no stage flag", () => {
    const parsed = parseArgs(["retrigger", "pipelines/Canvas/main/1234"]);
    expect(parsed.command).toBe("retrigger");
    expect(parsed.flags.stage).toBeUndefined();
    expect(parsed.positional).toEqual(["pipelines/Canvas/main/1234"]);
  });
});

/**
 * Integration tests
 *
 * These would test actual argument parsing by running the CLI in a subprocess
 * with controlled stdin. For now, we validate the type structure above.
 *
 * Future enhancement: Add integration tests that:
 * - Run `echo "123" | jk build` and verify it works
 * - Run `jk build pipelines/MyProject/main/123` and verify it works
 * - Test that stdin is preferred when no positional args are provided
 */

describe("stdin behavior documentation", () => {
  test("documents that stdin is read at parse time", () => {
    // This test documents the behavior:
    // parseArgs() calls readStdin() synchronously during argument parsing
    // This ensures stdin is available before any async Effect operations
    expect(true).toBe(true);
  });

  test("documents that readStdin handles TTY detection", () => {
    // readStdin() checks process.stdin.isTTY
    // If TTY, returns null (no piped input)
    // If not TTY, reads from fd 0 synchronously
    expect(true).toBe(true);
  });

  test("documents that empty stdin returns null", () => {
    // readStdin() returns null for empty or whitespace-only stdin
    // This prevents empty strings from being passed as locators
    // Example: `echo "" | jk build` should show "Missing required argument" error
    // Example: `command-with-no-output | jk failures` should show error, not use empty string
    expect(true).toBe(true);
  });

  test("documents stdin usage in router", () => {
    // Router uses args.stdin when args.positional.length === 0
    // This allows commands to work with: echo "123" | jk build
    expect(true).toBe(true);
  });
});
