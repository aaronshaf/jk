import { describe, expect, test } from "bun:test";
import {
  ICON_SUCCESS,
  ICON_FAILURE,
  ICON_WARNING,
  ICON_UNKNOWN,
  ICON_ACTIVE,
  ICON_ARROW_RIGHT,
  ICON_ARROW_UP,
  ICON_ARROW_DOWN,
  ICON_ARROW_FORWARD,
  ICON_KEY,
  ICON_CLIPBOARD,
  ICON_KEYCAP_1,
  ICON_KEYCAP_2,
  ICON_KEYCAP_3,
  ICON_KEYCAP_4,
  ICON_KEYCAP_5,
  ICON_KEYCAP_6,
  ICON_WARNING_EMPHASIS,
  getBuildStatusIcon,
} from "../src/cli/formatters/icons.ts";

describe("icons", () => {

  describe("getBuildStatusIcon helper", () => {
    test("returns SUCCESS icon for SUCCESS result", () => {
      expect(getBuildStatusIcon("SUCCESS")).toBe(ICON_SUCCESS);
    });

    test("returns FAILURE icon for FAILURE result", () => {
      expect(getBuildStatusIcon("FAILURE")).toBe(ICON_FAILURE);
    });

    test("returns WARNING icon for UNSTABLE result", () => {
      expect(getBuildStatusIcon("UNSTABLE")).toBe(ICON_WARNING);
    });

    test("returns UNKNOWN icon for undefined result", () => {
      expect(getBuildStatusIcon(undefined)).toBe(ICON_UNKNOWN);
    });

    test("returns UNKNOWN icon for empty string", () => {
      expect(getBuildStatusIcon("")).toBe(ICON_UNKNOWN);
    });

    test("returns UNKNOWN icon for unknown status", () => {
      expect(getBuildStatusIcon("PENDING")).toBe(ICON_UNKNOWN);
      expect(getBuildStatusIcon("ABORTED")).toBe(ICON_UNKNOWN);
      expect(getBuildStatusIcon("NOT_BUILT")).toBe(ICON_UNKNOWN);
    });

    test("is case sensitive", () => {
      expect(getBuildStatusIcon("success")).toBe(ICON_UNKNOWN);
      expect(getBuildStatusIcon("Success")).toBe(ICON_UNKNOWN);
    });
  });

  describe("encoding consistency", () => {
    test("icons are non-empty strings", () => {
      // Verify all icons are defined and not empty
      expect(ICON_SUCCESS.length).toBeGreaterThan(0);
      expect(ICON_FAILURE.length).toBeGreaterThan(0);
      expect(ICON_KEY.length).toBeGreaterThan(0);
      expect(ICON_KEYCAP_1.length).toBeGreaterThan(0);
    });

    test("icons contain valid Unicode code points", () => {
      // Verify icons don't contain replacement characters (U+FFFD)
      // which would indicate encoding issues
      expect(ICON_SUCCESS).not.toContain("\uFFFD");
      expect(ICON_FAILURE).not.toContain("\uFFFD");
      expect(ICON_KEY).not.toContain("\uFFFD");
      expect(ICON_KEYCAP_1).not.toContain("\uFFFD");
    });
  });

  describe("visual consistency", () => {
    test("all status icons have different values", () => {
      const statusIcons = [ICON_SUCCESS, ICON_FAILURE, ICON_WARNING, ICON_UNKNOWN, ICON_ACTIVE];
      const uniqueIcons = new Set(statusIcons);
      expect(uniqueIcons.size).toBe(statusIcons.length);
    });

    test("all navigation icons have different values", () => {
      const navIcons = [ICON_ARROW_RIGHT, ICON_ARROW_UP, ICON_ARROW_DOWN, ICON_ARROW_FORWARD];
      const uniqueIcons = new Set(navIcons);
      expect(uniqueIcons.size).toBe(navIcons.length);
    });

    test("all keycap icons have different values", () => {
      const keycapIcons = [
        ICON_KEYCAP_1,
        ICON_KEYCAP_2,
        ICON_KEYCAP_3,
        ICON_KEYCAP_4,
        ICON_KEYCAP_5,
        ICON_KEYCAP_6,
      ];
      const uniqueIcons = new Set(keycapIcons);
      expect(uniqueIcons.size).toBe(keycapIcons.length);
    });
  });
});
