/**
 * Garden reporting lab: what opens when a calendar day is chosen. Its records, titled with
 * the day, the scope they were counted in, the moment their statuses are read at, and why
 * an empty day is empty.
 */
import type { CalendarDay } from "./aggregate";
import { formatDay } from "./dates";
import { filterSummary } from "./labCopy";
import type { ReportDataset } from "./model";
import type { RecordsRequest } from "./RecordsDialog";
import { type ReportScope, statusMoment } from "./scope";

export function dayRecordsRequest(
  cell: CalendarDay,
  dataset: ReportDataset,
  scope: ReportScope,
  locale: string
): RecordsRequest {
  const byReview = scope.groupBy === "reviewed";
  return {
    title: formatDay(cell.day, locale, { weekday: "long", month: "long", day: "numeric" }),
    scopeLine: `${byReview ? "Decided" : "Submitted"} that day, ${filterSummary(scope, dataset.garden)}`,
    records: cell.records,
    day: cell.day,
    at: byReview ? dataset.reference : statusMoment(scope, dataset),
    emptyNote:
      cell.state === "not-loaded"
        ? "This day is older than the records loaded so far, so its work is not counted yet."
        : `Nothing was ${byReview ? "decided" : "submitted"} that day.`,
  };
}
