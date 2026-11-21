import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveReviewRouteState } from "../../../hooks/admin-ui/review/review.workbenchModel";
import { useReviewWaitingBands } from "../../../hooks/admin-ui/review/useReviewWaitingBands";
import type { ReviewWaitingBand } from "../../../utils/garden-detail";
import { adminRoutes } from "../../../utils/navigation/admin-routes";
import { createMockWork } from "../../test-utils/mock-factories";

const NOW = Date.UTC(2026, 10, 21, 12);
const DAY_MS = 24 * 60 * 60 * 1000;
const sentDaysAgo = (days: number) => Math.floor((NOW - days * DAY_MS) / 1000);

const works = [
  createMockWork({ id: "fresh", createdAt: sentDaysAgo(1), status: "pending" }),
  createMockWork({ id: "week", createdAt: sentDaysAgo(9), status: "pending" }),
  createMockWork({ id: "old", createdAt: sentDaysAgo(30), status: "pending" }),
  createMockWork({ id: "old-approved", createdAt: sentDaysAgo(30), status: "approved" }),
];

function renderBands(waitingBand: ReviewWaitingBand | null, workScope: "pending" | "approved") {
  const updateSearch = vi.fn();
  const view = renderHook(() =>
    useReviewWaitingBands({
      works,
      workScope,
      workDay: null,
      waitingBand,
      reviewQueue: {
        waitingByBand: { under2d: 1, days2to7: 0, weeks1to2: 1, over2w: 1 },
        waitingByBandComplete: true,
      },
      updateSearch,
    })
  );
  return { result: view.result, updateSearch };
}

describe("Review's waiting-time chips", () => {
  afterEach(() => vi.useRealTimers());

  it("narrows the list to pending work of the chosen band", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    expect(renderBands("over2w", "pending").result.current.bandWorks.map((w) => w.id)).toEqual([
      "old",
    ]);
    expect(renderBands(null, "pending").result.current.bandWorks).toBe(works);
  });

  it("lists every band in order with its count", () => {
    expect(renderBands(null, "pending").result.current.waitingBands).toEqual([
      { id: "under2d", count: 1 },
      { id: "days2to7", count: 0 },
      { id: "weeks1to2", count: 1 },
      { id: "over2w", count: 1 },
    ]);
  });

  it("shows pending work for a chosen band, clears it when chosen again, and leaves it for Approved", () => {
    const fromApproved = renderBands(null, "approved");
    fromApproved.result.current.handleWaitingBandChange("weeks1to2");
    expect(fromApproved.updateSearch).toHaveBeenLastCalledWith({
      scope: undefined,
      waiting: "weeks1to2",
    });

    const chosen = renderBands("weeks1to2", "pending");
    chosen.result.current.handleWaitingBandChange("weeks1to2");
    expect(chosen.updateSearch).toHaveBeenLastCalledWith({ scope: undefined, waiting: undefined });
    chosen.result.current.handleWorkScopeChange("approved");
    expect(chosen.updateSearch).toHaveBeenLastCalledWith({ scope: "approved", waiting: undefined });
  });

  it("keeps the band in the URL for pending work only, and writes it into Review links", () => {
    const resolve = (scopeParam: string | null, dayParam: string | null) =>
      resolveReviewRouteState({
        pathname: "/review/work",
        sortParam: null,
        scopeParam,
        dayParam,
        waitingParam: "over2w",
        activeContentId: null,
      }).waitingBand;
    expect(resolve(null, null)).toBe("over2w");
    expect(resolve("approved", null)).toBeNull();
    expect(resolve(null, "2026-11-02")).toBeNull();
    expect(adminRoutes.reviewWork({ gardenId: "0xabc", waiting: "over2w" })).toContain(
      "waiting=over2w"
    );
  });
});
