import { Effect } from "effect";
import { runSetupWizard } from "../../lib/config/wizard.ts";
import { configExists, getConfigPath } from "../../lib/config/manager.ts";
import { yellow } from "../formatters/colors.ts";

/**
 * Setup command - run interactive configuration wizard
 */
export const setupCommand = (): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const exists = yield* configExists();

    if (exists) {
      console.log(yellow(`\nConfiguration already exists at: ${getConfigPath()}`));
      console.log("Running setup wizard will overwrite the existing configuration.\n");
    }

    yield* runSetupWizard().pipe(
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.error(`Setup failed: ${error.message}`);
          process.exit(1);
        })
      )
    );
  });
