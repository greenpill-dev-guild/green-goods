/**
 * Form Normalizer Tests
 *
 * Regression tests for normalizeTimeSpentMinutes and formatTimeSpent.
 * See: https://github.com/greenpill-dev-guild/green-goods/issues/378
 */

import { describe, expect, it } from "vitest";
import { formatTimeSpent, normalizeTimeSpentMinutes } from "../../utils/form/normalizers";

describe("normalizeTimeSpentMinutes", () => {
  it("converts whole hours to minutes", () => {
    expect(normalizeTimeSpentMinutes(1)).toBe(60);
    expect(normalizeTimeSpentMinutes(2)).toBe(120);
  });

  it("converts fractional hours to minutes", () => {
    expect(normalizeTimeSpentMinutes(0.5)).toBe(30);
    expect(normalizeTimeSpentMinutes(1.5)).toBe(90);
    expect(normalizeTimeSpentMinutes(0.25)).toBe(15);
  });

  it("returns 0 for zero input", () => {
    expect(normalizeTimeSpentMinutes(0)).toBe(0);
  });

  it("returns undefined for negative values", () => {
    expect(normalizeTimeSpentMinutes(-1)).toBeUndefined();
    expect(normalizeTimeSpentMinutes(-0.5)).toBeUndefined();
  });

  it("parses numeric strings", () => {
    expect(normalizeTimeSpentMinutes("2")).toBe(120);
    expect(normalizeTimeSpentMinutes("0.5")).toBe(30);
    expect(normalizeTimeSpentMinutes("1.5")).toBe(90);
  });

  it("returns undefined for empty/null/undefined", () => {
    expect(normalizeTimeSpentMinutes("")).toBeUndefined();
    expect(normalizeTimeSpentMinutes(null)).toBeUndefined();
    expect(normalizeTimeSpentMinutes(undefined)).toBeUndefined();
  });

  it("returns undefined for non-numeric strings", () => {
    expect(normalizeTimeSpentMinutes("abc")).toBeUndefined();
    expect(normalizeTimeSpentMinutes("  ")).toBeUndefined();
  });

  it("returns undefined for NaN", () => {
    expect(normalizeTimeSpentMinutes(NaN)).toBeUndefined();
  });

  it("rounds to nearest minute", () => {
    // 1.33 hours = 79.8 minutes -> 80
    expect(normalizeTimeSpentMinutes(1.33)).toBe(80);
    // 0.1 hours = 6 minutes
    expect(normalizeTimeSpentMinutes(0.1)).toBe(6);
  });
});

describe("formatTimeSpent", () => {
  it("formats hours and minutes", () => {
    expect(formatTimeSpent(90)).toBe("1h 30m");
    expect(formatTimeSpent(150)).toBe("2h 30m");
  });

  it("formats whole hours", () => {
    expect(formatTimeSpent(60)).toBe("1h");
    expect(formatTimeSpent(120)).toBe("2h");
  });

  it("formats minutes only", () => {
    expect(formatTimeSpent(30)).toBe("30m");
    expect(formatTimeSpent(45)).toBe("45m");
  });

  it("returns empty string for zero/undefined/negative", () => {
    expect(formatTimeSpent(0)).toBe("");
    expect(formatTimeSpent(undefined)).toBe("");
    expect(formatTimeSpent(-10)).toBe("");
  });

  it("handles non-finite values", () => {
    expect(formatTimeSpent(Infinity)).toBe("");
    expect(formatTimeSpent(NaN)).toBe("");
  });
});
