/**
 * Garden reporting lab: review health. The stall rule is the shipped one
 * (`summarizeReviewQueue`, DL-044): work that has waited a week is metadata until no
 * review has landed for a week too.
 */
import { summarizeReviewQueue } from "@green-goods/shared/utils/garden-detail";
import { type WeekRange, recordsInWeek, reportWeeks, statusAt } from "./aggregate";
import { DAY_IN_MS, dayKeyOf, endOfDay } from "./dates";
import type { ReportDataset, WorkRecord } from "./model";

const AGE_BANDS = [
  { id: "under-2d", label: "Under 2 days", min: 0, max: 2 },
  { id: "2-7d", label: "2 to 7 days", min: 2, max: 7 },
  { id: "1-2w", label: "1 to 2 weeks", min: 7, max: 14 },
  { id: "over-2w", label: "Over 2 weeks", min: 14, max: Number.POSITIVE_INFINITY },
] as const;

export type AgeBandId = (typeof AGE_BANDS)[number]["id"];

export function ageBandOf(record: WorkRecord, at: number): AgeBandId {
  const days = (at - record.submittedAt) / DAY_IN_MS;
  return (AGE_BANDS.find((band) => days >= band.min && days < band.max) ?? AGE_BANDS[3]).id;
}

export interface ReviewFlowWeek {
  week: WeekRange;
  submitted: number;
  reviewed: number;
  /** Waiting at the end of the week (or now, for the running week). */
  waiting: number;
}

export type ReviewHealthTone = "success" | "warning" | "error";

export interface ReviewHealth {
  at: number;
  pending: WorkRecord[];
  bands: { id: AgeBandId; label: string; records: WorkRecord[] }[];
  oldest: WorkRecord[];
  flow: ReviewFlowWeek[];
  unknown: number;
  lastReviewedAt: number | null;
  medianDays: number | null;
  tone: ReviewHealthTone;
  label: string;
  detail: string;
}

function healthLabel(stalled: boolean, overWeek: number, pending: number) {
  if (stalled) {
    return {
      tone: "error" as const,
      label: "Review stalled",
      detail: "Work has waited over a week and no review has landed in the last week.",
    };
  }
  if (overWeek > 0) {
    return {
      tone: "warning" as const,
      label: "Needs attention",
      detail: `${overWeek} waiting over a week, while reviews still land.`,
    };
  }
  return {
    tone: "success" as const,
    label: "On track",
    detail: pending === 0 ? "Nothing is waiting for review." : "Nothing has waited over a week.",
  };
}

/** Review health at a moment: today, or a past month's end. */
export function reviewHealth(
  dataset: ReportDataset,
  records: readonly WorkRecord[],
  at: number,
  month: string
): ReviewHealth {
  const known = records.filter((record) => record.submittedAt <= at);
  const readable = known.filter((record) => record.approvalReadable);
  const pending = readable
    .filter((record) => statusAt(record, at) === "pending")
    .sort((a, b) => a.submittedAt - b.submittedAt);
  const summary = summarizeReviewQueue(
    readable.map((record) => ({
      id: record.id,
      status: statusAt(record, at),
      createdAt: record.submittedAt,
      reviewedAt:
        record.reviewedAt !== undefined && record.reviewedAt <= at ? record.reviewedAt : undefined,
    })),
    at,
    { complete: dataset.loadedFrom === null }
  );
  const flow = reportWeeks(month, dataset).map((week): ReviewFlowWeek => {
    const weekEnd = Math.min(endOfDay(week.end, dataset.garden.utcOffsetMinutes), at);
    return {
      week,
      submitted: recordsInWeek(known, week, dataset).length,
      reviewed: readable.filter((record) => {
        if (record.reviewedAt === undefined || record.reviewedAt > at) return false;
        const day = dayKeyOf(record.reviewedAt, dataset.garden.timeZone);
        return day >= week.start && day <= week.end;
      }).length,
      waiting: readable.filter(
        (record) => record.submittedAt <= weekEnd && statusAt(record, weekEnd) === "pending"
      ).length,
    };
  });
  return {
    at,
    pending,
    bands: AGE_BANDS.map((band) => ({
      id: band.id,
      label: band.label,
      records: pending.filter((record) => ageBandOf(record, at) === band.id),
    })),
    oldest: pending.slice(0, 3),
    flow,
    unknown: known.length - readable.length,
    lastReviewedAt: summary.lastReviewedAt,
    medianDays:
      summary.medianReviewLatencyMs === null ? null : summary.medianReviewLatencyMs / DAY_IN_MS,
    ...healthLabel(summary.stalled, summary.waitingOverWeekCount, pending.length),
  };
}
