/**
 * useProtocolYieldSummary Tests
 * @vitest-environment happy-dom
 */

import { type QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

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
    queryClient = createTestQueryClient();
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

    const { result } = renderHookWithQueryClient(() => useProtocolYieldSummary(), {
      queryClient,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.summary).toEqual({
      totalYield: 0n,
      totalCookieJar: 0n,
      totalFractions: 0n,
      totalJuicebox: 0n,
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
    expect(result.current.summary).toEqual({
      totalYield: 600n,
      totalCookieJar: 100n,
      totalFractions: 200n,
      totalJuicebox: 300n,
      allocationCount: 1,
    });
  });
});
