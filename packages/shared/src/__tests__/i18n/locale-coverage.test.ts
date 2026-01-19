import { describe, expect, it } from "vitest";

import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";

/**
 * Translation coverage tests to ensure all locales have parity with English.
 *
 * These tests verify:
 * 1. Key parity — all keys in en.json exist in es.json and pt.json
 * 2. No extra keys — no keys in es.json or pt.json that don't exist in en.json
 * 3. No empty values — all translated values are non-empty strings
 */
describe("i18n locale coverage", () => {
  const enKeys = Object.keys(en).sort();
  const esKeys = Object.keys(es).sort();
  const ptKeys = Object.keys(pt).sort();

  describe("Spanish (es) coverage", () => {
    it("should have all English keys", () => {
      const missingKeys = enKeys.filter((key) => !esKeys.includes(key));
      expect(missingKeys, `Missing keys in es.json: ${missingKeys.join(", ")}`).toHaveLength(0);
    });

    it("should not have extra keys beyond English", () => {
      const extraKeys = esKeys.filter((key) => !enKeys.includes(key));
      expect(extraKeys, `Extra keys in es.json: ${extraKeys.join(", ")}`).toHaveLength(0);
    });

    it("should not have empty translation values", () => {
      const emptyKeys = Object.entries(es)
        .filter(([, value]) => typeof value === "string" && value.trim() === "")
        .map(([key]) => key);
      expect(emptyKeys, `Empty values in es.json: ${emptyKeys.join(", ")}`).toHaveLength(0);
    });
  });

  describe("Portuguese (pt) coverage", () => {
    it("should have all English keys", () => {
      const missingKeys = enKeys.filter((key) => !ptKeys.includes(key));
      expect(missingKeys, `Missing keys in pt.json: ${missingKeys.join(", ")}`).toHaveLength(0);
    });

    it("should not have extra keys beyond English", () => {
      const extraKeys = ptKeys.filter((key) => !enKeys.includes(key));
      expect(extraKeys, `Extra keys in pt.json: ${extraKeys.join(", ")}`).toHaveLength(0);
    });

    it("should not have empty translation values", () => {
      const emptyKeys = Object.entries(pt)
        .filter(([, value]) => typeof value === "string" && value.trim() === "")
        .map(([key]) => key);
      expect(emptyKeys, `Empty values in pt.json: ${emptyKeys.join(", ")}`).toHaveLength(0);
    });
  });

  describe("English (en) baseline", () => {
    it("should not have empty translation values", () => {
      const emptyKeys = Object.entries(en)
        .filter(([, value]) => typeof value === "string" && value.trim() === "")
        .map(([key]) => key);
      expect(emptyKeys, `Empty values in en.json: ${emptyKeys.join(", ")}`).toHaveLength(0);
    });

    it("should have a reasonable number of keys", () => {
      // Sanity check — if key count drops significantly, something is wrong
      expect(enKeys.length).toBeGreaterThan(400);
    });
  });

  describe("Key count parity", () => {
    it("should have equal key counts across all locales", () => {
      expect(esKeys.length).toBe(enKeys.length);
      expect(ptKeys.length).toBe(enKeys.length);
    });
  });
});
