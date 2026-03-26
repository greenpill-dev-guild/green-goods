/**
 * useProtocolYieldSummary Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { act, createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_CHAIN_ID = 11155111;

const mockGetAllYieldAllocations = vi.fn();

vi.mock("../../../modules/data/yield-allocations", () => ({
  getAllYieldAllocations: (...args: unknown[]) => mockGetAllYieldAllocations(...args),
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => TEST_CHAIN_ID,
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const { useProtocolYieldSummary } = await import("../../../hooks/yield/useProtocolYieldSummary");

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

describe("useProtocolYieldSummary", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("stays loading until the first summary fetch resolves", async () => {
    const deferred =
      createDeferredPromise<
        Array<{
          gardenAddress: `0x${string}`;
          assetAddress: `0x${string}`;
          cookieJarAmount: bigint;
          fractionsAmount: bigint;
          juiceboxAmount: bigint;
          totalAmount: bigint;
          timestamp: number;
          txHash: string;
        }>
      >();

    mockGetAllYieldAllocations.mockReturnValueOnce(deferred.promise);

    const { result } = renderHook(() => useProtocolYieldSummary(), {
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
          gardenAddress: "0x1111111111111111111111111111111111111111",
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
});
