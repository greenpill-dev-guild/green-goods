import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getTimeCutoff,
  normalizeTimestamp,
  filterByTimeRange,
  sortByCreatedAt,
  formatRelativeTime,
  toSafeDate,
  toSafeInstant,
  formatDate,
  formatDateTime,
  toDateTimeLocalValue,
  fromDateTimeLocalValue,
  getStartOfDayUTC,
  compareTimestamps,
  getDurationMs,
  formatDuration,
  addDuration,
  getCurrentTimezone,
  isTemporalSupported,
} from "../../utils/time";

describe("Time Utilities", () => {
  const NOW = 1704067200000; // 2024-01-01 00:00:00 UTC

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isTemporalSupported", () => {
    it("returns boolean", () => {
      expect(typeof isTemporalSupported()).toBe("boolean");
    });
  });

  describe("normalizeTimestamp", () => {
    it("keeps millisecond timestamps unchanged", () => {
      expect(normalizeTimestamp(NOW)).toBe(NOW);
    });

    it("converts second timestamps to milliseconds", () => {
      const seconds = Math.floor(NOW / 1000);
      expect(normalizeTimestamp(seconds)).toBe(seconds * 1000);
    });

    it("handles boundary case around year 2001", () => {
      // Just below 1e12 should be treated as seconds
      expect(normalizeTimestamp(999999999999)).toBe(999999999999 * 1000);
      // At or above 1e12 should be treated as milliseconds
      expect(normalizeTimestamp(1000000000000)).toBe(1000000000000);
    });
  });

  describe("getTimeCutoff", () => {
    it("returns correct cutoff for day", () => {
      const cutoff = getTimeCutoff("day");
      expect(NOW - cutoff).toBe(24 * 60 * 60 * 1000);
    });

    it("returns correct cutoff for week", () => {
      const cutoff = getTimeCutoff("week");
      expect(NOW - cutoff).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it("returns correct cutoff for month", () => {
      const cutoff = getTimeCutoff("month");
      expect(NOW - cutoff).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it("returns correct cutoff for year", () => {
      const cutoff = getTimeCutoff("year");
      expect(NOW - cutoff).toBe(365 * 24 * 60 * 60 * 1000);
    });
  });

  describe("filterByTimeRange", () => {
    const items = [
      { id: 1, createdAt: NOW - 1000 }, // 1 second ago
      { id: 2, createdAt: NOW - 60 * 60 * 1000 }, // 1 hour ago
      { id: 3, createdAt: NOW - 2 * 24 * 60 * 60 * 1000 }, // 2 days ago
      { id: 4, createdAt: NOW - 10 * 24 * 60 * 60 * 1000 }, // 10 days ago
    ];

    it("filters items within day range", () => {
      const filtered = filterByTimeRange(items, "day");
      expect(filtered.map((i) => i.id)).toEqual([1, 2]);
    });

    it("filters items within week range", () => {
      const filtered = filterByTimeRange(items, "week");
      expect(filtered.map((i) => i.id)).toEqual([1, 2, 3]);
    });

    it("handles second timestamps", () => {
      const itemsWithSeconds = [
        { id: 1, createdAt: Math.floor((NOW - 1000) / 1000) }, // seconds
      ];
      const filtered = filterByTimeRange(itemsWithSeconds, "day");
      expect(filtered).toHaveLength(1);
    });
  });

  describe("sortByCreatedAt", () => {
    it("sorts items newest first", () => {
      const items = [{ createdAt: 1000 }, { createdAt: 3000 }, { createdAt: 2000 }];
      const sorted = sortByCreatedAt(items);
      expect(sorted.map((i) => i.createdAt)).toEqual([3000, 2000, 1000]);
    });

    it("does not mutate original array", () => {
      const items = [{ createdAt: 1000 }, { createdAt: 2000 }];
      const sorted = sortByCreatedAt(items);
      expect(sorted).not.toBe(items);
    });
  });

  describe("formatRelativeTime", () => {
    it("returns 'just now' for very recent times", () => {
      expect(formatRelativeTime(NOW)).toBe("just now");
      expect(formatRelativeTime(NOW - 5000)).toBe("just now");
    });

    it("formats seconds ago", () => {
      expect(formatRelativeTime(NOW - 30 * 1000)).toBe("30 seconds ago");
    });

    it("formats minutes ago", () => {
      expect(formatRelativeTime(NOW - 5 * 60 * 1000)).toBe("5 minutes ago");
    });

    it("formats hours ago", () => {
      expect(formatRelativeTime(NOW - 3 * 60 * 60 * 1000)).toBe("3 hours ago");
    });

    it("formats days ago", () => {
      expect(formatRelativeTime(NOW - 2 * 24 * 60 * 60 * 1000)).toBe("2 days ago");
    });

    it("handles Date objects", () => {
      const date = new Date(NOW - 60 * 1000);
      expect(formatRelativeTime(date)).toBe("1 minute ago");
    });

    it("handles ISO string timestamps", () => {
      // formatRelativeTime expects ISO date strings, not numeric strings
      const date = new Date(NOW - 60 * 1000);
      expect(formatRelativeTime(date.toISOString())).toBe("1 minute ago");
    });

    it("returns 'just now' for invalid inputs", () => {
      expect(formatRelativeTime("invalid")).toBe("just now");
    });

    it("uses singular form correctly", () => {
      expect(formatRelativeTime(NOW - 1 * 60 * 1000)).toBe("1 minute ago");
      expect(formatRelativeTime(NOW - 1 * 60 * 60 * 1000)).toBe("1 hour ago");
      expect(formatRelativeTime(NOW - 1 * 24 * 60 * 60 * 1000)).toBe("1 day ago");
    });
  });

  describe("toSafeDate", () => {
    it("returns Date for valid timestamp", () => {
      const date = toSafeDate(NOW);
      expect(date).toBeInstanceOf(Date);
      expect(date?.getTime()).toBe(NOW);
    });

    it("returns null for null input", () => {
      expect(toSafeDate(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(toSafeDate(undefined)).toBeNull();
    });

    it("returns null for NaN", () => {
      expect(toSafeDate(NaN)).toBeNull();
    });

    it("handles string timestamps", () => {
      const date = toSafeDate(String(NOW));
      expect(date?.getTime()).toBe(NOW);
    });

    it("normalizes second timestamps", () => {
      const seconds = Math.floor(NOW / 1000);
      const date = toSafeDate(seconds);
      expect(date?.getTime()).toBe(seconds * 1000);
    });
  });

  describe("toSafeInstant", () => {
    // This test depends on Temporal API availability
    const hasTemporal = isTemporalSupported();

    it.skipIf(!hasTemporal)("returns Instant for valid timestamp", () => {
      const instant = toSafeInstant(NOW);
      expect(instant).not.toBeNull();
      expect(instant?.epochMilliseconds).toBe(NOW);
    });

    it("returns null for invalid input", () => {
      expect(toSafeInstant(null)).toBeNull();
      expect(toSafeInstant(undefined)).toBeNull();
    });

    it("returns null when Temporal is not supported", () => {
      if (!hasTemporal) {
        expect(toSafeInstant(NOW)).toBeNull();
      }
    });
  });

  describe("formatDate", () => {
    it("formats valid date", () => {
      const result = formatDate(NOW);
      expect(typeof result).toBe("string");
      expect(result).not.toBe("Invalid date");
    });

    it("returns fallback for invalid input", () => {
      expect(formatDate(null)).toBe("Invalid date");
      expect(formatDate(undefined)).toBe("Invalid date");
    });

    it("accepts custom fallback", () => {
      expect(formatDate(null, undefined, "N/A")).toBe("N/A");
    });
  });

  describe("formatDateTime", () => {
    it("formats valid datetime", () => {
      const result = formatDateTime(NOW);
      expect(typeof result).toBe("string");
      expect(result).not.toBe("Invalid date");
    });

    it("returns fallback for invalid input", () => {
      expect(formatDateTime(null)).toBe("Invalid date");
    });
  });

  describe("toDateTimeLocalValue", () => {
    it("formats date for datetime-local input", () => {
      const result = toDateTimeLocalValue(NOW);
      // Should be in YYYY-MM-DDTHH:mm format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    });

    it("returns empty string for invalid input", () => {
      expect(toDateTimeLocalValue(null)).toBe("");
      expect(toDateTimeLocalValue(undefined)).toBe("");
    });
  });

  describe("fromDateTimeLocalValue", () => {
    it("parses datetime-local value", () => {
      const date = fromDateTimeLocalValue("2024-01-01T12:00");
      expect(date).toBeInstanceOf(Date);
    });

    it("returns current date for empty string", () => {
      const date = fromDateTimeLocalValue("");
      expect(date).toBeInstanceOf(Date);
    });

    it("returns current date for invalid input", () => {
      const date = fromDateTimeLocalValue("invalid");
      expect(date).toBeInstanceOf(Date);
    });
  });

  // Note: toDateInputValue and fromDateInputValue tests are in date-input.test.ts

  describe("getStartOfDayUTC", () => {
    it("returns midnight UTC timestamp", () => {
      const result = getStartOfDayUTC(NOW);
      expect(result).not.toBeNull();
      const date = new Date(result!);
      expect(date.getUTCHours()).toBe(0);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
    });

    it("returns null for invalid input", () => {
      expect(getStartOfDayUTC(null)).toBeNull();
    });
  });

  describe("compareTimestamps", () => {
    it("returns -1 when a < b", () => {
      expect(compareTimestamps(1000, 2000)).toBe(-1);
    });

    it("returns 1 when a > b", () => {
      expect(compareTimestamps(2000, 1000)).toBe(1);
    });

    it("returns 0 when equal", () => {
      expect(compareTimestamps(1000, 1000)).toBe(0);
    });

    it("handles null values", () => {
      expect(compareTimestamps(null, null)).toBe(0);
      expect(compareTimestamps(null, 1000)).toBe(-1);
      expect(compareTimestamps(1000, null)).toBe(1);
    });
  });

  describe("getDurationMs", () => {
    it("calculates duration between timestamps", () => {
      // Use proper millisecond timestamps (above 1e12 threshold)
      const start = NOW - 2000;
      const end = NOW;
      expect(getDurationMs(start, end)).toBe(2000);
    });

    it("returns negative for reversed order", () => {
      const start = NOW;
      const end = NOW - 2000;
      expect(getDurationMs(start, end)).toBe(-2000);
    });

    it("normalizes second timestamps", () => {
      // Timestamps below 1e12 are treated as seconds
      const startSeconds = Math.floor(NOW / 1000) - 60; // 60 seconds ago in seconds
      const endSeconds = Math.floor(NOW / 1000);
      expect(getDurationMs(startSeconds, endSeconds)).toBe(60 * 1000); // 60000ms
    });

    it("returns null for invalid inputs", () => {
      expect(getDurationMs(null, NOW)).toBeNull();
      expect(getDurationMs(NOW, null)).toBeNull();
    });
  });

  describe("formatDuration", () => {
    it("formats seconds", () => {
      expect(formatDuration(30000)).toBe("30 seconds");
    });

    it("formats minutes", () => {
      expect(formatDuration(5 * 60 * 1000)).toBe("5 minutes");
    });

    it("formats hours", () => {
      expect(formatDuration(3 * 60 * 60 * 1000)).toBe("3 hours");
    });

    it("formats days", () => {
      expect(formatDuration(2 * 24 * 60 * 60 * 1000)).toBe("2 days");
    });

    it("uses singular form correctly", () => {
      expect(formatDuration(1000)).toBe("1 second");
      expect(formatDuration(60000)).toBe("1 minute");
      expect(formatDuration(3600000)).toBe("1 hour");
      expect(formatDuration(86400000)).toBe("1 day");
    });

    it("handles negative durations", () => {
      expect(formatDuration(-5000)).toBe("5 seconds");
    });
  });

  describe("addDuration", () => {
    it("adds days", () => {
      const result = addDuration(NOW, { days: 1 });
      expect(result - NOW).toBe(24 * 60 * 60 * 1000);
    });

    it("adds hours", () => {
      const result = addDuration(NOW, { hours: 2 });
      expect(result - NOW).toBe(2 * 60 * 60 * 1000);
    });

    it("adds multiple units", () => {
      const result = addDuration(NOW, { days: 1, hours: 2, minutes: 30 });
      const expected = 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000 + 30 * 60 * 1000;
      expect(result - NOW).toBe(expected);
    });

    it("handles weeks", () => {
      const result = addDuration(NOW, { weeks: 1 });
      expect(result - NOW).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe("getCurrentTimezone", () => {
    it("returns a timezone string", () => {
      const tz = getCurrentTimezone();
      expect(typeof tz).toBe("string");
      expect(tz.length).toBeGreaterThan(0);
    });
  });
});
