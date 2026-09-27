/**
 * useEnsAddress Hook Tests
 * @vitest-environment jsdom
 *
 * Tests ENS name -> address resolution. This hook delegates to useEnsQuery
 * with resolveEnsAddress as the resolver, so we mock the resolver and
 * verify correct wiring, query keys, and input handling.
 */

import { type QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

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
  getWagmiConfig: () => ({}),
}));

import { useEnsAddress } from "../../../hooks/blockchain/useEnsAddress";

// ============================================
// Test helpers
// ============================================

// ============================================
// Tests
// ============================================

describe("useEnsAddress", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  // ------------------------------------------
  // Successful resolution
  // ------------------------------------------

  describe("successful resolution", () => {
    it("resolves a valid ENS name to an address", async () => {
      const expectedAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
      mockResolveEnsAddress.mockResolvedValue(expectedAddress);

      const { result } = renderHookWithQueryClient(() => useEnsAddress("vitalik.eth"), {
        queryClient,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe(expectedAddress);
      expect(mockResolveEnsAddress).toHaveBeenCalledWith("vitalik.eth", {});
    });

    it("normalizes the ENS name to lowercase before resolving", async () => {
      mockResolveEnsAddress.mockResolvedValue("0xaddr");

      renderHookWithQueryClient(() => useEnsAddress("Vitalik.ETH"), {
        queryClient,
      });

      await waitFor(() => {
        expect(mockResolveEnsAddress).toHaveBeenCalledWith("vitalik.eth", {});
      });
    });

    it("trims whitespace from the ENS name", async () => {
      mockResolveEnsAddress.mockResolvedValue("0xaddr");

      renderHookWithQueryClient(() => useEnsAddress("  vitalik.eth  "), {
        queryClient,
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
      const { result } = renderHookWithQueryClient(() => useEnsAddress(null), {
        queryClient,
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsAddress).not.toHaveBeenCalled();
    });

    it("does not fetch when name is undefined", async () => {
      const { result } = renderHookWithQueryClient(() => useEnsAddress(undefined), {
        queryClient,
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsAddress).not.toHaveBeenCalled();
    });

    it("does not fetch when name is empty string", async () => {
      const { result } = renderHookWithQueryClient(() => useEnsAddress(""), {
        queryClient,
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

      const { result } = renderHookWithQueryClient(() => useEnsAddress("nonexistent.eth"), {
        queryClient,
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

      const { result } = renderHookWithQueryClient(() => useEnsAddress("fail.eth"), {
        queryClient,
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
      const { result } = renderHookWithQueryClient(
        () => useEnsAddress("vitalik.eth", { enabled: false }),
        {
          queryClient,
        }
      );

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsAddress).not.toHaveBeenCalled();
    });

    it("uses query key based on lowercased name", async () => {
      mockResolveEnsAddress.mockResolvedValue("0xaddr");

      renderHookWithQueryClient(() => useEnsAddress("Vitalik.ETH"), {
        queryClient,
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
