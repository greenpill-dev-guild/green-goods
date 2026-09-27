import { describe, expect, it } from "vitest";
import type { GardenReviewQueue, GardenWaitingWork } from "../../types/garden-detail";
import { type ReviewQueueWork, summarizeReviewQueue } from "../../utils/garden-detail";

const NOW = Date.UTC(2026, 8, 25, 12);
const DAY_MS = 24 * 60 * 60 * 1000;
/** Indexer timestamps are seconds. */
const daysAgo = (days: number) => Math.floor((NOW - days * DAY_MS) / 1000);

let rows = 0;
/** Each row is its own work unless a case names it. */
const nextId = () => `0x${(++rows).toString(16).padStart(64, "0")}`;

const pending = (submittedDaysAgo: number, id = nextId()): ReviewQueueWork => ({
  id,
  status: "pending",
  createdAt: daysAgo(submittedDaysAgo),
});
const decided = (
  submittedDaysAgo: number,
  reviewedDaysAgo?: number,
  id = nextId()
): ReviewQueueWork => ({
  id,
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

  it("cannot prove a stall from only the newest page of work", () => {
    // A review of an older submission may sit beyond the page.
    const works = [pending(10), decided(12, 9)];
    expect(summarizeReviewQueue(works, NOW).stalled).toBe(true);
    expect(summarizeReviewQueue(works, NOW, { complete: false })).toMatchObject({
      waitingOverWeekCount: 1,
      hasUnknownReviewTimes: true,
      stalled: false,
    });
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

describe("summarizeReviewQueue with the garden's whole queue", () => {
  const OLD = `0x${"a".repeat(64)}`;
  const waiting = (id: string, submittedDaysAgo: number): GardenWaitingWork => ({
    id,
    submittedAt: daysAgo(submittedDaysAgo),
  });
  const listed = (
    lastReviewedDaysAgo: number | null,
    ...works: GardenWaitingWork[]
  ): GardenReviewQueue => ({
    lastReviewedAt: lastReviewedDaysAgo === null ? null : daysAgo(lastReviewedDaysAgo),
    waiting: works,
  });
  /** A garden past the read's limit: floors from counts, not a list. */
  const counted = (
    lastReviewedDaysAgo: number,
    waitingAtLeast: number,
    waitingOverWeekAtLeast: number
  ): GardenReviewQueue => ({
    lastReviewedAt: daysAgo(lastReviewedDaysAgo),
    waiting: null,
    waitingAtLeast,
    waitingOverWeekAtLeast,
  });

  // Every page below holds only the garden's newest work: alone, it proves nothing.
  it.each([
    [
      "work waiting beyond the page, and no review anywhere this week",
      [pending(2), decided(12, 9)],
      listed(9, waiting(OLD, 30), waiting(nextId(), 2)),
      { pendingCount: 2, waitingOverWeekCount: 1, oldestPendingAt: daysAgo(30) * 1000 },
      true,
    ],
    [
      "a review beyond the page this week",
      [pending(2), decided(12, 9)],
      listed(3, waiting(OLD, 30)),
      { waitingOverWeekCount: 1, lastReviewedAt: daysAgo(3) * 1000 },
      false,
    ],
    [
      "a garden that never reviewed anything",
      [pending(2)],
      listed(null, waiting(OLD, 8)),
      { waitingOverWeekCount: 1, lastReviewedAt: null },
      true,
    ],
    [
      "work the page has decided since the garden was read",
      [decided(30, 1, OLD.toUpperCase().replace("0X", "0x"))],
      listed(9, waiting(OLD, 30)),
      { pendingCount: 0, waitingOverWeekCount: 0, lastReviewedAt: daysAgo(1) * 1000 },
      false,
    ],
    [
      "a decision only this device knows",
      [decided(30, undefined, OLD), pending(2)],
      listed(9, waiting(nextId(), 40)),
      { waitingOverWeekCount: 1, hasUnknownReviewTimes: true },
      false,
    ],
    [
      "past the read's limit, a floor of waiting work and no review this week",
      [pending(2), decided(12, 9)],
      counted(9, 5, 3),
      { pendingCount: 5, waitingOverWeekCount: 3 },
      true,
    ],
    [
      "past the read's limit, the page's own work that waited a week",
      [pending(10), decided(12, 9)],
      counted(9, 0, 0),
      { pendingCount: 1, waitingOverWeekCount: 1 },
      true,
    ],
    [
      "past the read's limit, a floor that proves nothing",
      [pending(2), decided(12, 9)],
      counted(9, 0, 0),
      { pendingCount: 1, waitingOverWeekCount: 0 },
      false,
    ],
  ])("reads %s", (_case, works, garden, expected, stalled) => {
    expect(summarizeReviewQueue(works, NOW, { complete: false, garden })).toMatchObject({
      ...expected,
      stalled,
    });
  });
});
