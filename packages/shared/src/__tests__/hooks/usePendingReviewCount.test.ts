/**
 * usePendingReviewCount Hook Tests
 *
 * Pins the truth-gated readiness predicate that backs the arrival "review"/"operatorClear"
 * claims: ready only when the count (including count = 0) is backed by settled data, a
 * failed per-garden works fetch is NEVER ready, and the count excludes works already
 * reviewed by anyone plus the viewer's own submissions.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePendingReviewCount } from "../../hooks/work/usePendingReviewCount";
import type { Address } from "../../types/domain";

const VIEWER = "0xAbC0000000000000000000000000000000000001" as Address;
const OTHER = "0xDef0000000000000000000000000000000000002" as Address;
const GARDEN = "0x1111111111111111111111111111111111111111";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    gardens: { data: [] as Array<Record<string, unknown>>, isSuccess: true },
    reviewerWorks: {
      data: [] as Array<Record<string, unknown>>,
      failedGardenIds: [] as string[],
      isLoading: false,
      isFetching: false,
      isSuccess: true,
      isError: false,
      refetch: () => {},
    },
    fetchApprovals: vi.fn(async (_recipients: string[]): Promise<Array<{ workUID: string }>> => []),
  },
}));

vi.mock("../../hooks/blockchain/useBaseLists", () => ({
  useGardens: () => mocks.gardens,
}));
vi.mock("../../hooks/work/useReviewerWorks", () => ({
  useReviewerWorks: () => mocks.reviewerWorks,
}));
vi.mock("../../hooks/work/useAggregatedApprovals", () => ({
  fetchApprovalsByRecipients: (recipients: string[]) => mocks.fetchApprovals(recipients),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

function makeWork(id: string, gardenerAddress: string) {
  return { id, gardenerAddress };
}

describe("usePendingReviewCount", () => {
  beforeEach(() => {
    mocks.gardens = { data: [], isSuccess: true };
    mocks.reviewerWorks = {
      data: [],
      failedGardenIds: [],
      isLoading: false,
      isFetching: false,
      isSuccess: true,
      isError: false,
      refetch: () => {},
    };
    mocks.fetchApprovals = vi.fn(async () => []);
  });

  it("is vacuously ready with count 0 for a non-operator, without fetching approvals", () => {
    mocks.gardens = { data: [{ id: GARDEN, operators: [] }], isSuccess: true };
    const { result } = renderHook(() => usePendingReviewCount(VIEWER), { wrapper });
    expect(result.current).toEqual({ count: 0, ready: true, isOperator: false });
    expect(mocks.fetchApprovals).not.toHaveBeenCalled();
  });

  it("is ready with count 0 for an operator whose gardens have no works (no approvals fetch)", () => {
    mocks.gardens = { data: [{ id: GARDEN, operators: [VIEWER] }], isSuccess: true };
    const { result } = renderHook(() => usePendingReviewCount(VIEWER), { wrapper });
    expect(result.current).toEqual({ count: 0, ready: true, isOperator: true });
    expect(mocks.fetchApprovals).not.toHaveBeenCalled();
  });

  it("is NOT ready while the works query has not settled", () => {
    mocks.gardens = { data: [{ id: GARDEN, operators: [VIEWER] }], isSuccess: true };
    mocks.reviewerWorks = { ...mocks.reviewerWorks, isSuccess: false, isLoading: true };
    const { result } = renderHook(() => usePendingReviewCount(VIEWER), { wrapper });
    expect(result.current.ready).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("is NOT ready when any garden's works fetch failed — a swallowed outage never reads as all-clear", () => {
    mocks.gardens = { data: [{ id: GARDEN, operators: [VIEWER] }], isSuccess: true };
    mocks.reviewerWorks = {
      ...mocks.reviewerWorks,
      data: [makeWork("w1", OTHER)],
      failedGardenIds: [GARDEN],
      isSuccess: true,
    };
    const { result } = renderHook(() => usePendingReviewCount(VIEWER), { wrapper });
    expect(result.current.ready).toBe(false);
    expect(mocks.fetchApprovals).not.toHaveBeenCalled();
  });

  it("counts only works not reviewed by anyone and not self-authored, once approvals settle", async () => {
    mocks.gardens = { data: [{ id: GARDEN, operators: [VIEWER] }], isSuccess: true };
    mocks.reviewerWorks = {
      ...mocks.reviewerWorks,
      data: [
        makeWork("w-pending", OTHER), // needs review
        makeWork("w-approved", OTHER), // reviewed already → excluded
        makeWork("w-own", VIEWER), // viewer's own → excluded
      ],
      isSuccess: true,
    };
    mocks.fetchApprovals = vi.fn(async () => [{ workUID: "w-approved" }]);

    const { result } = renderHook(() => usePendingReviewCount(VIEWER), { wrapper });

    // Not ready until the approvals query settles — never a premature count.
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.count).toBe(1);

    // Recipients span both approval conventions: the garden AND the works' gardeners.
    const recipients = mocks.fetchApprovals.mock.calls[0][0].map((r: string) => r.toLowerCase());
    expect(recipients).toContain(GARDEN.toLowerCase());
    expect(recipients).toContain(OTHER.toLowerCase());
  });
});
