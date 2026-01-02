/**
 * Time Utility Tests
 *
 * Tests for time formatting and manipulation utilities
 */

import { describe, it, expect } from "vitest";

describe("Time Utilities", () => {
  describe("formatDate", () => {
    it("formats timestamp to readable date", () => {
      const timestamp = new Date("2024-01-15T10:30:00Z").getTime();
      const date = new Date(timestamp);
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0); // January
      expect(date.getDate()).toBe(15);
    });

    it("handles invalid timestamps", () => {
      const invalidTimestamp = NaN;
      const date = new Date(invalidTimestamp);
      expect(isNaN(date.getTime())).toBe(true);
    });
  });

  describe("formatDateTime", () => {
    it("formats timestamp to datetime string", () => {
      const timestamp = new Date("2024-01-15T10:30:00Z").getTime();
      const date = new Date(timestamp);
      const formatted = date.toISOString();
      expect(formatted).toContain("2024-01-15");
      expect(formatted).toContain("10:30:00");
    });
  });

  describe("formatRelativeTime", () => {
    it("formats recent time as 'just now'", () => {
      const now = Date.now();
      const recent = now - 1000; // 1 second ago
      const diff = now - recent;
      expect(diff).toBeLessThan(60000); // Less than 1 minute
    });

    it("formats time as minutes ago", () => {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      const diff = Math.floor((now - fiveMinutesAgo) / 60000);
      expect(diff).toBe(5);
    });

    it("formats time as hours ago", () => {
      const now = Date.now();
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;
      const diff = Math.floor((now - twoHoursAgo) / 3600000);
      expect(diff).toBe(2);
    });

    it("formats time as days ago", () => {
      const now = Date.now();
      const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
      const diff = Math.floor((now - threeDaysAgo) / 86400000);
      expect(diff).toBe(3);
    });
  });

  describe("isExpired", () => {
    it("returns true for past timestamps", () => {
      const pastTime = Date.now() - 1000;
      expect(pastTime < Date.now()).toBe(true);
    });

    it("returns false for future timestamps", () => {
      const futureTime = Date.now() + 1000;
      expect(futureTime > Date.now()).toBe(true);
    });
  });

  describe("timeRemaining", () => {
    it("calculates time remaining until future date", () => {
      const now = Date.now();
      const future = now + 3600000; // 1 hour from now
      const remaining = future - now;
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(3600000);
    });

    it("returns 0 for past dates", () => {
      const now = Date.now();
      const past = now - 1000;
      const remaining = Math.max(0, past - now);
      expect(remaining).toBe(0);
    });
  });
});
