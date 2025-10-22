/**
 * Simple argument parsing utilities
 */

export interface ParsedArgs {
  command: string;
  positional: string[];
  flags: {
    verbose?: boolean;
    full?: boolean;
    recursive?: boolean;
    shallow?: boolean;
    json?: boolean;
    xml?: boolean;
    help?: boolean;
    tail?: number;
    grep?: string;
    smart?: boolean;
  };
}

/**
 * Parse command line arguments
 */
export const parseArgs = (argv: string[]): ParsedArgs => {
  const [command, ...rest] = argv;

  const flags = {
    verbose: false,
    full: false,
    recursive: false,
    shallow: false,
    json: false,
    xml: false,
    help: false,
    tail: undefined as number | undefined,
    grep: undefined as string | undefined,
    smart: false,
  };

  const positional: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];

    if (arg.startsWith("--")) {
      const flag = arg.slice(2);
      if (flag === "verbose" || flag === "v") {
        flags.verbose = true;
      } else if (flag === "full") {
        flags.full = true;
      } else if (flag === "recursive" || flag === "r") {
        flags.recursive = true;
      } else if (flag === "shallow") {
        flags.shallow = true;
      } else if (flag === "json") {
        flags.json = true;
      } else if (flag === "xml") {
        flags.xml = true;
      } else if (flag === "help" || flag === "h") {
        flags.help = true;
      } else if (flag === "smart") {
        flags.smart = true;
      } else if (flag === "tail") {
        // Next arg should be a number
        const nextArg = rest[i + 1];
        if (nextArg && !nextArg.startsWith("-")) {
          const num = parseInt(nextArg, 10);
          if (!isNaN(num) && num > 0) {
            flags.tail = num;
            i++; // Skip next arg
          }
        }
      } else if (flag === "grep") {
        // Next arg should be a pattern
        const nextArg = rest[i + 1];
        if (nextArg && !nextArg.startsWith("-")) {
          flags.grep = nextArg;
          i++; // Skip next arg
        }
      }
    } else if (arg.startsWith("-")) {
      // Short flags
      const shortFlags = arg.slice(1).split("");
      for (const flag of shortFlags) {
        if (flag === "v") flags.verbose = true;
        if (flag === "r") flags.recursive = true;
        if (flag === "h") flags.help = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return {
    command: command || "help",
    positional,
    flags,
  };
};
