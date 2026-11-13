/**
 * Garden reporting lab: the steward's scope. One garden (the GardenChip), one month and a
 * few filters are shared by every report, so a drill-down and the way back keep them.
 */
import { addMonths, dayKeyOf, endOfDay, lastDayOf, type MonthKey, monthOf } from "./dates";
import type { ReportDataset, ReportGarden, StatusView, WorkRecord } from "./model";

export type ReportView =
  | "overview"
  | "calendar"
  | "review"
  | "outputs"
  | "season"
  | "places"
  | "people"
  | "funding"
  | "evidence";

/** Which day a record lands on in the calendar. */
export type GroupBy = "submitted" | "reviewed";
/** Whether a past month shows today's statuses or the statuses it ended with. */
export type StatusAsOf = "reference" | "period-end";
export type StatusFilter = "all" | StatusView;

export interface ReportScope {
  view: ReportView;
  month: MonthKey;
  actionId: string;
  windowId: string;
  status: StatusFilter;
  groupBy: GroupBy;
  statusAsOf: StatusAsOf;
}

/** Which shared filters each report reads; the toolbar shows only these. */
export const VIEW_FILTERS: Record<
  ReportView,
  { action: boolean; window: boolean; status: boolean }
> = {
  overview: { action: true, window: true, status: false },
  calendar: { action: true, window: true, status: true },
  review: { action: true, window: false, status: false },
  outputs: { action: true, window: true, status: false },
  season: { action: false, window: true, status: false },
  places: { action: true, window: true, status: true },
  people: { action: true, window: true, status: false },
  funding: { action: false, window: false, status: false },
  evidence: { action: false, window: false, status: false },
};

export function referenceDay(dataset: ReportDataset) {
  return dayKeyOf(dataset.reference, dataset.garden.timeZone);
}

export function defaultScope(dataset: ReportDataset, view: ReportView = "overview"): ReportScope {
  return {
    view,
    month: monthOf(referenceDay(dataset)),
    actionId: "all",
    windowId: "all",
    status: "all",
    groupBy: "submitted",
    statusAsOf: "reference",
  };
}

/** The months a garden can show: from its first possible record to the reference month. */
export function availableMonths(dataset: ReportDataset): MonthKey[] {
  const months: MonthKey[] = [];
  const last = monthOf(referenceDay(dataset));
  for (
    let month = monthOf(dataset.garden.recordsBegin);
    month <= last;
    month = addMonths(month, 1)
  ) {
    months.push(month);
  }
  return months;
}

/** The end of the month, or the reference moment while the month is still running. */
export function periodEnd(month: MonthKey, dataset: ReportDataset): number {
  return Math.min(endOfDay(lastDayOf(month), dataset.garden.utcOffsetMinutes), dataset.reference);
}

/**
 * The last day a moment covers. A month's end is the first instant of the next day, so the
 * day it closes is the one before it: "as of Dec 31", never "as of Jan 1".
 */
export function closingDay(at: number, dataset: ReportDataset) {
  return dayKeyOf(at - 1, dataset.garden.timeZone);
}

/** The moment a report reads statuses at, by the scope's choice. */
export function statusMoment(scope: ReportScope, dataset: ReportDataset): number {
  return scope.statusAsOf === "period-end" ? periodEnd(scope.month, dataset) : dataset.reference;
}

function windowFor(garden: ReportGarden, windowId: string) {
  return garden.windows.find((window) => window.id === windowId);
}

/** The action and season filters. Status depends on the moment, so each view applies it. */
export function scopeRecords(dataset: ReportDataset, scope: ReportScope): WorkRecord[] {
  const filters = VIEW_FILTERS[scope.view];
  const window = filters.window ? windowFor(dataset.garden, scope.windowId) : undefined;
  return dataset.records.filter((record) => {
    if (filters.action && scope.actionId !== "all" && record.actionId !== scope.actionId) {
      return false;
    }
    if (!window) return true;
    const day = dayKeyOf(record.submittedAt, dataset.garden.timeZone);
    return day >= window.start && day <= window.end;
  });
}

export function activeFilterCount(scope: ReportScope) {
  const filters = VIEW_FILTERS[scope.view];
  return (
    Number(filters.action && scope.actionId !== "all") +
    Number(filters.window && scope.windowId !== "all") +
    Number(filters.status && scope.status !== "all")
  );
}
