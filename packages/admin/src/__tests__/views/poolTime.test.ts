/**
 * The pool console's timestamp policy (PRD-1025 D3), read in the viewer's zone:
 * timeline events, due dates in rows, exact deadlines, and short dates that
 * name the year only when it isn't this one.
 */

import { createIntl } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatUnixDate } from "@/views/Garden/Pool/poolPresentation";
import { dueDateText, exactTime, timelineTime } from "@/views/Garden/Pool/poolTime";

const intl = createIntl({ locale: "en", timeZone: "America/Los_Angeles", messages: {} });
/** Mon, Sep 28, 2026, 4:00 PM in Los Angeles, the viewer's zone here. */
const NOW = Date.parse("2026-09-28T16:00:00-07:00");
const at = (iso: string) => Date.parse(iso);

describe("poolTime", () => {
  beforeEach(() => {
    // Calendar days are the viewer's: the day boundaries follow the process zone.
    vi.stubEnv("TZ", "America/Los_Angeles");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads timeline events as today, yesterday, a weekday this week, a date, or a date with its year", () => {
    expect(timelineTime(intl, at("2026-09-28T15:42:00-07:00"), NOW)).toBe("Today, 3:42 PM");
    expect(timelineTime(intl, at("2026-09-27T09:05:00-07:00"), NOW)).toBe("Yesterday, 9:05 AM");
    expect(timelineTime(intl, at("2026-09-26T10:05:00-07:00"), NOW)).toBe("Sat, Sep 26, 10:05 AM");
    expect(timelineTime(intl, at("2026-09-21T14:18:00-07:00"), NOW)).toBe("Sep 21, 2:18 PM");
    expect(timelineTime(intl, at("2025-12-30T16:10:00-08:00"), NOW)).toBe("Dec 30, 2025, 4:10 PM");
  });

  it("gives a due date its time only within the next 48 hours", () => {
    expect(dueDateText(intl, at("2026-09-28T18:00:00-07:00"), NOW)).toBe("today, 6:00 PM");
    expect(dueDateText(intl, at("2026-09-29T15:42:00-07:00"), NOW)).toBe("tomorrow, 3:42 PM");
    expect(dueDateText(intl, at("2026-10-12T15:42:00-07:00"), NOW)).toBe("Oct 12");
    expect(dueDateText(intl, at("2027-01-05T09:00:00-08:00"), NOW)).toBe("Jan 5, 2027");
    // A deadline already past reads as its date; the row's Past due chip says the rest.
    expect(dueDateText(intl, at("2026-09-28T09:00:00-07:00"), NOW)).toBe("Sep 28");
  });

  it("writes an exact deadline with its date, time and zone, and never seconds", () => {
    expect(exactTime(intl, at("2026-10-12T15:42:31-07:00"))).toBe("Mon, Oct 12, 2026, 3:42 PM PDT");
  });

  it("names the year in a short date only when it isn't this one", () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    try {
      expect(formatUnixDate(at("2026-11-30T12:00:00Z") / 1000, "en")).toBe("Nov 30");
      expect(formatUnixDate(at("2025-11-30T12:00:00Z") / 1000, "en")).toBe("Nov 30, 2025");
      expect(formatUnixDate(null, "en", "—")).toBe("—");
    } finally {
      vi.useRealTimers();
    }
  });
});
