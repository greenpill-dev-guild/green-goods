/**
 * useTradeHistory Hook Tests
 * @vitest-environment jsdom
 *
 * Tests FractionPurchased event fetching for trade history display.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_CHAIN_ID = 11155111;

// ============================================
// Mocks
// ============================================

const mockGetTradeHistory = vi.fn();

vi.mock("../../../modules/data/marketplace", () => ({
  getTradeHistory: (...args: unknown[]) => mockGetTradeHistory(...args),
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../stores/useAdminStore", () => ({
  useAdminStore: (selector: (state: { selectedChainId: number }) => unknown) =>
    selector({ selectedChainId: 11155111 }),
}));

vi.mock("../../../config", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

import { useTradeHistory } from "../../../hooks/hypercerts/useTradeHistory";
import type { FractionTrade } from "../../../types/hypercerts";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

// ============================================
// Test Suite
// ============================================

describe("useTradeHistory", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
  });

  it("returns empty trades array initially", () => {
    const { result } = renderHook(() => useTradeHistory(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.trades).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("does not fetch when hypercertId is undefined", () => {
    renderHook(() => useTradeHistory(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockGetTradeHistory).not.toHaveBeenCalled();
  });

  it("fetches trade history for a hypercert", async () => {
    const mockTrades: FractionTrade[] = [
      {
        orderId: 1,
        hypercertId: 100n,
        recipient: "0x1111111111111111111111111111111111111111",
        units: 500n,
        payment: 5000n,
        currency: "0x2222222222222222222222222222222222222222",
        timestamp: Math.floor(Date.now() / 1000),
        txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      },
    ];
    mockGetTradeHistory.mockResolvedValue(mockTrades);

    const { result } = renderHook(() => useTradeHistory(100n), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.trades).toEqual(mockTrades);
    });

    expect(mockGetTradeHistory).toHaveBeenCalledWith(100n, TEST_CHAIN_ID);
  });

  it("handles fetch errors", async () => {
    mockGetTradeHistory.mockRejectedValue(new Error("Subgraph unavailable"));

    const { result } = renderHook(() => useTradeHistory(100n), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });

    expect(result.current.trades).toEqual([]);
  });

  it("provides a refetch function", async () => {
    mockGetTradeHistory.mockResolvedValue([]);

    const { result } = renderHook(() => useTradeHistory(100n), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.refetch).toBe("function");
  });

  it("handles bigint hypercertId in query key", async () => {
    mockGetTradeHistory.mockResolvedValue([]);

    const { result } = renderHook(() => useTradeHistory(999999999n), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetTradeHistory).toHaveBeenCalledWith(999999999n, TEST_CHAIN_ID);
  });
});
