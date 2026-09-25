import type {
  GardenDetailTab,
  GardenRange,
  TabBadgeSeverity,
  TabBadgeState,
} from "../types/garden-detail";
import { Domain } from "../types/domain";

export function toMs(timestamp: number): number {
  return timestamp < 1e12 ? timestamp * 1000 : timestamp;
}

export function parseGardenDetailTab(tab: string | null): GardenDetailTab {
  if (tab === "overview" || tab === "impact" || tab === "work" || tab === "community") {
    return tab;
  }
  return "overview";
}

export function parseGardenRange(range: string | null): GardenRange {
  if (range === "7d" || range === "30d" || range === "90d") {
    return range;
  }
  return "30d";
}

function getMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

/** How long work may wait, and how long a queue may go without a review, before it stalls. */
const REVIEW_STALL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface ReviewQueueWork {
  status: string;
  createdAt: number;
  /** When the decision was indexed; unset while undecided or when only this device knows it. */
  reviewedAt?: number;
}

export interface ReviewQueueSummary {
  pendingCount: number;
  /** Pending work submitted a week ago or earlier. */
  waitingOverWeekCount: number;
  /** When the oldest pending work was submitted (ms); null when nothing waits. */
  oldestPendingAt: number | null;
  /** When the latest known review landed (ms); null when none is known. */
  lastReviewedAt: number | null;
  /**
   * A decision whose time is unknown: made on this device, restored from an
   * older cache, or beyond a work list that holds only the newest submissions.
   */
  hasUnknownReviewTimes: boolean;
  /**
   * Work has waited a week and no review landed in the last week. A garden that
   * never reviewed anything can stall; an unknown review time never does.
   */
  stalled: boolean;
  /**
   * Median time from submission to decision (ms) over the loaded decisions
   * with a known time. The list is the newest page, so this describes recent
   * review practice; unlike a stall, it claims nothing about older work.
   */
  medianReviewLatencyMs: number | null;
}

/**
 * How long review takes in a garden, and whether its queue has stalled. Pass
 * `complete: false` when `works` is only the newest page: a review of an older
 * submission may be missing, so the page cannot prove a stall.
 */
export function summarizeReviewQueue(
  works: ReviewQueueWork[],
  now: number = Date.now(),
  { complete = true }: { complete?: boolean } = {}
): ReviewQueueSummary {
  const pendingAt = works
    .filter((work) => work.status === "pending")
    .map((work) => toMs(work.createdAt));
  const decided = works.filter((work) => work.status === "approved" || work.status === "rejected");
  const timed = decided.flatMap((work) =>
    work.reviewedAt
      ? [{ submittedAt: toMs(work.createdAt), reviewedAt: toMs(work.reviewedAt) }]
      : []
  );

  const oldestPendingAt = pendingAt.length > 0 ? Math.min(...pendingAt) : null;
  const lastReviewedAt = timed.length > 0 ? Math.max(...timed.map((w) => w.reviewedAt)) : null;
  const hasUnknownReviewTimes = timed.length < decided.length || !complete;
  const waitedAWeek = oldestPendingAt !== null && now - oldestPendingAt >= REVIEW_STALL_WINDOW_MS;
  const reviewedThisWeek = lastReviewedAt !== null && now - lastReviewedAt < REVIEW_STALL_WINDOW_MS;

  return {
    pendingCount: pendingAt.length,
    waitingOverWeekCount: pendingAt.filter((at) => now - at >= REVIEW_STALL_WINDOW_MS).length,
    oldestPendingAt,
    lastReviewedAt,
    hasUnknownReviewTimes,
    stalled: waitedAWeek && !reviewedThisWeek && !hasUnknownReviewTimes,
    medianReviewLatencyMs:
      timed.length > 0
        ? getMedian(timed.map((w) => Math.max(0, w.reviewedAt - w.submittedAt)))
        : null,
  };
}

export function getSeverityRank(severity: TabBadgeSeverity): number {
  if (severity === "critical") return 2;
  if (severity === "warn") return 1;
  return 0;
}

export function aggregateBadges(badges: TabBadgeState[]): TabBadgeState {
  const nonNone = badges.filter((badge) => badge.severity !== "none");
  if (nonNone.length === 0) {
    return { severity: "none" };
  }

  const highestSeverity = nonNone.reduce<TabBadgeSeverity>((highest, badge) => {
    return getSeverityRank(badge.severity) > getSeverityRank(highest) ? badge.severity : highest;
  }, "none");

  const count = nonNone.reduce((total, badge) => total + (badge.count ?? 0), 0);

  return { severity: highestSeverity, count: count > 0 ? count : undefined };
}

export const RANGE_TO_MS: Record<GardenRange, number> = {
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

export const DOMAIN_LABEL_IDS: Record<Domain, string> = {
  [Domain.SOLAR]: "app.domain.tab.solar",
  [Domain.AGRO]: "app.domain.tab.agro",
  [Domain.EDU]: "app.domain.tab.education",
  [Domain.WASTE]: "app.domain.tab.waste",
};
