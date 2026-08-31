import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { fromCalendarDateKey, toCalendarDateKey } from "../../utils/calendar-date";
import { fromDateInputValue, toDateInputValue } from "../../utils/time";

/**
 * These helpers exist because mixing a UTC-basis parser with a local-basis
 * widget shifts the day for anyone not sitting on UTC. That bug shipped once:
 * the Create Assessment pickers stored the right "YYYY-MM-DD" but echoed the
 * previous day back to operators behind UTC. CI never caught it because CI runs
 * in UTC, so these tests assert the timezone-independent property directly
 * rather than trusting the runner's zone.
 */
describe("calendar date key helpers", () => {
  describe("toCalendarDateKey", () => {
    it("formats a local-midnight Date as its own calendar day", () => {
      // What react-day-picker hands back for "July 27, 2026".
      const localMidnight = new Date(2026, 6, 27);
      expect(toCalendarDateKey(localMidnight)).toBe("2026-07-27");
    });

    it("formats Unix seconds using local calendar parts", () => {
      const seconds = Math.floor(new Date(2026, 6, 27).getTime() / 1000);
      expect(toCalendarDateKey(seconds)).toBe("2026-07-27");
    });

    it("pads single-digit months and days", () => {
      expect(toCalendarDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    });

    it("treats a cleared field (0 or negative) as empty, not the epoch", () => {
      expect(toCalendarDateKey(0)).toBe("");
      expect(toCalendarDateKey(-1)).toBe("");
      // Contrast with the UTC/date-input pair, which reads 0 as the epoch.
      expect(toDateInputValue(0)).toBe("1970-01-01");
    });

    it("returns empty string for null, undefined, and invalid dates", () => {
      expect(toCalendarDateKey(null)).toBe("");
      expect(toCalendarDateKey(undefined)).toBe("");
      expect(toCalendarDateKey(new Date("nonsense"))).toBe("");
    });
  });

  describe("fromCalendarDateKey", () => {
    it("parses to local midnight, so the day survives the round trip", () => {
      const seconds = fromCalendarDateKey("2026-07-27");
      expect(seconds).not.toBeNull();
      const parsed = new Date((seconds as number) * 1000);
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(6);
      expect(parsed.getDate()).toBe(27);
      expect(parsed.getHours()).toBe(0);
    });

    it("tolerates surrounding whitespace", () => {
      expect(fromCalendarDateKey("  2026-07-27 ")).toBe(fromCalendarDateKey("2026-07-27"));
    });

    it("returns null for empty, malformed, and out-of-range input", () => {
      for (const value of [
        "",
        null,
        undefined,
        "2026-7-27",
        "27-07-2026",
        "2026-07-27T00:00:00Z",
        "not-a-date",
        "2026-13-01",
        "2026-00-10",
        "2026-07-00",
      ]) {
        expect(fromCalendarDateKey(value)).toBeNull();
      }
    });

    it("rejects overflow dates instead of silently rolling them forward", () => {
      // `new Date(2026, 1, 31)` quietly becomes March 3rd.
      expect(fromCalendarDateKey("2026-02-31")).toBeNull();
      expect(fromCalendarDateKey("2025-02-29")).toBeNull();
    });

    it("accepts a real leap day", () => {
      expect(fromCalendarDateKey("2024-02-29")).not.toBeNull();
    });
  });

  describe("round trip", () => {
    it("preserves the calendar day across a full picker cycle", () => {
      const keys = ["2026-01-01", "2026-02-28", "2026-07-27", "2026-12-31", "2024-02-29"];
      for (const key of keys) {
        const seconds = fromCalendarDateKey(key);
        expect(seconds).not.toBeNull();
        expect(toCalendarDateKey(seconds)).toBe(key);
      }
    });

    it("survives every day of a year without drifting across DST boundaries", () => {
      // DST transitions are where a naive +86400 walk loses or repeats a day.
      const cursor = new Date(2026, 0, 1);
      let checked = 0;
      while (cursor.getFullYear() === 2026) {
        const key = toCalendarDateKey(cursor);
        expect(toCalendarDateKey(fromCalendarDateKey(key))).toBe(key);
        cursor.setDate(cursor.getDate() + 1);
        checked += 1;
      }
      expect(checked).toBe(365);
    });
  });

  describe("basis separation", () => {
    it("round-trips on a non-UTC runtime without changing the test worker timezone", () => {
      const helperUrl = new URL("../../utils/calendar-date.ts", import.meta.url).href;
      const script = `
        import { fromCalendarDateKey, toCalendarDateKey } from ${JSON.stringify(helperUrl)};
        const key = "2026-07-27";
        const seconds = fromCalendarDateKey(key);
        if (new Date(seconds * 1000).getTimezoneOffset() <= 0) process.exit(2);
        if (toCalendarDateKey(seconds) !== key) process.exit(3);
      `;
      const result = spawnSync(process.execPath, ["-e", script], {
        env: { ...process.env, TZ: "America/Los_Angeles" },
        encoding: "utf8",
      });

      expect(result.status, result.stderr).toBe(0);
    });

    it("stays distinct from the UTC pair away from UTC, and agrees on UTC", () => {
      const key = "2026-07-27";
      const localSeconds = fromCalendarDateKey(key) as number;
      const utcSeconds = fromDateInputValue(key);
      const offsetMinutes = new Date(2026, 6, 27).getTimezoneOffset();

      // The two bases differ by exactly the local UTC offset — zero on UTC
      // runners, non-zero elsewhere. Either way the local key round-trips.
      expect(localSeconds - utcSeconds).toBe(offsetMinutes * 60);
      expect(toCalendarDateKey(localSeconds)).toBe(key);
    });

    it("shows why the bases must not be crossed", () => {
      const key = "2026-07-27";
      // Crossing them — UTC parse rendered with local parts — is the shipped bug.
      const crossed = toCalendarDateKey(fromDateInputValue(key));
      const offsetMinutes = new Date(2026, 6, 27).getTimezoneOffset();
      if (offsetMinutes > 0) {
        // Behind UTC (e.g. America/Los_Angeles): lands on the previous day.
        expect(crossed).toBe("2026-07-26");
      } else {
        expect(crossed).toBe(key);
      }
    });
  });
});
