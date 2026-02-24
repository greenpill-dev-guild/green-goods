/**
 * useBaseLists Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the factory-generated hooks: useActions, useGardens, useGardeners.
 * These are created by createBaseListHook, which wires up TanStack Query
 * with proper caching, stale times, and placeholder data.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAction, createMockGarden } from "../../test-utils/mock-factories";

// ============================================
// Mocks
// ============================================

const mockGetActions = vi.fn();
const mockGetGardens = vi.fn();
const mockGetGardeners = vi.fn();

vi.mock("../../../modules/data/greengoods", () => ({
  getActions: () => mockGetActions(),
  getGardens: () => mockGetGardens(),
  getGardeners: () => mockGetGardeners(),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("wagmi", () => ({
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));

vi.mock("../../../config/appkit", () => ({
  wagmiConfig: {},
}));

import { useActions, useGardens, useGardeners } from "../../../hooks/blockchain/useBaseLists";

// ============================================
// Test helpers
// ============================================

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ============================================
// Tests
// ============================================

describe("useBaseLists", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
  });

  // ------------------------------------------
  // useActions
  // ------------------------------------------

  describe("useActions", () => {
    it("fetches and returns actions", async () => {
      const mockActions = [createMockAction(), createMockAction({ title: "Second" })];
      mockGetActions.mockResolvedValue(mockActions);

      const { result } = renderHook(() => useActions(), {
        wrapper: createWrapper(queryClient),
      });

      // Wait for actual data (not placeholder) by checking array length
      await waitFor(() => {
        expect(result.current.data).toHaveLength(2);
      });
      expect(result.current.data).toEqual(mockActions);
    });

    it("uses the correct query key based on chain ID", async () => {
      mockGetActions.mockResolvedValue([]);

      renderHook(() => useActions(42161), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockGetActions).toHaveBeenCalled();
      });

      // The query should be cached under the arbitrum chain ID key
      const cached = queryClient.getQueryData(["greengoods", "actions", 42161]);
      expect(cached).toEqual([]);
    });

    it("defaults to DEFAULT_CHAIN_ID when no chainId is provided", async () => {
      mockGetActions.mockResolvedValue([]);

      renderHook(() => useActions(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockGetActions).toHaveBeenCalled();
      });

      const cached = queryClient.getQueryData(["greengoods", "actions", 11155111]);
      expect(cached).toEqual([]);
    });

    it("provides empty array as placeholder data", async () => {
      // Set up a fetch that doesn't resolve immediately
      let resolvePromise: (value: unknown[]) => void;
      mockGetActions.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const { result } = renderHook(() => useActions(), {
        wrapper: createWrapper(queryClient),
      });

      // While loading, placeholderData should provide an empty array
      expect(result.current.data).toEqual([]);

      // Resolve the fetch
      resolvePromise!([createMockAction()]);
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it("sets error state on fetch failure", async () => {
      mockGetActions.mockRejectedValue(new Error("GraphQL error"));

      const { result } = renderHook(() => useActions(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      expect(result.current.error?.message).toBe("GraphQL error");
    });
  });

  // ------------------------------------------
  // useGardens
  // ------------------------------------------

  describe("useGardens", () => {
    it("fetches and returns gardens", async () => {
      const mockGardens = [createMockGarden(), createMockGarden({ name: "Garden B" })];
      mockGetGardens.mockResolvedValue(mockGardens);

      const { result } = renderHook(() => useGardens(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.data).toHaveLength(2);
      });
      expect(result.current.data).toEqual(mockGardens);
    });

    it("caches with chain-specific query key", async () => {
      mockGetGardens.mockResolvedValue([]);

      renderHook(() => useGardens(11155111), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockGetGardens).toHaveBeenCalled();
      });

      const cached = queryClient.getQueryData(["greengoods", "gardens", 11155111]);
      expect(cached).toEqual([]);
    });

    it("handles empty response", async () => {
      mockGetGardens.mockResolvedValue([]);

      const { result } = renderHook(() => useGardens(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual([]);
    });
  });

  // ------------------------------------------
  // useGardeners
  // ------------------------------------------

  describe("useGardeners", () => {
    it("fetches and returns gardeners", async () => {
      const mockGardenersList = [
        { id: "1", address: "0x1111", name: "Gardener 1" },
        { id: "2", address: "0x2222", name: "Gardener 2" },
      ];
      mockGetGardeners.mockResolvedValue(mockGardenersList);

      const { result } = renderHook(() => useGardeners(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.data).toHaveLength(2);
      });
      expect(result.current.data).toEqual(mockGardenersList);
    });

    it("uses the gardeners.all query key (no chain scoping)", async () => {
      mockGetGardeners.mockResolvedValue([]);

      renderHook(() => useGardeners(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockGetGardeners).toHaveBeenCalled();
      });

      // gardeners.all key doesn't include chainId
      const cached = queryClient.getQueryData(["greengoods", "gardeners"]);
      expect(cached).toEqual([]);
    });

    it("handles error from gardeners fetch", async () => {
      mockGetGardeners.mockRejectedValue(new Error("Indexer unreachable"));

      const { result } = renderHook(() => useGardeners(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      expect(result.current.error?.message).toBe("Indexer unreachable");
    });
  });
});
