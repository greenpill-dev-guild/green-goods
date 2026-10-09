/**
 * useEnsName Hook Tests
 * @vitest-environment happy-dom
 *
 * Tests address -> ENS name reverse resolution. This hook delegates to useEnsQuery
 * with a validator (viem's isAddress) and resolveEnsName as the resolver.
 */

import { type QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

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

import { useEnsName, useEnsNames } from "../../../hooks/blockchain/useEnsName";

// ============================================
// Test helpers
// ============================================

const VALID_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

// ============================================
// Tests
// ============================================

describe("useEnsName", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  // ------------------------------------------
  // Successful resolution
  // ------------------------------------------

  describe("successful resolution", () => {
    it("resolves a valid address to an ENS name", async () => {
      mockResolveEnsName.mockResolvedValue("vitalik.eth");

      const { result } = renderHookWithQueryClient(() => useEnsName(VALID_ADDRESS), {
        queryClient,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toBe("vitalik.eth");
    });

    it("passes the normalized address to the resolver", async () => {
      mockResolveEnsName.mockResolvedValue("vitalik.eth");

      renderHookWithQueryClient(() => useEnsName(VALID_ADDRESS), {
        queryClient,
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

      const { result } = renderHookWithQueryClient(() => useEnsName(VALID_ADDRESS), {
        queryClient,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toBeNull();
    });

    it("returns null for the zero address", async () => {
      mockResolveEnsName.mockResolvedValue(null);

      const { result } = renderHookWithQueryClient(() => useEnsName(ZERO_ADDRESS), {
        queryClient,
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
      const { result } = renderHookWithQueryClient(() => useEnsName(null), {
        queryClient,
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsName).not.toHaveBeenCalled();
    });

    it("does not fetch when address is undefined", async () => {
      const { result } = renderHookWithQueryClient(() => useEnsName(undefined), {
        queryClient,
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsName).not.toHaveBeenCalled();
    });

    it("does not fetch for an invalid address (fails isAddress check)", async () => {
      const { result } = renderHookWithQueryClient(
        () => useEnsName("not-an-address" as `0x${string}`),
        {
          queryClient,
        }
      );

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

      const { result } = renderHookWithQueryClient(() => useEnsName(VALID_ADDRESS), {
        queryClient,
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

      renderHookWithQueryClient(() => useEnsName(VALID_ADDRESS), {
        queryClient,
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

  it("resolves unique roster addresses through the single-name query cache", async () => {
    mockResolveEnsName.mockResolvedValue("vitalik.eth");
    const { result } = renderHookWithQueryClient(
      () => useEnsNames([VALID_ADDRESS, VALID_ADDRESS]),
      {
        queryClient,
      }
    );

    await waitFor(() => {
      expect(result.current.get(VALID_ADDRESS.toLowerCase())).toBe("vitalik.eth");
    });
    expect(mockResolveEnsName).toHaveBeenCalledTimes(1);
    expect(
      queryClient.getQueryData(["greengoods", "ens", "name", VALID_ADDRESS.toLowerCase()])
    ).toBe("vitalik.eth");
  });

  it("keeps resolved roster names while disabled, and starts no lookup", async () => {
    mockResolveEnsName.mockResolvedValue("vitalik.eth");
    const { result, rerender } = renderHookWithQueryClient(
      ({ enabled }) => useEnsNames([VALID_ADDRESS], { enabled }),
      { queryClient, initialProps: { enabled: true } }
    );
    await waitFor(() => {
      expect(result.current.get(VALID_ADDRESS.toLowerCase())).toBe("vitalik.eth");
    });

    // A closing dialog disables lookups but must keep matching what it showed.
    rerender({ enabled: false });
    expect(result.current.get(VALID_ADDRESS.toLowerCase())).toBe("vitalik.eth");

    mockResolveEnsName.mockClear();
    const unopened = renderHookWithQueryClient(
      () => useEnsNames([ZERO_ADDRESS], { enabled: false }),
      {
        queryClient,
      }
    );
    expect(unopened.result.current.size).toBe(0);
    expect(mockResolveEnsName).not.toHaveBeenCalled();
  });

  // ------------------------------------------
  // Options
  // ------------------------------------------

  describe("options", () => {
    it("respects enabled=false override", async () => {
      const { result } = renderHookWithQueryClient(
        () => useEnsName(VALID_ADDRESS, { enabled: false }),
        {
          queryClient,
        }
      );

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsName).not.toHaveBeenCalled();
    });
  });
});
