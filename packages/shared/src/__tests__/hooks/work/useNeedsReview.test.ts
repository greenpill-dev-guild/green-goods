/**
 * useNeedsReview Hook Tests
 * @vitest-environment jsdom
 *
 * Pins how the review list is built from each garden's paged read: others'
 * pending work only, unknown statuses kept out, decisions made on this device
 * counted as reviewed at once, and a saved list kept while offline.
 */

import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { worksKeys } from "../../../config/query-keys/work";
import type { Address } from "../../../types/domain";
import type { EASWorkListRow } from "../../../types/eas-responses";

const CHAIN_ID = 42161;
const VIEWER = "0xabc0000000000000000000000000000000000001" as Address;
const OTHER = "0xdef0000000000000000000000000000000000002" as Address;
const GARDEN = "0x1111111111111111111111111111111111111111";

const mockReadWorkList = vi.fn();

vi.mock("../../../config/default-chain", () => ({ DEFAULT_CHAIN_ID: 42161 }));
vi.mock("../../../config/react-query", () => ({
  STALE_TIMES: { works: 15_000 },
  GC_TIMES: { works: 300_000 },
}));
vi.mock("../../../modules/work/work-list", () => ({
  WORK_LIST_PAGE_SIZE: 50,
  readWorkList: (...args: unknown[]) => mockReadWorkList(...args),
}));
vi.mock("../../../hooks/app/useOnlineStatus", () => ({
  reportConnectivityFailure: vi.fn(),
}));
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => "0xabc0000000000000000000000000000000000001",
}));

const { useNeedsReview } = await import("../../../hooks/work/useNeedsReview");

function row(
  id: string,
  gardenerAddress: Address,
  approval?: { approved: boolean } | null
): EASWorkListRow {
  const base = {
    id,
    title: id,
    actionUID: 1,
    gardenerAddress,
    gardenAddress: GARDEN,
    feedback: "",
    metadata: "{}",
    media: [],
    createdAt: 100,
  } as unknown as EASWorkListRow;
  return approval === undefined ? base : { ...base, approval: approval as never };
}

describe("hooks/work/useNeedsReview", () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    mockReadWorkList.mockReset();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    queryClient.clear();
  });

  it("lists pending work others submitted and leaves out your own and reviewed work", async () => {
    mockReadWorkList.mockResolvedValue([
      row("others-pending", OTHER, null),
      row("own-pending", VIEWER, null),
      row("approved", OTHER, { approved: true }),
    ]);

    const { result } = renderHook(() => useNeedsReview([GARDEN], VIEWER), { wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.works.map((work) => work.id)).toEqual(["others-pending"]);
    expect(result.current.decidedHere).toEqual([]);
    expect(result.current.allWorks.map((work) => work.id)).toContain("approved");
  });

  it("keeps a work whose status is unknown out of the list and does not claim a count", async () => {
    mockReadWorkList.mockResolvedValue([row("unread", OTHER)]);

    const { result } = renderHook(() => useNeedsReview([GARDEN], VIEWER), { wrapper });

    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.works).toEqual([]);
    expect(result.current.ready).toBe(false);
  });

  it("does not claim a count while a garden has more work than its loaded page", async () => {
    // The read returns one row past the 50-row window when older work exists.
    mockReadWorkList.mockResolvedValue(
      Array.from({ length: 51 }, (_, index) => row(`reviewed-${index}`, OTHER, { approved: true }))
    );

    const { result } = renderHook(() => useNeedsReview([GARDEN], VIEWER), { wrapper });

    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.works).toEqual([]);
    expect(result.current.ready).toBe(false);
  });

  it("counts a decision confirmed on this device as reviewed before the indexer reports it", async () => {
    mockReadWorkList.mockResolvedValue([row("decided", OTHER, null)]);
    queryClient.setQueryData(worksKeys.merged(GARDEN, CHAIN_ID), [
      { ...row("decided", OTHER), status: "approved", _isPending: false, _txHash: "0xabc" },
    ]);

    const { result } = renderHook(() => useNeedsReview([GARDEN], VIEWER), { wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.works).toEqual([]);
    expect(result.current.decidedHere.map((work) => [work.id, work.status])).toEqual([
      ["decided", "approved"],
    ]);
  });

  it("counts a decision queued offline as reviewed until its job syncs", async () => {
    mockReadWorkList.mockResolvedValue([row("queued", OTHER, null)]);
    queryClient.setQueryData(worksKeys.merged(GARDEN, CHAIN_ID), [
      { ...row("queued", OTHER), status: "rejected", _isPending: true },
    ]);

    const { result } = renderHook(() => useNeedsReview([GARDEN], VIEWER), { wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.works).toEqual([]);
    expect(result.current.decidedHere.map((work) => work.id)).toEqual(["queued"]);
  });

  it("keeps the saved list offline instead of reading, and never replaces it with an empty one", async () => {
    onlineManager.setOnline(false);
    queryClient.setQueryData(worksKeys.online(GARDEN, CHAIN_ID), [row("saved", OTHER, null)], {
      updatedAt: Date.now() - 60_000,
    });

    const { result } = renderHook(() => useNeedsReview([GARDEN], VIEWER), { wrapper });

    expect(result.current.works.map((work) => work.id)).toEqual(["saved"]);
    expect(result.current.savedAt).toBeGreaterThan(0);
    expect(mockReadWorkList).not.toHaveBeenCalled();
  });

  it("reports a failed refresh and keeps showing the last good read", async () => {
    mockReadWorkList.mockResolvedValueOnce([row("still-pending", OTHER, null)]);
    const { result } = renderHook(() => useNeedsReview([GARDEN], VIEWER), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    mockReadWorkList.mockRejectedValueOnce(new Error("indexer timeout"));
    let succeeded: boolean | undefined;
    await act(async () => {
      succeeded = await result.current.refetch();
    });

    expect(succeeded).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(false));
    expect(result.current.works.map((work) => work.id)).toEqual(["still-pending"]);
  });
});
