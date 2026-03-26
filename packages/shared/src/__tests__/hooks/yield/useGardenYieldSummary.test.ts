/**
 * useGardenYieldSummary Tests
 * @vitest-environment jsdom
 *
 * Tests the garden-scoped yield summary hook that fetches ALL yield allocations
 * (no limit) and aggregates them client-side. Verifies the bug fix for
 * Community tab undercounting yield after 20 allocation events.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { act, createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x3333333333333333333333333333333333333333";

// --- Mocks ---

const mockGetGardenYieldAllocations = vi.fn();

vi.mock("../../../modules/data/yield-allocations", () => ({
  getGardenYieldAllocations: (...args: unknown[]) => mockGetGardenYieldAllocations(...args),
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => TEST_CHAIN_ID,
}));

vi.mock("../../../utils/blockchain/address", () => ({
  normalizeAddress: (addr: string) => addr.toLowerCase(),
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Dynamic import after mocks
const { useGardenYieldSummary } = await import("../../../hooks/yield/useGardenYieldSummary");

import type { Address } from "../../../types/domain";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe("useGardenYieldSummary", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("returns empty summary when garden address is undefined", () => {
    const { result } = renderHook(() => useGardenYieldSummary(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockGetGardenYieldAllocations).not.toHaveBeenCalled();
    expect(result.current.summary).toEqual({
      assets: [],
      allocationCount: 0,
    });
  });

  it("fetches all allocations and aggregates totals", async () => {
    mockGetGardenYieldAllocations.mockResolvedValueOnce([
      {
        gardenAddress: TEST_GARDEN,
        assetAddress: "0x4444444444444444444444444444444444444444",
        cookieJarAmount: 1000000000000000000n,
        fractionsAmount: 2000000000000000000n,
        juiceboxAmount: 3000000000000000000n,
        totalAmount: 6000000000000000000n,
        timestamp: 1700000000,
        txHash: "0xabc123",
      },
      {
        gardenAddress: TEST_GARDEN,
        assetAddress: "0x4444444444444444444444444444444444444444",
        cookieJarAmount: 500000000000000000n,
        fractionsAmount: 500000000000000000n,
        juiceboxAmount: 500000000000000000n,
        totalAmount: 1500000000000000000n,
        timestamp: 1700000100,
        txHash: "0xdef456",
      },
    ]);

    const { result } = renderHook(() => useGardenYieldSummary(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.summary.allocationCount).toBe(2));

    expect(result.current.summary).toEqual({
      assets: [
        {
          assetAddress: "0x4444444444444444444444444444444444444444",
          totalYield: 7500000000000000000n,
          totalCookieJar: 1500000000000000000n,
          totalFractions: 2500000000000000000n,
          totalJuicebox: 3500000000000000000n,
          allocationCount: 2,
        },
      ],
      allocationCount: 2,
    });
  });

  it("stays loading until the first summary fetch resolves", async () => {
    const deferred =
      createDeferredPromise<
        Array<{
          gardenAddress: string;
          assetAddress: string;
          cookieJarAmount: bigint;
          fractionsAmount: bigint;
          juiceboxAmount: bigint;
          totalAmount: bigint;
          timestamp: number;
          txHash: string;
        }>
      >();

    mockGetGardenYieldAllocations.mockReturnValueOnce(deferred.promise);

    const { result } = renderHook(() => useGardenYieldSummary(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.summary).toEqual({
      assets: [],
      allocationCount: 0,
    });

    await act(async () => {
      deferred.resolve([
        {
          gardenAddress: TEST_GARDEN,
          assetAddress: "0x4444444444444444444444444444444444444444",
          cookieJarAmount: 100n,
          fractionsAmount: 200n,
          juiceboxAmount: 300n,
          totalAmount: 600n,
          timestamp: 1700000000,
          txHash: "0xabc123",
        },
      ]);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.summary.assets).toEqual([
      {
        assetAddress: "0x4444444444444444444444444444444444444444",
        totalYield: 600n,
        totalCookieJar: 100n,
        totalFractions: 200n,
        totalJuicebox: 300n,
        allocationCount: 1,
      },
    ]);
  });

  it("preserves asset boundaries when a garden allocates multiple assets", async () => {
    mockGetGardenYieldAllocations.mockResolvedValueOnce([
      {
        gardenAddress: TEST_GARDEN,
        assetAddress: "0x4444444444444444444444444444444444444444",
        cookieJarAmount: 100n,
        fractionsAmount: 200n,
        juiceboxAmount: 300n,
        totalAmount: 600n,
        timestamp: 1700000000,
        txHash: "0xabc123",
      },
      {
        gardenAddress: TEST_GARDEN,
        assetAddress: "0x5555555555555555555555555555555555555555",
        cookieJarAmount: 10n,
        fractionsAmount: 20n,
        juiceboxAmount: 30n,
        totalAmount: 60n,
        timestamp: 1700000001,
        txHash: "0xdef456",
      },
    ]);

    const { result } = renderHook(() => useGardenYieldSummary(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.summary.allocationCount).toBe(2));

    expect(result.current.summary.assets).toEqual([
      {
        assetAddress: "0x4444444444444444444444444444444444444444",
        totalYield: 600n,
        totalCookieJar: 100n,
        totalFractions: 200n,
        totalJuicebox: 300n,
        allocationCount: 1,
      },
      {
        assetAddress: "0x5555555555555555555555555555555555555555",
        totalYield: 60n,
        totalCookieJar: 10n,
        totalFractions: 20n,
        totalJuicebox: 30n,
        allocationCount: 1,
      },
    ]);
  });

  it("passes normalized garden address and chain ID to data function", async () => {
    const mixedCaseGarden = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
    mockGetGardenYieldAllocations.mockResolvedValueOnce([]);

    renderHook(() => useGardenYieldSummary(mixedCaseGarden as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(mockGetGardenYieldAllocations).toHaveBeenCalled());

    expect(mockGetGardenYieldAllocations).toHaveBeenCalledWith(
      mixedCaseGarden.toLowerCase(),
      TEST_CHAIN_ID
    );
  });

  it("respects enabled: false option", () => {
    renderHook(() => useGardenYieldSummary(TEST_GARDEN as Address, { enabled: false }), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockGetGardenYieldAllocations).not.toHaveBeenCalled();
  });

  it("returns empty summary when data function returns empty array", async () => {
    mockGetGardenYieldAllocations.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useGardenYieldSummary(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.summary).toEqual({
      assets: [],
      allocationCount: 0,
    });
  });

  it("propagates error from data function", async () => {
    mockGetGardenYieldAllocations.mockRejectedValueOnce(new Error("Indexer down"));

    const { result } = renderHook(() => useGardenYieldSummary(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.summary).toEqual({
      assets: [],
      allocationCount: 0,
    });
  });

  it("handles many allocations (the >20 bug scenario)", async () => {
    // Generate 25 allocations to reproduce the bug where only 20 were fetched
    const allocations = Array.from({ length: 25 }, (_, i) => ({
      gardenAddress: TEST_GARDEN,
      assetAddress: "0x4444444444444444444444444444444444444444",
      cookieJarAmount: 100000000000000000n,
      fractionsAmount: 200000000000000000n,
      juiceboxAmount: 300000000000000000n,
      totalAmount: 600000000000000000n,
      timestamp: 1700000000 + i,
      txHash: `0x${i.toString(16).padStart(64, "0")}`,
    }));

    mockGetGardenYieldAllocations.mockResolvedValueOnce(allocations);

    const { result } = renderHook(() => useGardenYieldSummary(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.summary.allocationCount).toBe(25));

    expect(result.current.summary.assets).toEqual([
      {
        assetAddress: "0x4444444444444444444444444444444444444444",
        totalYield: 15000000000000000000n,
        totalCookieJar: 2500000000000000000n,
        totalFractions: 5000000000000000000n,
        totalJuicebox: 7500000000000000000n,
        allocationCount: 25,
      },
    ]);
  });

  it("uses correct query key with garden address and chain ID", async () => {
    mockGetGardenYieldAllocations.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useGardenYieldSummary(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The query cache should contain a key with the garden address and chain ID
    const cacheEntries = queryClient.getQueryCache().getAll();
    const yieldSummaryEntry = cacheEntries.find(
      (entry) =>
        Array.isArray(entry.queryKey) &&
        entry.queryKey.includes("gardenSummary") &&
        entry.queryKey.includes(TEST_GARDEN) &&
        entry.queryKey.includes(TEST_CHAIN_ID)
    );
    expect(yieldSummaryEntry).toBeDefined();
  });
});
