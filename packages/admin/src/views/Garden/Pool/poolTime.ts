/**
 * How the pool console writes a moment (PRD-1025 D3): always in the viewer's
 * own zone, with the locale choosing 12 or 24 hours, and never seconds. Queue
 * ages read relative, with the exact moment behind them; a timeline event
 * reads "Today, 3:42 PM" or its date and time, with the year only when it
 * isn't this year; anything decided this visit reads as a clock time; a due
 * date in a row gains its time within 48 hours; an exact deadline carries its
 * date, time and zone.
 */

import type { IntlShape } from "react-intl";

type TimeIntl = Pick<
  IntlShape,
  "formatDate" | "formatTime" | "formatMessage" | "formatDateToParts"
>;

const DAY_MS = 86_400_000;
const TWO_DAYS_MS = 2 * DAY_MS;

/** "Sat, Sep 26, 2026, 10:05 AM PDT": the full moment, for a tooltip or an exact deadline. */
export function exactTime(intl: Pick<IntlShape, "formatDate">, ms: number): string {
  return intl.formatDate(ms, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** "3:42 PM", or "15:42" where the locale reads 24 hours: for what happened this visit. */
export function clockTime(intl: Pick<IntlShape, "formatTime">, ms: number): string {
  return intl.formatTime(ms, { hour: "numeric", minute: "2-digit" });
}

/** The machine-readable moment a `<time>` carries. */
export function isoTime(ms: number): string {
  return new Date(ms).toISOString();
}

/** The viewer's zone as the locale shortens it ("PDT"), for a section's one "Times in" label. */
export function zoneName(intl: Pick<IntlShape, "formatDateToParts">, ms: number): string {
  return (
    intl
      .formatDateToParts(ms, { timeZoneName: "short" })
      .find((part) => part.type === "timeZoneName")?.value ?? ""
  );
}

type DayIntl = Pick<IntlShape, "formatDate" | "formatDateToParts">;

/**
 * The calendar day holding `ms`, in the zone the text is written in, as a day
 * number and its year. Reading it through `intl` keeps "today" and the time
 * beside it in one zone.
 */
function calendarDay(intl: DayIntl, ms: number): { day: number; year: number } {
  const parts = intl.formatDateToParts(ms, { year: "numeric", month: "numeric", day: "numeric" });
  const part = (type: "year" | "month" | "day") =>
    Number(parts.find((entry) => entry.type === type)?.value);
  const year = part("year");
  return { day: Date.UTC(year, part("month") - 1, part("day")) / DAY_MS, year };
}

/** Calendar days from the viewer's today to the day holding `ms`: 0 today, -1 yesterday. */
function dayOffset(intl: DayIntl, ms: number, nowMs: number): number {
  return calendarDay(intl, ms).day - calendarDay(intl, nowMs).day;
}

const sameYear = (intl: DayIntl, ms: number, nowMs: number) =>
  calendarDay(intl, ms).year === calendarDay(intl, nowMs).year;

/** A day with no time: "Sep 28", with the year when it isn't this one. */
export function dayText(intl: DayIntl, ms: number, nowMs: number): string {
  return intl.formatDate(ms, {
    month: "short",
    day: "numeric",
    ...(sameYear(intl, ms, nowMs) ? {} : { year: "numeric" as const }),
  });
}

/**
 * A timeline event: "Today, 3:42 PM", "Yesterday, 9:05 AM", the weekday within
 * the week ("Sat, Sep 26, 10:05 AM"), then the date ("Sep 21, 2:18 PM"), with
 * the year only when it isn't this one ("Dec 30, 2025, 4:10 PM").
 */
export function timelineTime(intl: TimeIntl, ms: number, nowMs: number): string {
  const offset = dayOffset(intl, ms, nowMs);
  const time = clockTime(intl, ms);
  if (offset === 0) {
    return intl.formatMessage(
      { id: "cockpit.garden.pool.time.today", defaultMessage: "Today, {time}" },
      { time }
    );
  }
  if (offset === -1) {
    return intl.formatMessage(
      { id: "cockpit.garden.pool.time.yesterday", defaultMessage: "Yesterday, {time}" },
      { time }
    );
  }
  return intl.formatDate(ms, {
    ...(offset < 0 && offset > -7 ? { weekday: "short" as const } : {}),
    month: "short",
    day: "numeric",
    ...(sameYear(intl, ms, nowMs) ? {} : { year: "numeric" as const }),
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * A due date in a row, for "due {date}": the date ("Oct 12", with the year
 * when it isn't this one), and the time too when it falls within the next 48
 * hours ("today, 6:00 PM", "tomorrow, 3:42 PM").
 */
export function dueDateText(intl: TimeIntl, ms: number, nowMs: number): string {
  if (ms >= nowMs && ms - nowMs <= TWO_DAYS_MS) {
    const offset = dayOffset(intl, ms, nowMs);
    const time = clockTime(intl, ms);
    if (offset === 0) {
      return intl.formatMessage(
        { id: "cockpit.garden.pool.time.dueToday", defaultMessage: "today, {time}" },
        { time }
      );
    }
    if (offset === 1) {
      return intl.formatMessage(
        { id: "cockpit.garden.pool.time.dueTomorrow", defaultMessage: "tomorrow, {time}" },
        { time }
      );
    }
    return intl.formatDate(ms, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return dayText(intl, ms, nowMs);
}
