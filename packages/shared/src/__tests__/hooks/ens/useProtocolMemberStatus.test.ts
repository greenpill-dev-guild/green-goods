/**
 * useProtocolMemberStatus Hook Tests
 *
 * Tests the hook that checks if an address wears the protocol gardeners hat.
 * Protocol membership is required for claiming a personal *.greengoods.eth name.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// ============================================================================
// MOCKS
// ============================================================================

const mockReadContract = vi.fn();

const ENS_ADDRESS = "0xENSContract000000000000000000000000000001";
const HATS_ADDRESS = "0xHatsContract00000000000000000000000000001";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const USER_ADDRESS = "0x1234567890123456789012345678901234567890";
const PROTOCOL_HAT_ID = 42n;

vi.mock("../../../utils/blockchain/contracts", () => ({
  GreenGoodsENSABI: [
    { name: "HATS", type: "function", inputs: [], outputs: [{ type: "address" }] },
    { name: "protocolHatId", type: "function", inputs: [], outputs: [{ type: "uint256" }] },
  ],
  HatsABI: [
    {
      name: "isWearerOfHat",
      type: "function",
      inputs: [
        { name: "account", type: "address" },
        { name: "hatId", type: "uint256" },
      ],
      outputs: [{ type: "bool" }],
    },
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

// Import after mocks
import { useProtocolMemberStatus } from "../../../hooks/ens/useProtocolMemberStatus";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
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

describe("useProtocolMemberStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Disabled conditions
  // --------------------------------------------------------------------------

  describe("disabled conditions", () => {
    it("does not fetch when address is undefined", () => {
      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useProtocolMemberStatus(undefined), {
        wrapper,
      });

      expect(result.current.data).toBeUndefined();
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("does not fetch when ENS module not configured (zero address)", async () => {
      const { getNetworkContracts } = await import("../../../utils/blockchain/contracts");
      (getNetworkContracts as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        greenGoodsENS: ZERO_ADDRESS,
      });

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useProtocolMemberStatus(USER_ADDRESS as `0x${string}`), {
        wrapper,
      });

      expect(result.current.fetchStatus).toBe("idle");

      // Restore mock
      (getNetworkContracts as ReturnType<typeof vi.fn>).mockReturnValue({
        greenGoodsENS: ENS_ADDRESS,
      });
    });
  });

  // --------------------------------------------------------------------------
  // Membership checks
  // --------------------------------------------------------------------------

  describe("membership checks", () => {
    it("returns true when user wears the protocol hat", async () => {
      // Call sequence:
      // 1. HATS() => HATS_ADDRESS
      // 2. protocolHatId() => PROTOCOL_HAT_ID
      // 3. isWearerOfHat(user, hatId) => true
      mockReadContract
        .mockResolvedValueOnce(HATS_ADDRESS) // HATS
        .mockResolvedValueOnce(PROTOCOL_HAT_ID) // protocolHatId
        .mockResolvedValueOnce(true); // isWearerOfHat

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useProtocolMemberStatus(USER_ADDRESS as `0x${string}`), {
        wrapper,
      });

      await waitFor(() => expect(result.current.data).toBe(true));
    });

    it("returns false when user does not wear the protocol hat", async () => {
      mockReadContract
        .mockResolvedValueOnce(HATS_ADDRESS)
        .mockResolvedValueOnce(PROTOCOL_HAT_ID)
        .mockResolvedValueOnce(false); // isWearerOfHat => false

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useProtocolMemberStatus(USER_ADDRESS as `0x${string}`), {
        wrapper,
      });

      await waitFor(() => expect(result.current.data).toBe(false));
    });

    it("returns false when Hats address is zero", async () => {
      mockReadContract
        .mockResolvedValueOnce(ZERO_ADDRESS) // HATS => zero
        .mockResolvedValueOnce(PROTOCOL_HAT_ID);

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useProtocolMemberStatus(USER_ADDRESS as `0x${string}`), {
        wrapper,
      });

      await waitFor(() => expect(result.current.data).toBe(false));
    });

    it("returns false when protocolHatId is zero", async () => {
      mockReadContract.mockResolvedValueOnce(HATS_ADDRESS).mockResolvedValueOnce(0n); // protocolHatId => 0

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useProtocolMemberStatus(USER_ADDRESS as `0x${string}`), {
        wrapper,
      });

      await waitFor(() => expect(result.current.data).toBe(false));
    });
  });
});
