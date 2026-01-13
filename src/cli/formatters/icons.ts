/**
 * Unicode symbols for CLI output
 *
 * All symbols are defined as JavaScript escape sequences to ensure
 * consistent rendering across different build targets and runtimes.
 * This avoids encoding issues that can occur with raw UTF-8 characters.
 */

/**
 * Status icons for build results
 */
export const ICON_SUCCESS = "\u2713"; // ✓
export const ICON_FAILURE = "\u2717"; // ✗
export const ICON_WARNING = "\u26A0"; // ⚠
export const ICON_UNKNOWN = "\u25CB"; // ○
export const ICON_ACTIVE = "\u25CF"; // ●

/**
 * Navigation icons
 */
export const ICON_ARROW_RIGHT = "\u2192"; // →
export const ICON_ARROW_UP = "\u2191"; // ↑
export const ICON_ARROW_DOWN = "\u2193"; // ↓
export const ICON_ARROW_FORWARD = "\u25B6"; // ▶

/**
 * Emoji icons (for wizard/setup)
 */
export const ICON_KEY = "\uD83D\uDD11"; // 🔑
export const ICON_CLIPBOARD = "\uD83D\uDCCB"; // 📋

/**
 * Keycap digit emojis (for numbered instructions)
 */
export const ICON_KEYCAP_1 = "1\uFE0F\u20E3"; // 1️⃣
export const ICON_KEYCAP_2 = "2\uFE0F\u20E3"; // 2️⃣
export const ICON_KEYCAP_3 = "3\uFE0F\u20E3"; // 3️⃣
export const ICON_KEYCAP_4 = "4\uFE0F\u20E3"; // 4️⃣
export const ICON_KEYCAP_5 = "5\uFE0F\u20E3"; // 5️⃣
export const ICON_KEYCAP_6 = "6\uFE0F\u20E3"; // 6️⃣

/**
 * Warning with variation selector (for emphasis)
 */
export const ICON_WARNING_EMPHASIS = "\u26A0\uFE0F"; // ⚠️

/**
 * Get status icon based on build result
 */
export const getBuildStatusIcon = (
  result: "SUCCESS" | "FAILURE" | "UNSTABLE" | string | null | undefined
): string => {
  switch (result) {
    case "SUCCESS":
      return ICON_SUCCESS;
    case "FAILURE":
      return ICON_FAILURE;
    case "UNSTABLE":
      return ICON_WARNING;
    default:
      return ICON_UNKNOWN;
  }
};
