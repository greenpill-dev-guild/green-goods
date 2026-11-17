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
type StatusAsOf = "reference" | "period-end";
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
  { month: boolean; action: boolean; window: boolean; status: boolean }
> = {
  overview: { month: true, action: true, window: true, status: false },
  calendar: { month: true, action: true, window: true, status: true },
  review: { month: true, action: true, window: false, status: false },
  outputs: { month: true, action: true, window: true, status: false },
  season: { month: true, action: false, window: true, status: false },
  places: { month: true, action: true, window: true, status: true },
  people: { month: true, action: true, window: true, status: false },
  funding: { month: true, action: false, window: false, status: false },
  evidence: { month: false, action: false, window: false, status: false },
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

/**
 * The last instant inside the month, or the reference moment while the month is still running.
 * Callers compare inclusively, so an event at the next month's midnight stays out.
 */
export function periodEnd(month: MonthKey, dataset: ReportDataset): number {
  return Math.min(
    endOfDay(lastDayOf(month), dataset.garden.utcOffsetMinutes) - 1,
    dataset.reference
  );
}

/**
 * The last day a moment covers. A moment that sits on a day boundary closes the day before
 * it: "as of Dec 31", never "as of Jan 1".
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
