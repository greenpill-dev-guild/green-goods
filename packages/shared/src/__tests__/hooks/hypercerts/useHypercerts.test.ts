/**
 * useHypercerts Hook Tests
 * @vitest-environment jsdom
 *
 * Tests multi-source fallback fetching, optimistic data handling,
 * sync status transitions, and list/detail query modes.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mocks
// ============================================

const mockGetGardenHypercerts = vi.fn();
const mockGetHypercertById = vi.fn();
const mockGetHypercertFromSdkApi = vi.fn();
const mockHydrateHypercertMetadata = vi.fn();
const mockHydrateHypercertRecords = vi.fn();
const TEST_CHAIN_ID = 11155111;

vi.mock("../../../modules/data/hypercerts", () => ({
  getGardenHypercerts: (...args: unknown[]) => mockGetGardenHypercerts(...args),
  getHypercertById: (...args: unknown[]) => mockGetHypercertById(...args),
  getHypercertFromSdkApi: (...args: unknown[]) => mockGetHypercertFromSdkApi(...args),
  hydrateHypercertMetadata: (...args: unknown[]) => mockHydrateHypercertMetadata(...args),
  hydrateHypercertRecords: (...args: unknown[]) => mockHydrateHypercertRecords(...args),
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../utils/errors/validation-error", () => ({
  ValidationError: class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ValidationError";
    }
  },
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => TEST_CHAIN_ID,
}));

import {
  type OptimisticHypercertData,
  useHypercerts,
} from "../../../hooks/hypercerts/useHypercerts";
import { createMockHypercertRecord, MOCK_ADDRESSES } from "../../test-utils/mock-factories";

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

describe("useHypercerts", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mockGetGardenHypercerts.mockResolvedValue([]);
    mockGetHypercertById.mockResolvedValue(null);
    mockGetHypercertFromSdkApi.mockResolvedValue(null);
    mockHydrateHypercertMetadata.mockResolvedValue({});
    mockHydrateHypercertRecords.mockResolvedValue({});
  });

  // ============================================
  // Default state
  // ============================================

  describe("default state", () => {
    it("returns empty arrays and null when no params", () => {
      const { result } = renderHook(() => useHypercerts(), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.hypercerts).toEqual([]);
      expect(result.current.hypercert).toBeNull();
      expect(result.current.hasError).toBe(false);
      expect(result.current.syncStatus).toBe("synced");
    });
  });

  // ============================================
  // List mode (gardenId, no hypercertId)
  // ============================================

  describe("list mode", () => {
    it("fetches hypercerts for a garden", async () => {
      const mockRecords = [
        createMockHypercertRecord({ id: "hc-1" }),
        createMockHypercertRecord({ id: "hc-2" }),
      ];
      mockGetGardenHypercerts.mockResolvedValue(mockRecords);

      const { result } = renderHook(() => useHypercerts({ gardenId: MOCK_ADDRESSES.garden }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.hypercerts).toHaveLength(2);
      });

      expect(mockGetGardenHypercerts).toHaveBeenCalledWith(
        MOCK_ADDRESSES.garden,
        TEST_CHAIN_ID,
        undefined
      );
    });

    it("passes status filter to query function", async () => {
      mockGetGardenHypercerts.mockResolvedValue([]);

      renderHook(() => useHypercerts({ gardenId: MOCK_ADDRESSES.garden, status: "active" }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockGetGardenHypercerts).toHaveBeenCalledWith(
          MOCK_ADDRESSES.garden,
          TEST_CHAIN_ID,
          "active"
        );
      });
    });

    it("does not fetch when gardenId is missing", () => {
      renderHook(() => useHypercerts({}), {
        wrapper: createWrapper(queryClient),
      });

      expect(mockGetGardenHypercerts).not.toHaveBeenCalled();
    });

    it("handles fetch errors", async () => {
      mockGetGardenHypercerts.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useHypercerts({ gardenId: MOCK_ADDRESSES.garden }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.hasError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  // ============================================
  // Detail mode (hypercertId)
  // ============================================

  describe("detail mode", () => {
    it("fetches a single hypercert by ID with Envio fallback", async () => {
      const record = createMockHypercertRecord({ id: "hc-detail" });
      mockGetHypercertById.mockResolvedValue(record);

      const { result } = renderHook(() => useHypercerts({ hypercertId: "hc-detail" }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.hypercert).not.toBeNull();
      });

      expect(result.current.hypercert?.id).toBe("hc-detail");
      expect(mockGetHypercertById).toHaveBeenCalledWith("hc-detail");
    });

    it("falls back to SDK API when Envio returns null", async () => {
      mockGetHypercertById.mockResolvedValue(null);
      mockGetHypercertFromSdkApi.mockResolvedValue({
        id: "hc-sdk",
        tokenId: 1n,
        title: "SDK Hypercert",
        description: "From SDK",
        workScopes: ["gardening"],
        status: "active",
      });

      const { result } = renderHook(() => useHypercerts({ hypercertId: "hc-sdk" }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.hypercert).not.toBeNull();
      });

      expect(result.current.hypercert?.title).toBe("SDK Hypercert");
    });

    it("returns null when both sources fail", async () => {
      mockGetHypercertById.mockResolvedValue(null);
      mockGetHypercertFromSdkApi.mockResolvedValue(null);

      const { result } = renderHook(() => useHypercerts({ hypercertId: "nonexistent" }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hypercert).toBeNull();
    });

    it("does not run list query when hypercertId is set", () => {
      renderHook(
        () =>
          useHypercerts({
            gardenId: MOCK_ADDRESSES.garden,
            hypercertId: "hc-1",
          }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(mockGetGardenHypercerts).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Optimistic data & sync status
  // ============================================

  describe("optimistic data", () => {
    const optimisticData: OptimisticHypercertData = {
      id: "hc-optimistic",
      title: "Optimistic Cert",
      description: "Created just now",
      workScopes: ["gardening"],
      attestationCount: 3,
      mintedAt: Math.floor(Date.now() / 1000),
      txHash: "0xabc123" as `0x${string}`,
    };

    it("shows optimistic data immediately as fallback", () => {
      mockGetHypercertById.mockResolvedValue(null);
      mockGetHypercertFromSdkApi.mockResolvedValue(null);

      const { result } = renderHook(
        () =>
          useHypercerts({
            hypercertId: "hc-optimistic",
            optimisticData,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      // Should show optimistic data immediately without waiting
      expect(result.current.hypercert).not.toBeNull();
      expect(result.current.hypercert?.title).toBe("Optimistic Cert");
      // Initial sync status may be "syncing" or "optimistic" depending on query resolution timing
      expect(["syncing", "optimistic"]).toContain(result.current.syncStatus);
    });

    it("does not show loading state when optimistic data is available", () => {
      const { result } = renderHook(
        () =>
          useHypercerts({
            hypercertId: "hc-optimistic",
            optimisticData,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isLoading).toBe(false);
    });

    it("transitions to synced when real data arrives", async () => {
      const realRecord = createMockHypercertRecord({
        id: "hc-optimistic",
        title: "Real Indexed Cert",
      });
      mockGetHypercertById.mockResolvedValue(realRecord);

      const { result } = renderHook(
        () =>
          useHypercerts({
            hypercertId: "hc-optimistic",
            optimisticData,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.syncStatus).toBe("synced");
      });

      // Real data should replace optimistic
      expect(result.current.hypercert?.title).toBe("Real Indexed Cert");
    });
  });

  // ============================================
  // refetch
  // ============================================

  describe("refetch", () => {
    it("provides a refetch function", async () => {
      mockGetGardenHypercerts.mockResolvedValue([]);

      const { result } = renderHook(() => useHypercerts({ gardenId: MOCK_ADDRESSES.garden }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe("function");
    });
  });
});
