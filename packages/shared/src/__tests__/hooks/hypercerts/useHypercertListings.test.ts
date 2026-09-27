/**
 * useHypercertListings Hook Tests
 * @vitest-environment jsdom
 *
 * Tests marketplace order fetching, query key construction,
 * and loading/error state handling.
 */

import { type QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x1111111111111111111111111111111111111111" as const;

// ============================================
// Mocks
// ============================================

const mockGetRegisteredOrders = vi.fn();

vi.mock("../../../modules/data/marketplace", () => ({
  getRegisteredOrders: (...args: unknown[]) => mockGetRegisteredOrders(...args),
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

import { useHypercertListings } from "../../../hooks/hypercerts/useHypercertListings";
import type { RegisteredOrderView } from "../../../types/hypercerts";

// ============================================
// Test Suite
// ============================================

describe("useHypercertListings", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  it("returns empty listings array initially", () => {
    const { result } = renderHookWithQueryClient(() => useHypercertListings(undefined), {
      queryClient,
    });

    expect(result.current.listings).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("does not fetch when gardenAddress is undefined", () => {
    renderHookWithQueryClient(() => useHypercertListings(undefined), {
      queryClient,
    });

    expect(mockGetRegisteredOrders).not.toHaveBeenCalled();
  });

  it("fetches orders when gardenAddress is provided", async () => {
    const mockOrders: RegisteredOrderView[] = [
      {
        orderId: 1,
        hypercertId: 100n,
        seller: TEST_GARDEN,
        currency: "0x2222222222222222222222222222222222222222",
        pricePerUnit: 1000n,
        minUnitAmount: 1n,
        maxUnitAmount: 1000n,
        endTime: Math.floor(Date.now() / 1000) + 86400,
        active: true,
      },
    ];
    mockGetRegisteredOrders.mockResolvedValue(mockOrders);

    const { result } = renderHookWithQueryClient(() => useHypercertListings(TEST_GARDEN), {
      queryClient,
    });

    await waitFor(() => {
      expect(result.current.listings).toEqual(mockOrders);
    });

    expect(mockGetRegisteredOrders).toHaveBeenCalledWith(TEST_GARDEN, TEST_CHAIN_ID);
  });

  it("handles fetch errors", async () => {
    mockGetRegisteredOrders.mockRejectedValue(new Error("RPC error"));

    const { result } = renderHookWithQueryClient(() => useHypercertListings(TEST_GARDEN), {
      queryClient,
    });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });

    expect(result.current.listings).toEqual([]);
  });

  it("provides a refetch function", async () => {
    mockGetRegisteredOrders.mockResolvedValue([]);

    const { result } = renderHookWithQueryClient(() => useHypercertListings(TEST_GARDEN), {
      queryClient,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.refetch).toBe("function");
  });
});
