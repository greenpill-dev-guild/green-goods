/**
 * Garden reporting lab (Storybook prototype): date helpers.
 *
 * A day is a calendar date in the garden's own zone ("2026-01-13"). The lab fixes each
 * garden's zone so a submission at 22:30 UTC lands on the day its gardeners lived it, and
 * so the prototype renders the same on every reviewer's machine. Production has no garden
 * time zone yet; see the lab's notes.
 */

/** A calendar date in the garden's zone, `YYYY-MM-DD`. */
export type DayKey = string;
/** A calendar month, `YYYY-MM`. */
export type MonthKey = string;

const DAY_MS = 86_400_000;
const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The garden-zone day an instant falls on. */
export function dayKeyOf(ms: number, timeZone: string): DayKey {
  const parts = partsFormatter(timeZone).formatToParts(new Date(ms));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function dayToUtcMs(day: DayKey): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date);
}

function utcMsToDay(ms: number): DayKey {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: DayKey, days: number): DayKey {
  return utcMsToDay(dayToUtcMs(day) + days * DAY_MS);
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((dayToUtcMs(to) - dayToUtcMs(from)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday: the lab's weeks start on Monday. */
export function weekdayIndex(day: DayKey): number {
  return (new Date(dayToUtcMs(day)).getUTCDay() + 6) % 7;
}

export function weekStartOf(day: DayKey): DayKey {
  return addDays(day, -weekdayIndex(day));
}

export function monthOf(day: DayKey): MonthKey {
  return day.slice(0, 7);
}

export function addMonths(month: MonthKey, months: number): MonthKey {
  const [year, index] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, index - 1 + months, 1));
  return shifted.toISOString().slice(0, 7);
}

export function firstDayOf(month: MonthKey): DayKey {
  return `${month}-01`;
}

export function lastDayOf(month: MonthKey): DayKey {
  return addDays(firstDayOf(addMonths(month, 1)), -1);
}

/** The instant a garden-zone wall time happens, for a fixed-offset zone. */
export function instantAt(day: DayKey, hour: number, minute: number, utcOffsetMinutes: number) {
  return dayToUtcMs(day) + (hour * 60 + minute - utcOffsetMinutes) * 60_000;
}

/** The first instant of the day after `day`, in the garden's zone. */
export function endOfDay(day: DayKey, utcOffsetMinutes: number): number {
  return instantAt(addDays(day, 1), 0, 0, utcOffsetMinutes);
}

/** Every day from `start` to `end`, both included. */
export function eachDay(start: DayKey, end: DayKey): DayKey[] {
  const days: DayKey[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

/** The Monday-first weeks that cover a month: the calendar's rows. */
export function monthGrid(month: MonthKey): DayKey[][] {
  const start = weekStartOf(firstDayOf(month));
  const end = addDays(weekStartOf(lastDayOf(month)), 6);
  const weeks: DayKey[][] = [];
  for (let weekStart = start; weekStart <= end; weekStart = addDays(weekStart, 7)) {
    weeks.push(eachDay(weekStart, addDays(weekStart, 6)));
  }
  return weeks;
}

/** `count` Monday-first weeks, the last one holding `lastDay`. */
export function weeksEndingAt(lastDay: DayKey, count: number) {
  const lastStart = weekStartOf(lastDay);
  return Array.from({ length: count }, (_, index) => {
    const start = addDays(lastStart, (index - count + 1) * 7);
    return { start, end: addDays(start, 6) };
  });
}

/** Formats a garden-zone day without letting the reader's own zone move it. */
export function formatDay(day: DayKey, locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    new Date(dayToUtcMs(day))
  );
}

export function formatMonth(month: MonthKey, locale: string) {
  return formatDay(firstDayOf(month), locale, { month: "long", year: "numeric" });
}

/** An instant in the garden's zone: "Tue, Jan 13, 4:05 PM". */
export function formatMoment(ms: number, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

export function formatShortDay(day: DayKey, locale: string) {
  return formatDay(day, locale, { month: "short", day: "numeric" });
}

export const DAY_IN_MS = DAY_MS;
