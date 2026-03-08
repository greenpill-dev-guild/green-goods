/**
 * useSlugAvailability Hook Tests
 *
 * Tests the debounced RPC availability check for ENS slugs.
 * This is tier 2 of the three-tier validation pipeline:
 *   1. Sync Zod (instant) — useSlugForm
 *   2. Debounced RPC (300ms) — this hook
 *   3. On-submit recheck — useENSClaim
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================================
// MOCKS
// ============================================================================

const mockReadContract = vi.fn();
const ENS_ADDRESS = "0xENSContract000000000000000000000000000001";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

vi.mock("../../../utils/blockchain/contracts", () => ({
  GreenGoodsENSABI: [
    { name: "available", type: "function", inputs: [{ name: "slug", type: "string" }] },
  ],
  getNetworkContracts: vi.fn(() => ({
    greenGoodsENS: ENS_ADDRESS,
  })),
  createClients: vi.fn(() => ({
    publicClient: {
      readContract: mockReadContract,
    },
  })),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

// Mock useDebouncedValue to return value immediately for test determinism
vi.mock("../../../hooks/utils/useDebouncedValue", () => ({
  useDebouncedValue: vi.fn((value: unknown) => value),
}));

// Import after mocks
import { useSlugAvailability } from "../../../hooks/ens/useSlugAvailability";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe("useSlugAvailability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("disabled conditions", () => {
    it("does not fetch when slug is undefined", () => {
      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useSlugAvailability(undefined), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
      expect(mockReadContract).not.toHaveBeenCalled();
    });

    it("does not fetch when slug is empty string", () => {
      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useSlugAvailability(""), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
      expect(mockReadContract).not.toHaveBeenCalled();
    });

    it("does not fetch for invalid slug format", () => {
      const { wrapper } = createTestWrapper();
      // "AB" is invalid: too short and uppercase
      const { result } = renderHook(() => useSlugAvailability("AB"), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
      expect(mockReadContract).not.toHaveBeenCalled();
    });

    it("does not fetch when ENS module not configured (zero address)", async () => {
      const { getNetworkContracts } = await import("../../../utils/blockchain/contracts");
      (getNetworkContracts as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        greenGoodsENS: ZERO_ADDRESS,
      });

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useSlugAvailability("alice"), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("availability results", () => {
    it("returns true when slug is available", async () => {
      mockReadContract.mockResolvedValue(true);

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useSlugAvailability("alice"), { wrapper });

      await waitFor(() => expect(result.current.data).toBe(true));
    });

    it("returns false when slug is taken", async () => {
      mockReadContract.mockResolvedValue(false);

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useSlugAvailability("bob"), { wrapper });

      await waitFor(() => expect(result.current.data).toBe(false));
    });

    it("calls readContract with correct function and slug", async () => {
      mockReadContract.mockResolvedValue(true);

      const { wrapper } = createTestWrapper();
      renderHook(() => useSlugAvailability("my-garden"), { wrapper });

      await waitFor(() =>
        expect(mockReadContract).toHaveBeenCalledWith(
          expect.objectContaining({
            functionName: "available",
            args: ["my-garden"],
          })
        )
      );
    });
  });
});
