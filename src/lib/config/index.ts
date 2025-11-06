/**
 * Configuration management
 * @module lib/config
 */

// Schema and types
export {
  DirectAuthSchema,
  EnvAuthSchema,
  AuthSchema,
  ConfigSchema,
  createDefaultConfig,
} from "./schema.ts";
export type { DirectAuth, EnvAuth, Auth, Config } from "./schema.ts";

// Config manager
export {
  getConfigDir,
  getConfigPath,
  configExists,
  ensureConfigDir,
  readConfig,
  writeConfig,
  getJenkinsUrl,
  getAuthHeader,
} from "./manager.ts";

// Wizard (for programmatic setup)
export { runSetupWizard } from "./wizard.ts";
