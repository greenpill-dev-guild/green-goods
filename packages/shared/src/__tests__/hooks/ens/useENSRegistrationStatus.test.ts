/**
 * useENSRegistrationStatus Hook Tests
 *
 * Tests the CCIP delivery status polling hook that tracks ENS subdomain
 * registration across L2 cache and L1 receiver.
 *
 * Note: Since DEFAULT_CHAIN_ID is 11155111 (Sepolia), getENSL1ChainId returns
 * the same chain ID. This means l1Client === publicClient, so all readContract
 * calls (slugOwner, l1Receiver, getRegistration) flow through the same mock.
 * We must use mockResolvedValueOnce in the correct order.
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
const L1_RECEIVER_ADDRESS = "0xL1Receiver0000000000000000000000000000001";
const MOCK_OWNER = "0x1234567890123456789012345678901234567890";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

vi.mock("../../../utils/blockchain/contracts", () => ({
  GreenGoodsENSABI: [
    { name: "slugOwner", type: "function", inputs: [{ name: "slugHash", type: "bytes32" }] },
    { name: "l1Receiver", type: "function", inputs: [] },
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

// Mock viem — provide keccak256, toBytes, zeroAddress, and createPublicClient
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: mockReadContract,
    })),
  };
});

vi.mock("../../../utils/blockchain/chain-registry", () => ({
  getRpcUrl: vi.fn(() => "https://rpc.test"),
}));

// Import after mocks
import { useENSRegistrationStatus } from "../../../hooks/ens/useENSRegistrationStatus";

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

describe("useENSRegistrationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Availability (no claim on L2)
  // --------------------------------------------------------------------------

  describe("available status", () => {
    it("returns 'available' when slug is undefined (query disabled)", () => {
      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSRegistrationStatus(undefined), { wrapper });

      // Query is disabled when slug is undefined
      expect(result.current.data).toBeUndefined();
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("returns 'available' when ENS module not configured (zero address)", async () => {
      const { getNetworkContracts } = await import("../../../utils/blockchain/contracts");
      (getNetworkContracts as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        greenGoodsENS: ZERO_ADDRESS,
      });

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSRegistrationStatus("alice"), { wrapper });

      await waitFor(() => {
        expect(result.current.data?.status).toBe("available");
      });

      // Restore mock
      (getNetworkContracts as ReturnType<typeof vi.fn>).mockReturnValue({
        greenGoodsENS: ENS_ADDRESS,
      });
    });

    it("returns 'available' when L2 cache shows no owner (slugOwner is zero)", async () => {
      // Call sequence: slugOwner returns zero address => early return "available"
      mockReadContract.mockResolvedValueOnce(ZERO_ADDRESS);

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSRegistrationStatus("alice"), { wrapper });

      await waitFor(() => expect(result.current.data?.status).toBe("available"));
    });
  });

  // --------------------------------------------------------------------------
  // Pending (claimed on L2, not confirmed on L1)
  // --------------------------------------------------------------------------

  describe("pending status", () => {
    it("returns 'pending' when L2 has owner but L1 registration owner is zero", async () => {
      // Call sequence for Sepolia (L1 == L2, same client):
      // 1. slugOwner => MOCK_OWNER (claimed)
      // 2. l1Receiver => L1_RECEIVER_ADDRESS
      // 3. getRegistration => owner is zero (CCIP not delivered)
      mockReadContract
        .mockResolvedValueOnce(MOCK_OWNER) // slugOwner
        .mockResolvedValueOnce(L1_RECEIVER_ADDRESS) // l1Receiver
        .mockResolvedValueOnce({ owner: ZERO_ADDRESS, nameType: 0, registeredAt: 0n }); // getRegistration

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSRegistrationStatus("bob"), { wrapper });

      await waitFor(() => expect(result.current.data?.status).toBe("pending"));
    });

    it("returns 'pending' when L1 query fails (graceful fallthrough)", async () => {
      // Call sequence:
      // 1. slugOwner => MOCK_OWNER (claimed)
      // 2. l1Receiver => L1_RECEIVER_ADDRESS
      // 3. getRegistration => throws (network error)
      mockReadContract
        .mockResolvedValueOnce(MOCK_OWNER) // slugOwner
        .mockResolvedValueOnce(L1_RECEIVER_ADDRESS) // l1Receiver
        .mockRejectedValueOnce(new Error("Network error")); // getRegistration fails

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSRegistrationStatus("bob"), { wrapper });

      await waitFor(() => expect(result.current.data?.status).toBe("pending"));
    });

    it("returns 'pending' when L1 receiver address is zero", async () => {
      // Call sequence:
      // 1. slugOwner => MOCK_OWNER (claimed)
      // 2. l1Receiver => ZERO_ADDRESS (not configured)
      // => no L1 query, fall through to "pending"
      mockReadContract
        .mockResolvedValueOnce(MOCK_OWNER) // slugOwner
        .mockResolvedValueOnce(ZERO_ADDRESS); // l1Receiver is zero

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSRegistrationStatus("bob"), { wrapper });

      await waitFor(() => expect(result.current.data?.status).toBe("pending"));
    });
  });

  // --------------------------------------------------------------------------
  // Active (confirmed on L1)
  // --------------------------------------------------------------------------

  describe("active status", () => {
    it("returns 'active' with serialized registration data when L1 confirms", async () => {
      // Call sequence:
      // 1. slugOwner => MOCK_OWNER (claimed)
      // 2. l1Receiver => L1_RECEIVER_ADDRESS
      // 3. getRegistration => confirmed registration
      mockReadContract
        .mockResolvedValueOnce(MOCK_OWNER) // slugOwner
        .mockResolvedValueOnce(L1_RECEIVER_ADDRESS) // l1Receiver
        .mockResolvedValueOnce({
          owner: MOCK_OWNER,
          nameType: 0,
          registeredAt: 1700000000n,
        }); // getRegistration

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSRegistrationStatus("carol"), { wrapper });

      await waitFor(() => expect(result.current.data?.status).toBe("active"));

      // Verify registration data is serialized (no BigInt — safe for IndexedDB)
      expect(result.current.data?.registration).toEqual({
        owner: MOCK_OWNER,
        nameType: 0,
        registeredAt: "1700000000", // String, not BigInt
      });
    });
  });

  // --------------------------------------------------------------------------
  // Adaptive Polling Logic
  // --------------------------------------------------------------------------

  describe("refetchInterval behavior", () => {
    it("does not refetch when status is 'available'", async () => {
      mockReadContract.mockResolvedValueOnce(ZERO_ADDRESS); // slugOwner => no owner

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSRegistrationStatus("dave"), { wrapper });

      await waitFor(() => expect(result.current.data?.status).toBe("available"));

      // readContract should have been called once (slugOwner only)
      // No refetch because status is not "pending"
      expect(mockReadContract).toHaveBeenCalledTimes(1);
    });
  });
});
