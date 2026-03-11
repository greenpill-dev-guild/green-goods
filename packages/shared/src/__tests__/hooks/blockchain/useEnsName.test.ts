/**
 * useEnsName Hook Tests
 * @vitest-environment jsdom
 *
 * Tests address -> ENS name reverse resolution. This hook delegates to useEnsQuery
 * with a validator (viem's isAddress) and resolveEnsName as the resolver.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mocks
// ============================================

const mockResolveEnsName = vi.fn();

vi.mock("../../../utils/blockchain/ens", () => ({
  resolveEnsName: (...args: unknown[]) => mockResolveEnsName(...args),
}));

vi.mock("wagmi", () => ({
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));

vi.mock("../../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

import { useEnsName } from "../../../hooks/blockchain/useEnsName";

// ============================================
// Test helpers
// ============================================

const VALID_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

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

describe("useEnsName", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
  });

  // ------------------------------------------
  // Successful resolution
  // ------------------------------------------

  describe("successful resolution", () => {
    it("resolves a valid address to an ENS name", async () => {
      mockResolveEnsName.mockResolvedValue("vitalik.eth");

      const { result } = renderHook(() => useEnsName(VALID_ADDRESS), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toBe("vitalik.eth");
    });

    it("passes the normalized address to the resolver", async () => {
      mockResolveEnsName.mockResolvedValue("vitalik.eth");

      renderHook(() => useEnsName(VALID_ADDRESS), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockResolveEnsName).toHaveBeenCalledWith(VALID_ADDRESS.toLowerCase(), {});
      });
    });
  });

  // ------------------------------------------
  // No ENS name
  // ------------------------------------------

  describe("no resolution", () => {
    it("returns null when address has no ENS name", async () => {
      mockResolveEnsName.mockResolvedValue(null);

      const { result } = renderHook(() => useEnsName(VALID_ADDRESS), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toBeNull();
    });

    it("returns null for the zero address", async () => {
      mockResolveEnsName.mockResolvedValue(null);

      const { result } = renderHook(() => useEnsName(ZERO_ADDRESS), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toBeNull();
    });
  });

  // ------------------------------------------
  // Input validation (isAddress validator)
  // ------------------------------------------

  describe("input validation", () => {
    it("does not fetch when address is null", async () => {
      const { result } = renderHook(() => useEnsName(null), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsName).not.toHaveBeenCalled();
    });

    it("does not fetch when address is undefined", async () => {
      const { result } = renderHook(() => useEnsName(undefined), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsName).not.toHaveBeenCalled();
    });

    it("does not fetch for an invalid address (fails isAddress check)", async () => {
      const { result } = renderHook(() => useEnsName("not-an-address" as `0x${string}`), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsName).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // Error handling
  // ------------------------------------------

  describe("error handling", () => {
    it("sets error state when resolver rejects", async () => {
      mockResolveEnsName.mockRejectedValue(new Error("RPC timeout"));

      const { result } = renderHook(() => useEnsName(VALID_ADDRESS), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      expect(result.current.error?.message).toBe("RPC timeout");
    });
  });

  // ------------------------------------------
  // Query key correctness
  // ------------------------------------------

  describe("query key", () => {
    it("uses lowercased address in the query key", async () => {
      mockResolveEnsName.mockResolvedValue("vitalik.eth");

      renderHook(() => useEnsName(VALID_ADDRESS), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockResolveEnsName).toHaveBeenCalled();
      });

      const cachedData = queryClient.getQueryData([
        "greengoods",
        "ens",
        "name",
        VALID_ADDRESS.toLowerCase(),
      ]);
      expect(cachedData).toBe("vitalik.eth");
    });
  });

  // ------------------------------------------
  // Options
  // ------------------------------------------

  describe("options", () => {
    it("respects enabled=false override", async () => {
      const { result } = renderHook(() => useEnsName(VALID_ADDRESS, { enabled: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsName).not.toHaveBeenCalled();
    });
  });
});
