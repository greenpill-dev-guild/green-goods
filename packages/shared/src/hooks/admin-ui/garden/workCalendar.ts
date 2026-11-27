/**
 * A garden's month of work, laid out as a calendar.
 *
 * Days are calendar days on the reader's own device clock, the same clock the Activity feed
 * labels its times with: no garden stores a time zone. Every count the calendar, a day's list
 * and Review's day view show comes from these functions over one read, so they cannot disagree.
 */
import type { Work } from "../../../types/domain";
import { fromCalendarDateKey, toCalendarDateKey } from "../../../utils/calendar-date";

/** A calendar day on the reader's clock, `YYYY-MM-DD`. */
export type WorkDayKey = string;
/** A calendar month on the reader's clock, `YYYY-MM`. */
export type WorkMonthKey = string;

/** What a submission's review status reads as today; unknown when its decisions were unreadable. */
export type WorkCalendarStatus = "approved" | "pending" | "rejected" | "unknown";

export interface WorkStatusCounts {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  unknown: number;
}

/**
 * How much of a day the month's read covered. A read cut at its limit stops partway through a
 * day: that day is "partial" and every later day is "unread", never empty. Days still to come
 * are "whole", since nothing of theirs can be missing.
 */
type WorkDayCoverage = "whole" | "partial" | "unread";

export interface WorkCalendarDay {
  day: WorkDayKey;
  /** False for the days of neighbouring months that fill the grid's first and last weeks. */
  inMonth: boolean;
  isToday: boolean;
  /** Still to come: nothing can have been submitted yet. */
  isFuture: boolean;
  counts: WorkStatusCounts;
  /** The day's submissions, oldest first. */
  works: Work[];
  /** Whether `counts` and `works` are the whole day, a minimum, or not read at all. */
  coverage: WorkDayCoverage;
}

export interface WorkCalendarMonth {
  month: WorkMonthKey;
  /** Monday-first weeks covering the month. */
  weeks: WorkCalendarDay[][];
  counts: WorkStatusCounts;
  daysWithWork: number;
}

function pad(value: number): string {
  return `${value}`.padStart(2, "0");
}

function dayKeyOfDate(date: Date): WorkDayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The local calendar date a day key names, at local midnight. */
export function dateOfDay(day: WorkDayKey): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

function addDays(day: WorkDayKey, days: number): WorkDayKey {
  const date = dateOfDay(day);
  // Calendar arithmetic, not 24-hour steps: a daylight-saving day is 23 or 25 hours long.
  return dayKeyOfDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

export function monthOfDay(day: WorkDayKey): WorkMonthKey {
  return day.slice(0, 7);
}

export function monthOfDate(date: Date): WorkMonthKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function addMonths(month: WorkMonthKey, months: number): WorkMonthKey {
  const [year, index] = month.split("-").map(Number);
  return monthOfDate(new Date(year, index - 1 + months, 1));
}

/** The first day of a month, at local midnight. */
export function dateOfMonth(month: WorkMonthKey): Date {
  return dateOfDay(`${month}-01`);
}

/**
 * The month a URL names, or the current month when it names none, a malformed one, or one
 * still to come: a month that has not begun has nothing to show.
 */
export function parseWorkMonth(value: string | null | undefined, now: Date): WorkMonthKey {
  const current = monthOfDate(now);
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return current;
  return value > current ? current : value;
}

/** The day a URL names, when it is a real calendar day that has begun. */
export function parseWorkDay(value: string | null | undefined, now: Date): WorkDayKey | null {
  if (!value || fromCalendarDateKey(value) === null) return null;
  return value > dayKeyOfDate(now) ? null : value;
}

/** A month's first instant and the next month's first instant, in seconds. */
export function workMonthRange(month: WorkMonthKey): { from: number; to: number } {
  return {
    from: Math.floor(dateOfMonth(month).getTime() / 1000),
    to: Math.floor(dateOfMonth(addMonths(month, 1)).getTime() / 1000),
  };
}

/** A day's first instant and the next day's first instant, in seconds. */
export function workDayRange(day: WorkDayKey): { from: number; to: number } {
  return {
    from: Math.floor(dateOfDay(day).getTime() / 1000),
    to: Math.floor(dateOfDay(addDays(day, 1)).getTime() / 1000),
  };
}

/** The Monday-first weeks that cover a month: the calendar's rows. */
function monthGrid(month: WorkMonthKey): WorkDayKey[][] {
  const first = `${month}-01`;
  // getDay() counts from Sunday; the grid starts its weeks on Monday.
  const start = addDays(first, -((dateOfDay(first).getDay() + 6) % 7));
  const weeks: WorkDayKey[][] = [];
  for (let weekStart = start; monthOfDay(weekStart) <= month; weekStart = addDays(weekStart, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)));
  }
  return weeks;
}

export function workCalendarStatus(
  work: Work,
  unknownIds: ReadonlySet<string>
): WorkCalendarStatus {
  if (unknownIds.has(work.id)) return "unknown";
  return work.status === "approved" || work.status === "rejected" ? work.status : "pending";
}

function countWorkStatuses(
  works: readonly Work[],
  unknownIds: ReadonlySet<string>
): WorkStatusCounts {
  const counts: WorkStatusCounts = { total: 0, approved: 0, pending: 0, rejected: 0, unknown: 0 };
  for (const work of works) {
    counts.total += 1;
    counts[workCalendarStatus(work, unknownIds)] += 1;
  }
  return counts;
}

/**
 * Lay a month's submissions out by the day each was sent. `works` may hold other months'
 * work: only the month's own days count. Statuses are today's, not the month's end.
 * `readThrough` is where a cut read stopped (seconds), oldest first; null when it was whole.
 */
export function buildWorkCalendar(
  works: readonly Work[],
  unknownIds: ReadonlySet<string>,
  month: WorkMonthKey,
  now: Date,
  readThrough: number | null = null
): WorkCalendarMonth {
  const byDay = new Map<WorkDayKey, Work[]>();
  for (const work of [...works].sort((a, b) => a.createdAt - b.createdAt)) {
    const day = toCalendarDateKey(work.createdAt);
    if (monthOfDay(day) !== month) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), work]);
  }
  const today = dayKeyOfDate(now);
  const cutDay = readThrough === null ? null : toCalendarDateKey(readThrough);
  const coverageOf = (day: WorkDayKey, dayWorks: readonly Work[]): WorkDayCoverage => {
    if (cutDay === null || day > today || day < cutDay) return "whole";
    // The day the read stopped in holds at least what was read; with nothing read it is unread.
    return day === cutDay && dayWorks.length > 0 ? "partial" : "unread";
  };
  const weeks = monthGrid(month).map((week) =>
    week.map((day): WorkCalendarDay => {
      const inMonth = monthOfDay(day) === month;
      const dayWorks = inMonth ? (byDay.get(day) ?? []) : [];
      return {
        day,
        inMonth,
        isToday: day === today,
        isFuture: day > today,
        counts: countWorkStatuses(dayWorks, unknownIds),
        works: dayWorks,
        coverage: coverageOf(day, dayWorks),
      };
    })
  );
  const monthWorks = weeks.flat().flatMap((cell) => cell.works);
  return {
    month,
    weeks,
    counts: countWorkStatuses(monthWorks, unknownIds),
    daysWithWork: weeks.flat().filter((cell) => cell.works.length > 0).length,
  };
}
