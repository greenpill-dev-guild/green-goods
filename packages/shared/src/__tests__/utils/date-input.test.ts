import { describe, it, expect } from "vitest";
import { toDateInputValue, fromDateInputValue } from "../../utils/time";

/**
 * Tests for date input value conversion functions.
 * These functions convert between HTML date input values (YYYY-MM-DD)
 * and Unix timestamps in seconds.
 */
describe("Date Input Value Utilities", () => {
  describe("toDateInputValue", () => {
    it("formats timestamp to YYYY-MM-DD", () => {
      // 2024-01-15 00:00:00 UTC = 1705276800 seconds
      const result = toDateInputValue(1705276800);
      expect(result).toBe("2024-01-15");
    });

    it("returns epoch date for 0 (valid Unix timestamp)", () => {
      // 0 is the Unix epoch - a valid timestamp representing 1970-01-01
      expect(toDateInputValue(0)).toBe("1970-01-01");
    });

    it("returns empty string for null/undefined", () => {
      expect(toDateInputValue(null)).toBe("");
      expect(toDateInputValue(undefined)).toBe("");
    });

    it("handles millisecond timestamps", () => {
      // 1705276800000 = 2024-01-15 00:00:00 UTC in milliseconds
      const milliseconds = 1705276800000;
      const result = toDateInputValue(milliseconds);
      expect(result).toBe("2024-01-15");
    });
  });

  describe("fromDateInputValue", () => {
    it("parses valid YYYY-MM-DD format", () => {
      const result = fromDateInputValue("2024-01-15");
      // Should return Unix timestamp in seconds
      expect(result).toBe(1705276800);
    });

    it("returns 0 for empty string", () => {
      expect(fromDateInputValue("")).toBe(0);
    });

    it("returns 0 for invalid format", () => {
      expect(fromDateInputValue("invalid")).toBe(0);
      expect(fromDateInputValue("01-15-2024")).toBe(0);
      expect(fromDateInputValue("2024/01/15")).toBe(0);
    });

    it("returns 0 for partial dates", () => {
      expect(fromDateInputValue("2024-01")).toBe(0);
      expect(fromDateInputValue("2024")).toBe(0);
    });

    // Month validation tests
    describe("month validation", () => {
      it("returns 0 for month < 1", () => {
        expect(fromDateInputValue("2024-00-15")).toBe(0);
      });

      it("returns 0 for month > 12", () => {
        expect(fromDateInputValue("2024-13-15")).toBe(0);
      });

      it("accepts all valid months", () => {
        for (let month = 1; month <= 12; month++) {
          const monthStr = month.toString().padStart(2, "0");
          const result = fromDateInputValue(`2024-${monthStr}-01`);
          expect(result).toBeGreaterThan(0);
        }
      });
    });

    // Day validation tests
    describe("day validation", () => {
      it("returns 0 for day < 1", () => {
        expect(fromDateInputValue("2024-01-00")).toBe(0);
      });

      it("returns 0 for day exceeding month maximum", () => {
        // January has 31 days
        expect(fromDateInputValue("2024-01-32")).toBe(0);
        // April has 30 days
        expect(fromDateInputValue("2024-04-31")).toBe(0);
        // February in non-leap year has 28 days
        expect(fromDateInputValue("2023-02-29")).toBe(0);
      });

      it("validates maximum days for 31-day months", () => {
        // January, March, May, July, August, October, December
        const thirtyOneDayMonths = ["01", "03", "05", "07", "08", "10", "12"];
        for (const month of thirtyOneDayMonths) {
          expect(fromDateInputValue(`2024-${month}-31`)).toBeGreaterThan(0);
          expect(fromDateInputValue(`2024-${month}-32`)).toBe(0);
        }
      });

      it("validates maximum days for 30-day months", () => {
        // April, June, September, November
        const thirtyDayMonths = ["04", "06", "09", "11"];
        for (const month of thirtyDayMonths) {
          expect(fromDateInputValue(`2024-${month}-30`)).toBeGreaterThan(0);
          expect(fromDateInputValue(`2024-${month}-31`)).toBe(0);
        }
      });
    });

    // Leap year tests
    describe("leap year handling", () => {
      it("accepts Feb 29 in leap years (divisible by 4)", () => {
        const result = fromDateInputValue("2024-02-29");
        expect(result).toBeGreaterThan(0);
        // Verify the date is correct
        const date = new Date(result * 1000);
        expect(date.getUTCMonth()).toBe(1); // February (0-indexed)
        expect(date.getUTCDate()).toBe(29);
      });

      it("rejects Feb 29 in non-leap years", () => {
        expect(fromDateInputValue("2023-02-29")).toBe(0);
        expect(fromDateInputValue("2025-02-29")).toBe(0);
      });

      it("rejects Feb 29 in century years not divisible by 400", () => {
        // 2100 is divisible by 100 but not 400, so not a leap year
        expect(fromDateInputValue("2100-02-29")).toBe(0);
        expect(fromDateInputValue("1900-02-29")).toBe(0);
      });

      it("accepts Feb 29 in century years divisible by 400", () => {
        // 2000 was a leap year (divisible by 400)
        const result = fromDateInputValue("2000-02-29");
        expect(result).toBeGreaterThan(0);
      });

      it("accepts Feb 28 in all years", () => {
        expect(fromDateInputValue("2023-02-28")).toBeGreaterThan(0);
        expect(fromDateInputValue("2024-02-28")).toBeGreaterThan(0);
        expect(fromDateInputValue("2100-02-28")).toBeGreaterThan(0);
      });

      it("rejects Feb 30 in all years", () => {
        expect(fromDateInputValue("2024-02-30")).toBe(0);
        expect(fromDateInputValue("2000-02-30")).toBe(0);
      });
    });

    // Edge cases
    describe("edge cases", () => {
      it("handles NaN in date parts", () => {
        expect(fromDateInputValue("2024-ab-15")).toBe(0);
        expect(fromDateInputValue("abcd-01-15")).toBe(0);
        expect(fromDateInputValue("2024-01-xy")).toBe(0);
      });

      it("handles negative values", () => {
        expect(fromDateInputValue("2024--1-15")).toBe(0);
        expect(fromDateInputValue("-2024-01-15")).toBe(0);
      });

      it("handles extra parts", () => {
        // Extra parts cause rejection: parts.length !== 3 returns 0
        expect(fromDateInputValue("2024-01-15-extra")).toBe(0);
      });
    });

    // Roundtrip tests
    describe("roundtrip conversion", () => {
      it("converts back and forth correctly", () => {
        const original = "2024-06-15";
        const timestamp = fromDateInputValue(original);
        const roundtrip = toDateInputValue(timestamp);
        expect(roundtrip).toBe(original);
      });

      it("handles various valid dates", () => {
        const dates = [
          "2024-01-01",
          "2024-12-31",
          "2024-02-29", // leap year
          "2000-01-01",
          "1999-12-31",
        ];
        for (const date of dates) {
          const timestamp = fromDateInputValue(date);
          expect(timestamp).toBeGreaterThan(0);
          const roundtrip = toDateInputValue(timestamp);
          expect(roundtrip).toBe(date);
        }
      });
    });
  });
});
