/**
 * Garden reporting lab: status, calendar and weekly-measure aggregation.
 *
 * Every count a view draws comes from these functions over the same records, so a day,
 * a week, a list and a total cannot disagree.
 */
import {
  type DayKey,
  dayKeyOf,
  lastDayOf,
  type MonthKey,
  monthGrid,
  monthOf,
  weeksEndingAt,
} from "./dates";
import type { MeasureDef, ReportDataset, StatusView, WorkRecord } from "./model";
import { type GroupBy, referenceDay, type StatusFilter } from "./scope";

/** A record's status at a moment: pending until a decision lands, unknown when unread. */
export function statusAt(record: WorkRecord, at: number): StatusView {
  if (!record.approvalReadable) return "unknown";
  const decided = record.decision !== "pending" && record.reviewedAt !== undefined;
  return decided && (record.reviewedAt as number) <= at ? record.decision : "pending";
}

export interface StatusCounts {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  unknown: number;
}

function emptyCounts(): StatusCounts {
  return { total: 0, approved: 0, pending: 0, rejected: 0, unknown: 0 };
}

export function countStatuses(records: readonly WorkRecord[], at: number): StatusCounts {
  const counts = emptyCounts();
  for (const record of records) {
    counts.total += 1;
    counts[statusAt(record, at)] += 1;
  }
  return counts;
}

export function matchesStatus(record: WorkRecord, at: number, filter: StatusFilter) {
  return filter === "all" || statusAt(record, at) === filter;
}

/**
 * What a day can say. Zero work on a read day is "recorded"; days before the garden could
 * report, days the read did not reach and days still to come are something else.
 */
export type DayState = "before-records" | "not-loaded" | "partial" | "recorded" | "future";

export interface CalendarDay {
  day: DayKey;
  inMonth: boolean;
  state: DayState;
  isToday: boolean;
  counts: StatusCounts;
  lateUploads: number;
  records: WorkRecord[];
}

export interface CalendarInput {
  dataset: ReportDataset;
  records: readonly WorkRecord[];
  month: MonthKey;
  groupBy: GroupBy;
  /** The moment statuses are read at (today, or the month's end). */
  at: number;
  status: StatusFilter;
}

export function dayStateOf(day: DayKey, dataset: ReportDataset): DayState {
  if (day < dataset.garden.recordsBegin) return "before-records";
  if (day > referenceDay(dataset)) return "future";
  if (dataset.loadedFrom === null) return "recorded";
  const loadedFromDay = dayKeyOf(dataset.loadedFrom, dataset.garden.timeZone);
  if (day < loadedFromDay) return "not-loaded";
  return day === loadedFromDay ? "partial" : "recorded";
}

/** The day a record lands on, or null when it has no such day (no decision yet, or unread). */
function calendarDayOf(record: WorkRecord, groupBy: GroupBy, dataset: ReportDataset) {
  const { timeZone } = dataset.garden;
  if (groupBy === "submitted") return dayKeyOf(record.submittedAt, timeZone);
  if (!record.approvalReadable || record.decision === "pending") return null;
  const reviewedAt = record.reviewedAt;
  return reviewedAt !== undefined && reviewedAt <= dataset.reference
    ? dayKeyOf(reviewedAt, timeZone)
    : null;
}

export function buildCalendar({ dataset, records, month, groupBy, at, status }: CalendarInput) {
  const byDay = new Map<DayKey, WorkRecord[]>();
  for (const record of records) {
    const day = calendarDayOf(record, groupBy, dataset);
    if (!day || monthOf(day) !== month) continue;
    // A review-date calendar shows each decision as made; a status filter still applies.
    const view = groupBy === "reviewed" ? record.decision : statusAt(record, at);
    if (status !== "all" && view !== status) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), record]);
  }
  const today = referenceDay(dataset);
  const weeks = monthGrid(month).map((week) =>
    week.map((day): CalendarDay => {
      const dayRecords = byDay.get(day) ?? [];
      return {
        day,
        inMonth: monthOf(day) === month,
        state: dayStateOf(day, dataset),
        isToday: day === today,
        counts: countStatuses(dayRecords, groupBy === "reviewed" ? dataset.reference : at),
        lateUploads: dayRecords.filter((record) => record.sentFromDeviceAt !== undefined).length,
        records: dayRecords,
      };
    })
  );
  const monthDays = weeks.flat().filter((cell) => cell.inMonth);
  const monthRecords = monthDays.flatMap((cell) => cell.records);
  return {
    weeks,
    monthRecords,
    monthCounts: countStatuses(monthRecords, groupBy === "reviewed" ? dataset.reference : at),
    daysWithWork: monthDays.filter((cell) => cell.records.length > 0).length,
    hasUnreadDays: monthDays.some(
      (cell) => cell.state === "not-loaded" || cell.state === "partial"
    ),
  };
}

export interface WeekRange {
  start: DayKey;
  end: DayKey;
}

/** The weeks a report charts: eight, the last holding the month's end or today. */
export function reportWeeks(month: MonthKey, dataset: ReportDataset, count = 8): WeekRange[] {
  const today = referenceDay(dataset);
  const last = lastDayOf(month) < today ? lastDayOf(month) : today;
  return weeksEndingAt(last, count);
}

export function recordsInWeek(
  records: readonly WorkRecord[],
  week: WeekRange,
  dataset: ReportDataset
) {
  return records.filter((record) => {
    const day = dayKeyOf(record.submittedAt, dataset.garden.timeZone);
    return day >= week.start && day <= week.end;
  });
}

/** A record's value for a measure; null when the gardener left it empty. */
export function measureValue(record: WorkRecord, measure: MeasureDef): number | null {
  if (measure.kind === "count") return 1;
  if (measure.kind === "hours") return record.minutes === null ? null : record.minutes / 60;
  const value = record.quantities[measure.quantityKey ?? ""];
  return value === undefined ? null : value;
}

function appliesTo(record: WorkRecord, measure: MeasureDef) {
  return measure.actionId === undefined || record.actionId === measure.actionId;
}

/** What a week can say: begun before records, cut by the read, or still running. */
export type WeekState = "ok" | "before-records" | "not-loaded" | "in-progress";

export interface MeasurePoint {
  week: WeekRange;
  state: WeekState;
  /** Everything submitted, whatever its status. */
  reported: number;
  /** Approved as of the reference date. */
  approved: number;
  missing: number;
  records: WorkRecord[];
}

function weekStateOf(week: WeekRange, dataset: ReportDataset): WeekState {
  if (week.end < dataset.garden.recordsBegin) return "before-records";
  if (week.start <= referenceDay(dataset) && referenceDay(dataset) <= week.end) {
    return "in-progress";
  }
  if (dataset.loadedFrom === null) return "ok";
  return week.start < dayKeyOf(dataset.loadedFrom, dataset.garden.timeZone) ? "not-loaded" : "ok";
}

export function measureSeries(
  dataset: ReportDataset,
  records: readonly WorkRecord[],
  measure: MeasureDef,
  weeks: readonly WeekRange[]
): MeasurePoint[] {
  const relevant = records.filter((record) => appliesTo(record, measure));
  return weeks.map((week) => {
    const inWeek = recordsInWeek(relevant, week, dataset);
    let reported = 0;
    let approved = 0;
    let missing = 0;
    for (const record of inWeek) {
      const value = measureValue(record, measure);
      if (value === null) {
        missing += 1;
        continue;
      }
      reported += value;
      if (statusAt(record, dataset.reference) === "approved") approved += value;
    }
    return {
      week,
      state: weekStateOf(week, dataset),
      reported,
      approved,
      missing,
      records: inWeek,
    };
  });
}
