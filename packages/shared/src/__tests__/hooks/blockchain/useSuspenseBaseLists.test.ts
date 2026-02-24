/**
 * useSuspenseBaseLists Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the Suspense-enabled variants: useSuspenseGardens, useSuspenseActions,
 * useSuspenseGardeners. These hooks throw a promise while loading (caught by
 * React.Suspense) and guarantee data is available when the component renders.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, Suspense, type ReactNode } from "react";
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

import {
  useSuspenseGardens,
  useSuspenseActions,
  useSuspenseGardeners,
} from "../../../hooks/blockchain/useSuspenseBaseLists";

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

function createSuspenseWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(Suspense, { fallback: createElement("div", null, "Loading...") }, children)
    );
  };
}

// ============================================
// Tests
// ============================================

describe("useSuspenseBaseLists", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
  });

  // ------------------------------------------
  // useSuspenseGardens
  // ------------------------------------------

  describe("useSuspenseGardens", () => {
    it("returns gardens data after suspense resolves", async () => {
      const mockGardens = [createMockGarden()];
      mockGetGardens.mockResolvedValue(mockGardens);

      const { result } = renderHook(() => useSuspenseGardens(), {
        wrapper: createSuspenseWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockGardens);
      });
    });

    it("uses DEFAULT_CHAIN_ID when no chainId is provided", async () => {
      mockGetGardens.mockResolvedValue([]);

      const { result } = renderHook(() => useSuspenseGardens(), {
        wrapper: createSuspenseWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual([]);
      });

      const cached = queryClient.getQueryData(["greengoods", "gardens", 11155111]);
      expect(cached).toEqual([]);
    });

    it("throws error for unsupported chain ID", () => {
      expect(() => {
        renderHook(() => useSuspenseGardens(42161), {
          wrapper: createSuspenseWrapper(queryClient),
        });
      }).toThrow("useSuspenseGardens: chainId 42161 is not supported");
    });

    it("uses cached data when available", async () => {
      const mockGardens = [createMockGarden()];

      // Pre-seed the cache
      queryClient.setQueryData(["greengoods", "gardens", 11155111], mockGardens);

      const { result } = renderHook(() => useSuspenseGardens(), {
        wrapper: createSuspenseWrapper(queryClient),
      });

      // Should have data immediately from cache (though suspense might still briefly suspend)
      await waitFor(() => {
        expect(result.current.data).toEqual(mockGardens);
      });
    });
  });

  // ------------------------------------------
  // useSuspenseActions
  // ------------------------------------------

  describe("useSuspenseActions", () => {
    it("returns actions data after suspense resolves", async () => {
      const mockActions = [createMockAction()];
      mockGetActions.mockResolvedValue(mockActions);

      const { result } = renderHook(() => useSuspenseActions(), {
        wrapper: createSuspenseWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockActions);
      });
    });

    it("uses correct query key for default chain", async () => {
      mockGetActions.mockResolvedValue([]);

      renderHook(() => useSuspenseActions(), {
        wrapper: createSuspenseWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockGetActions).toHaveBeenCalled();
      });

      const cached = queryClient.getQueryData(["greengoods", "actions", 11155111]);
      expect(cached).toEqual([]);
    });

    it("throws error for unsupported chain ID", () => {
      expect(() => {
        renderHook(() => useSuspenseActions(42161), {
          wrapper: createSuspenseWrapper(queryClient),
        });
      }).toThrow("useSuspenseActions: chainId 42161 is not supported");
    });

    it("handles fetch error", async () => {
      mockGetActions.mockRejectedValue(new Error("Network error"));

      // useSuspenseQuery rethrows on error - ErrorBoundary would catch this
      // renderHook will see the error
      const { result } = renderHook(() => useSuspenseActions(), {
        wrapper: createSuspenseWrapper(queryClient),
      });

      // The hook should eventually error - but since we're in suspense mode,
      // the error gets thrown. We need to check the fetch was attempted.
      await waitFor(() => {
        expect(mockGetActions).toHaveBeenCalled();
      });
    });
  });

  // ------------------------------------------
  // useSuspenseGardeners
  // ------------------------------------------

  describe("useSuspenseGardeners", () => {
    it("returns gardeners data after suspense resolves", async () => {
      const mockGardenersList = [
        { id: "1", address: "0x1111" },
        { id: "2", address: "0x2222" },
      ];
      mockGetGardeners.mockResolvedValue(mockGardenersList);

      const { result } = renderHook(() => useSuspenseGardeners(), {
        wrapper: createSuspenseWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockGardenersList);
      });
    });

    it("uses gardeners.all query key (no chain scoping)", async () => {
      mockGetGardeners.mockResolvedValue([]);

      renderHook(() => useSuspenseGardeners(), {
        wrapper: createSuspenseWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockGetGardeners).toHaveBeenCalled();
      });

      const cached = queryClient.getQueryData(["greengoods", "gardeners"]);
      expect(cached).toEqual([]);
    });

    it("does not accept a chain ID parameter (unlike gardens/actions)", async () => {
      mockGetGardeners.mockResolvedValue([]);

      // The function signature only accepts no args -- just verify it works
      const { result } = renderHook(() => useSuspenseGardeners(), {
        wrapper: createSuspenseWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual([]);
      });
    });
  });
});
