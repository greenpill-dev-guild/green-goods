/**
 * useEnsAddress Hook Tests
 * @vitest-environment jsdom
 *
 * Tests ENS name -> address resolution. This hook delegates to useEnsQuery
 * with resolveEnsAddress as the resolver, so we mock the resolver and
 * verify correct wiring, query keys, and input handling.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mocks
// ============================================

const mockResolveEnsAddress = vi.fn();

vi.mock("../../../utils/blockchain/ens", () => ({
  resolveEnsAddress: (...args: unknown[]) => mockResolveEnsAddress(...args),
}));

// Mock wagmi (transitive dependency)
vi.mock("wagmi", () => ({
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));

vi.mock("../../../config/appkit", () => ({
  wagmiConfig: {},
}));

import { useEnsAddress } from "../../../hooks/blockchain/useEnsAddress";

// ============================================
// Test helpers
// ============================================

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
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

describe("useEnsAddress", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
  });

  // ------------------------------------------
  // Successful resolution
  // ------------------------------------------

  describe("successful resolution", () => {
    it("resolves a valid ENS name to an address", async () => {
      const expectedAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
      mockResolveEnsAddress.mockResolvedValue(expectedAddress);

      const { result } = renderHook(() => useEnsAddress("vitalik.eth"), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe(expectedAddress);
      expect(mockResolveEnsAddress).toHaveBeenCalledWith("vitalik.eth", {});
    });

    it("normalizes the ENS name to lowercase before resolving", async () => {
      mockResolveEnsAddress.mockResolvedValue("0xaddr");

      renderHook(() => useEnsAddress("Vitalik.ETH"), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockResolveEnsAddress).toHaveBeenCalledWith("vitalik.eth", {});
      });
    });

    it("trims whitespace from the ENS name", async () => {
      mockResolveEnsAddress.mockResolvedValue("0xaddr");

      renderHook(() => useEnsAddress("  vitalik.eth  "), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockResolveEnsAddress).toHaveBeenCalledWith("vitalik.eth", {});
      });
    });
  });

  // ------------------------------------------
  // Null/empty input handling
  // ------------------------------------------

  describe("disabled states", () => {
    it("does not fetch when name is null", async () => {
      const { result } = renderHook(() => useEnsAddress(null), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsAddress).not.toHaveBeenCalled();
    });

    it("does not fetch when name is undefined", async () => {
      const { result } = renderHook(() => useEnsAddress(undefined), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsAddress).not.toHaveBeenCalled();
    });

    it("does not fetch when name is empty string", async () => {
      const { result } = renderHook(() => useEnsAddress(""), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsAddress).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // Resolver returns null
  // ------------------------------------------

  describe("no resolution", () => {
    it("returns null when no address is found for the name", async () => {
      mockResolveEnsAddress.mockResolvedValue(null);

      const { result } = renderHook(() => useEnsAddress("nonexistent.eth"), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toBeNull();
    });
  });

  // ------------------------------------------
  // Error handling
  // ------------------------------------------

  describe("error handling", () => {
    it("sets error state when resolver rejects", async () => {
      mockResolveEnsAddress.mockRejectedValue(new Error("Network failure"));

      const { result } = renderHook(() => useEnsAddress("fail.eth"), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      expect(result.current.error?.message).toBe("Network failure");
    });
  });

  // ------------------------------------------
  // Options passthrough
  // ------------------------------------------

  describe("options", () => {
    it("respects enabled=false", async () => {
      const { result } = renderHook(() => useEnsAddress("vitalik.eth", { enabled: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsAddress).not.toHaveBeenCalled();
    });

    it("uses query key based on lowercased name", async () => {
      mockResolveEnsAddress.mockResolvedValue("0xaddr");

      renderHook(() => useEnsAddress("Vitalik.ETH"), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockResolveEnsAddress).toHaveBeenCalled();
      });

      // Verify the query was cached with the normalized key
      const cachedData = queryClient.getQueryData(["greengoods", "ens", "address", "vitalik.eth"]);
      expect(cachedData).toBe("0xaddr");
    });
  });
});
