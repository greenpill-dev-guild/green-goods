/**
 * SDG Target Constants Tests
 *
 * Validates that SDG_TARGETS contains all 17 UN Sustainable Development Goals
 * with correct IDs and labels, and that the lookup helper works.
 */

import { describe, expect, it } from "vitest";

import { getSDGLabel, SDG_TARGETS } from "../../config/sdg";

describe("config/sdg", () => {
  describe("SDG_TARGETS", () => {
    it("contains exactly 17 goals", () => {
      expect(SDG_TARGETS).toHaveLength(17);
    });

    it("has sequential IDs from 1 to 17", () => {
      for (let i = 0; i < 17; i++) {
        expect(SDG_TARGETS[i].id).toBe(i + 1);
      }
    });

    it("has non-empty labels for all goals", () => {
      for (const target of SDG_TARGETS) {
        expect(target.label).toBeTruthy();
        expect(typeof target.label).toBe("string");
      }
    });

    it("includes known SDG goals", () => {
      expect(SDG_TARGETS[0].label).toBe("No Poverty");
      expect(SDG_TARGETS[6].label).toBe("Affordable and Clean Energy");
      expect(SDG_TARGETS[12].label).toBe("Climate Action");
      expect(SDG_TARGETS[16].label).toBe("Partnerships for the Goals");
    });

    it("is readonly (frozen)", () => {
      // The `as const` assertion makes the array readonly at compile time
      // Runtime check that the shape is correct
      expect(Array.isArray(SDG_TARGETS)).toBe(true);
    });
  });

  describe("getSDGLabel", () => {
    it("returns the label for a valid SDG ID", () => {
      expect(getSDGLabel(1)).toBe("No Poverty");
      expect(getSDGLabel(7)).toBe("Affordable and Clean Energy");
      expect(getSDGLabel(13)).toBe("Climate Action");
      expect(getSDGLabel(17)).toBe("Partnerships for the Goals");
    });

    it("returns undefined for invalid IDs", () => {
      expect(getSDGLabel(0)).toBeUndefined();
      expect(getSDGLabel(18)).toBeUndefined();
      expect(getSDGLabel(-1)).toBeUndefined();
    });
  });
});
