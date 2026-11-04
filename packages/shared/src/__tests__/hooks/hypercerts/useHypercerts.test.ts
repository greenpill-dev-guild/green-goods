/**
 * useHypercerts Hook Tests
 * @vitest-environment happy-dom
 *
 * Tests multi-source fallback fetching, optimistic data handling,
 * sync status transitions, and list/detail query modes.
 */

import { type QueryClient } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

// ============================================
// Mocks
// ============================================

const mockGetGardenHypercerts = vi.fn();
const mockGetHypercertById = vi.fn();
const mockGetHypercertFromSdkApi = vi.fn();
const mockHydrateHypercertMetadata = vi.fn();
const mockHydrateHypercertRecords = vi.fn();
const TEST_CHAIN_ID = 11155111;
/** The page a garden list reads at a time. */
const PAGE = 50;

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

// ============================================
// Test Suite
// ============================================

describe("useHypercerts", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
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
      const { result } = renderHookWithQueryClient(() => useHypercerts(), {
        queryClient,
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

      const { result } = renderHookWithQueryClient(
        () => useHypercerts({ gardenId: MOCK_ADDRESSES.garden }),
        {
          queryClient,
        }
      );

      await waitFor(() => {
        expect(result.current.hypercerts).toHaveLength(2);
      });

      // One row past the page tells whether the garden has more.
      expect(mockGetGardenHypercerts).toHaveBeenCalledWith(
        MOCK_ADDRESSES.garden,
        TEST_CHAIN_ID,
        undefined,
        PAGE + 1
      );
      expect(result.current.hasOlder).toBe(false);
    });

    // A status narrows what is shown, not the read: a row past the page of
    // another status still means the garden has more.
    it("shows only the asked status, reading every status for the page", async () => {
      mockGetGardenHypercerts.mockResolvedValue([
        createMockHypercertRecord({ id: "hc-active", status: "active" }),
        createMockHypercertRecord({ id: "hc-claimed", status: "claimed" }),
      ]);

      const { result } = renderHookWithQueryClient(
        () => useHypercerts({ gardenId: MOCK_ADDRESSES.garden, status: "active" }),
        {
          queryClient,
        }
      );

      await waitFor(() => {
        expect(result.current.hypercerts.map((record) => record.id)).toEqual(["hc-active"]);
      });
      expect(mockGetGardenHypercerts).toHaveBeenCalledWith(
        MOCK_ADDRESSES.garden,
        TEST_CHAIN_ID,
        undefined,
        PAGE + 1
      );
    });

    it("does not fetch when gardenId is missing", () => {
      renderHookWithQueryClient(() => useHypercerts({}), {
        queryClient,
      });

      expect(mockGetGardenHypercerts).not.toHaveBeenCalled();
    });

    it("handles fetch errors", async () => {
      mockGetGardenHypercerts.mockRejectedValue(new Error("Network error"));

      const { result } = renderHookWithQueryClient(
        () => useHypercerts({ gardenId: MOCK_ADDRESSES.garden }),
        {
          queryClient,
        }
      );

      await waitFor(() => {
        expect(result.current.hasError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  // ============================================
  // Older hypercerts (PRD-1086)
  // ============================================

  describe("older hypercerts", () => {
    /** A garden with 120 hypercerts, newest first, read the way the indexer limits a list. */
    const minted = Array.from({ length: 120 }, (_, index) =>
      createMockHypercertRecord({ id: `hc-${index}`, mintedAt: 1_700_000_000 - index })
    );

    beforeEach(() => {
      mockGetGardenHypercerts.mockImplementation(
        async (_garden: string, _chain: number, _status: unknown, limit: number) =>
          minted.slice(0, limit)
      );
    });

    it("reaches every hypercert of a garden with more than a page, one page per request", async () => {
      const { result } = renderHookWithQueryClient(
        () => useHypercerts({ gardenId: MOCK_ADDRESSES.garden }),
        { queryClient }
      );

      await waitFor(() => expect(result.current.hypercerts).toHaveLength(PAGE));
      expect(result.current.hasOlder).toBe(true);
      // The row read past the page is never shown, so it is never hydrated either.
      expect(mockHydrateHypercertRecords).toHaveBeenLastCalledWith(
        minted.slice(0, PAGE),
        TEST_CHAIN_ID
      );

      act(() => result.current.loadOlder());
      await waitFor(() => expect(result.current.hypercerts).toHaveLength(2 * PAGE));
      expect(result.current.hasOlder).toBe(true);

      act(() => result.current.loadOlder());
      await waitFor(() => expect(result.current.hypercerts).toHaveLength(120));
      expect(result.current.hasOlder).toBe(false);
      expect(result.current.hypercerts.at(-1)?.id).toBe("hc-119");
      expect(mockGetGardenHypercerts).toHaveBeenLastCalledWith(
        MOCK_ADDRESSES.garden,
        TEST_CHAIN_ID,
        undefined,
        3 * PAGE + 1
      );
    });

    it("keeps one window for every screen that lists the same garden", async () => {
      const first = renderHookWithQueryClient(
        () => useHypercerts({ gardenId: MOCK_ADDRESSES.garden }),
        { queryClient }
      );
      await waitFor(() => expect(first.result.current.hypercerts).toHaveLength(PAGE));
      act(() => first.result.current.loadOlder());
      await waitFor(() => expect(first.result.current.hypercerts).toHaveLength(2 * PAGE));

      // A second screen opened later reads the garden as widely as the first.
      const second = renderHookWithQueryClient(
        () => useHypercerts({ gardenId: MOCK_ADDRESSES.garden }),
        { queryClient }
      );
      expect(second.result.current.hypercerts).toHaveLength(2 * PAGE);
      expect(second.result.current.hasOlder).toBe(true);
    });
  });

  // ============================================
  // Detail mode (hypercertId)
  // ============================================

  describe("detail mode", () => {
    it("fetches a single hypercert by ID with Envio fallback", async () => {
      const record = createMockHypercertRecord({ id: "hc-detail" });
      mockGetHypercertById.mockResolvedValue(record);

      const { result } = renderHookWithQueryClient(
        () => useHypercerts({ hypercertId: "hc-detail" }),
        {
          queryClient,
        }
      );

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

      const { result } = renderHookWithQueryClient(() => useHypercerts({ hypercertId: "hc-sdk" }), {
        queryClient,
      });

      await waitFor(() => {
        expect(result.current.hypercert).not.toBeNull();
      });

      expect(result.current.hypercert?.title).toBe("SDK Hypercert");
    });

    it("returns null when both sources fail", async () => {
      mockGetHypercertById.mockResolvedValue(null);
      mockGetHypercertFromSdkApi.mockResolvedValue(null);

      const { result } = renderHookWithQueryClient(
        () => useHypercerts({ hypercertId: "nonexistent" }),
        {
          queryClient,
        }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hypercert).toBeNull();
    });

    it("does not run list query when hypercertId is set", () => {
      renderHookWithQueryClient(
        () =>
          useHypercerts({
            gardenId: MOCK_ADDRESSES.garden,
            hypercertId: "hc-1",
          }),
        { queryClient }
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

      const { result } = renderHookWithQueryClient(
        () =>
          useHypercerts({
            hypercertId: "hc-optimistic",
            optimisticData,
          }),
        { queryClient }
      );

      // Should show optimistic data immediately without waiting
      expect(result.current.hypercert).not.toBeNull();
      expect(result.current.hypercert?.title).toBe("Optimistic Cert");
      // Initial sync status may be "syncing" or "optimistic" depending on query resolution timing
      expect(["syncing", "optimistic"]).toContain(result.current.syncStatus);
    });

    it("does not show loading state when optimistic data is available", () => {
      const { result } = renderHookWithQueryClient(
        () =>
          useHypercerts({
            hypercertId: "hc-optimistic",
            optimisticData,
          }),
        { queryClient }
      );

      expect(result.current.isLoading).toBe(false);
    });

    it("transitions to synced when real data arrives", async () => {
      const realRecord = createMockHypercertRecord({
        id: "hc-optimistic",
        title: "Real Indexed Cert",
      });
      mockGetHypercertById.mockResolvedValue(realRecord);

      const { result } = renderHookWithQueryClient(
        () =>
          useHypercerts({
            hypercertId: "hc-optimistic",
            optimisticData,
          }),
        { queryClient }
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

      const { result } = renderHookWithQueryClient(
        () => useHypercerts({ gardenId: MOCK_ADDRESSES.garden }),
        {
          queryClient,
        }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe("function");
    });
  });
});
