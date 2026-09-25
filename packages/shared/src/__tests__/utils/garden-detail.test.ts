import { describe, expect, it } from "vitest";
import { type ReviewQueueWork, summarizeReviewQueue } from "../../utils/garden-detail";

const NOW = Date.UTC(2026, 8, 25, 12);
const DAY_MS = 24 * 60 * 60 * 1000;
/** Indexer timestamps are seconds. */
const daysAgo = (days: number) => Math.floor((NOW - days * DAY_MS) / 1000);

const pending = (submittedDaysAgo: number): ReviewQueueWork => ({
  status: "pending",
  createdAt: daysAgo(submittedDaysAgo),
});
const decided = (submittedDaysAgo: number, reviewedDaysAgo?: number): ReviewQueueWork => ({
  status: "approved",
  createdAt: daysAgo(submittedDaysAgo),
  ...(reviewedDaysAgo === undefined ? {} : { reviewedAt: daysAgo(reviewedDaysAgo) }),
});

describe("summarizeReviewQueue", () => {
  it.each([
    [
      "nothing waits",
      [decided(3, 2)],
      { pendingCount: 0, waitingOverWeekCount: 0, stalled: false },
    ],
    [
      "recent work and a recent review",
      [pending(2), decided(4, 1)],
      { pendingCount: 1, waitingOverWeekCount: 0, stalled: false },
    ],
    [
      "work waited a week but a review landed this week",
      [pending(10), decided(4, 2)],
      { waitingOverWeekCount: 1, stalled: false },
    ],
    [
      "work waited a week and the last review is older",
      [pending(10), pending(3), decided(12, 9)],
      { pendingCount: 2, waitingOverWeekCount: 1, stalled: true },
    ],
    ["a garden that never reviewed anything", [pending(8)], { stalled: true }],
    [
      "a decision whose review time is unknown",
      [pending(10), decided(12)],
      { hasUnknownReviewTimes: true, stalled: false },
    ],
  ])("reads %s", (_case, works, expected) => {
    expect(summarizeReviewQueue(works, NOW)).toMatchObject(expected);
  });

  it("measures review time from submission to decision", () => {
    const summary = summarizeReviewQueue(
      [decided(10, 8), decided(6, 5), decided(20, 5), decided(3), pending(1)],
      NOW
    );

    // Two, one, and fifteen days; the decision with no known time is left out.
    expect(summary.medianReviewLatencyMs).toBe(2 * DAY_MS);
    expect(summary.oldestPendingAt).toBe(daysAgo(1) * 1000);
    expect(summary.lastReviewedAt).toBe(daysAgo(5) * 1000);
  });

  it("has no review time before anything was decided", () => {
    expect(summarizeReviewQueue([pending(1)], NOW).medianReviewLatencyMs).toBeNull();
  });
});
