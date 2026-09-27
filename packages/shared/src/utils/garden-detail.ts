import type {
  GardenDetailTab,
  GardenRange,
  GardenReviewQueue,
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
export const REVIEW_STALL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface ReviewQueueWork {
  id: string;
  status: string;
  createdAt: number;
  /** When the decision was indexed; unset while undecided or when only this device knows it. */
  reviewedAt?: number;
}

export interface ReviewQueueSummary {
  /** Work waiting for a review, garden-wide when the garden's own queue was read. */
  pendingCount: number;
  /** Pending work submitted a week ago or earlier. */
  waitingOverWeekCount: number;
  /** When the oldest known pending work was submitted (ms); null when none is known. */
  oldestPendingAt: number | null;
  /** When the latest known review landed (ms); null when none is known. */
  lastReviewedAt: number | null;
  /**
   * A decision whose time is unknown: made on this device, restored from an
   * older cache, or beyond a work list that holds only the newest submissions
   * when the garden's own queue was not read.
   */
  hasUnknownReviewTimes: boolean;
  /**
   * Work has waited a week and no review landed in the last week. A garden that
   * never reviewed anything can stall; an unknown review time never does. Past
   * the garden read's limit the waiting count is a floor, and a stall the floor
   * cannot prove is not reported.
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
 * submission may be missing, so the page alone cannot prove a stall. `garden`
 * carries the garden's whole queue for exactly that case.
 */
export function summarizeReviewQueue(
  works: ReviewQueueWork[],
  now: number = Date.now(),
  {
    complete = true,
    garden,
  }: {
    complete?: boolean;
    /**
     * The garden's whole queue, read this session. It speaks for the history the
     * rows do not hold: the rows add only their decisions to its list, but past
     * its limit their own waiting work counts beside its floor, so pass a floor
     * only beside rows whose statuses are current.
     */
    garden?: GardenReviewQueue;
  } = {}
): ReviewQueueSummary {
  const decided = works.filter((work) => work.status === "approved" || work.status === "rejected");
  const timed = decided.flatMap((work) =>
    work.reviewedAt
      ? [{ submittedAt: toMs(work.createdAt), reviewedAt: toMs(work.reviewedAt) }]
      : []
  );
  // A decision the rows know settles its work before the garden's read indexes it.
  const decidedIds = new Set(decided.map((work) => work.id.toLowerCase()));
  const pendingAt = garden?.waiting
    ? garden.waiting
        .filter((work) => !decidedIds.has(work.id.toLowerCase()))
        .map((work) => toMs(work.submittedAt))
    : works.filter((work) => work.status === "pending").map((work) => toMs(work.createdAt));
  // Past the read's limit the garden's waiting work is a floor beside the rows' own.
  const floor = garden?.waiting === null ? garden : undefined;
  const reviewTimes = timed.map((work) => work.reviewedAt);
  if (garden && garden.lastReviewedAt !== null) reviewTimes.push(toMs(garden.lastReviewedAt));

  const lastReviewedAt = reviewTimes.length > 0 ? Math.max(...reviewTimes) : null;
  const waitingOverWeekCount = Math.max(
    pendingAt.filter((at) => now - at >= REVIEW_STALL_WINDOW_MS).length,
    floor?.waitingOverWeekAtLeast ?? 0
  );
  const hasUnknownReviewTimes = timed.length < decided.length || (!garden && !complete);
  const reviewedThisWeek = lastReviewedAt !== null && now - lastReviewedAt < REVIEW_STALL_WINDOW_MS;

  return {
    pendingCount: Math.max(pendingAt.length, floor?.waitingAtLeast ?? 0),
    waitingOverWeekCount,
    oldestPendingAt: pendingAt.length > 0 ? Math.min(...pendingAt) : null,
    lastReviewedAt,
    hasUnknownReviewTimes,
    stalled: waitingOverWeekCount > 0 && !reviewedThisWeek && !hasUnknownReviewTimes,
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
