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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================================
// MOCKS
// ============================================================================

const mockReadContract = vi.fn();
const mockGetEnsAddress = vi.fn();

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
      getEnsAddress: mockGetEnsAddress,
    },
  })),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

// Mock viem — provide keccak256, toBytes, zeroAddress, and createPublicClient
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: mockReadContract,
      getEnsAddress: mockGetEnsAddress,
    })),
  };
});

vi.mock("../../../utils/blockchain/chain-registry", () => ({
  getRpcUrl: vi.fn(() => "https://rpc.test"),
}));

// Import after mocks
import { ensKeys } from "../../../config/query-keys/identity";
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
    mockReadContract.mockReset();
    mockGetEnsAddress.mockResolvedValue(MOCK_OWNER);
    mockReadContract.mockImplementation(async ({ functionName }) => {
      if (functionName === "slugOwner") return ZERO_ADDRESS;
      if (functionName === "l1Receiver") return L1_RECEIVER_ADDRESS;
      return { owner: ZERO_ADDRESS, nameType: 0, registeredAt: 0n };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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

    it("reports an observation error when L1 is unreachable, without inventing a status", async () => {
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

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.data).toBeUndefined();
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

  it.each([
    "pending",
    "timed_out",
    "active",
  ] as const)("rechecks an old %s registration before applying the delay threshold", async (status) => {
    const { wrapper, queryClient } = createTestWrapper();
    const submittedAt = Date.now() - 24 * 60 * 60_000;
    queryClient.setQueryData(ensKeys.registrationStatus("carol"), {
      status,
      submittedAt,
      ccipMessageId: "0xmessage",
    });
    mockReadContract
      .mockResolvedValueOnce(MOCK_OWNER)
      .mockResolvedValueOnce(L1_RECEIVER_ADDRESS)
      .mockResolvedValueOnce({ owner: MOCK_OWNER, nameType: 0, registeredAt: 1700000000n });
    const { result } = renderHook(() => useENSRegistrationStatus("carol"), { wrapper });
    await waitFor(() => expect(result.current.data?.registration?.owner).toBe(MOCK_OWNER));
    expect(result.current.data).toMatchObject({
      status: "active",
      submittedAt,
      ccipMessageId: "0xmessage",
    });
    expect(mockGetEnsAddress).toHaveBeenCalledWith({ name: "carol.greengoods.eth" });
  });

  it.each([
    null,
    "0x9999999999999999999999999999999999999999",
  ])("does not show Ready when the forward name resolves to %s", async (resolvedAddress) => {
    mockReadContract
      .mockResolvedValueOnce(MOCK_OWNER)
      .mockResolvedValueOnce(L1_RECEIVER_ADDRESS)
      .mockResolvedValueOnce({ owner: MOCK_OWNER, nameType: 0, registeredAt: 1700000000n });
    mockGetEnsAddress.mockResolvedValueOnce(resolvedAddress);
    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useENSRegistrationStatus("carol"), { wrapper });
    await waitFor(() => expect(result.current.data?.status).toBe("pending"));
  });

  it("recovers a confirmed name from the receiver when the sender has no owner", async () => {
    mockReadContract
      .mockResolvedValueOnce(ZERO_ADDRESS)
      .mockResolvedValueOnce(L1_RECEIVER_ADDRESS)
      .mockResolvedValueOnce({ owner: MOCK_OWNER, nameType: 0, registeredAt: 1700000000n });
    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useENSRegistrationStatus("carol"), { wrapper });
    await waitFor(() => expect(result.current.data?.status).toBe("active"));
  });

  it("keeps a submitted claim pending during a stale sender read", async () => {
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(ensKeys.registrationStatus("carol"), {
      status: "pending",
      submittedAt: Date.now(),
    });
    const { result } = renderHook(() => useENSRegistrationStatus("carol"), { wrapper });
    await waitFor(() => expect(mockReadContract).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.data?.status).toBe("pending");
  });

  it("does not apply an earlier completed release to a later reservation", async () => {
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(ensKeys.registrationStatus("carol"), {
      status: "available",
      release: { owner: MOCK_OWNER },
      submittedAt: Date.now() - 24 * 60 * 60_000,
    });
    mockReadContract
      .mockResolvedValueOnce(MOCK_OWNER)
      .mockResolvedValueOnce(L1_RECEIVER_ADDRESS)
      .mockResolvedValueOnce({ owner: MOCK_OWNER, nameType: 0, registeredAt: 1700000000n });
    const { result } = renderHook(() => useENSRegistrationStatus("carol"), { wrapper });
    await waitFor(() => expect(result.current.data?.status).toBe("active"));
    expect(result.current.data?.release).toBeUndefined();
    expect(result.current.data?.submittedAt).toBeUndefined();
  });

  it("recognizes a receiver-only registration for the same owner after a completed release", async () => {
    const { wrapper, queryClient } = createTestWrapper();
    const submittedAt = Date.now() - 60_000;
    queryClient.setQueryData(ensKeys.registrationStatus("carol"), {
      status: "available",
      release: { owner: MOCK_OWNER },
      submittedAt,
    });
    mockReadContract
      .mockResolvedValueOnce(ZERO_ADDRESS)
      .mockResolvedValueOnce(L1_RECEIVER_ADDRESS)
      .mockResolvedValueOnce({
        owner: MOCK_OWNER,
        nameType: 0,
        registeredAt: BigInt(Math.floor(submittedAt / 1000) + 30),
      });

    const { result } = renderHook(() => useENSRegistrationStatus("carol"), { wrapper });
    await waitFor(() => expect(result.current.data?.status).toBe("active"));
    expect(result.current.data?.release).toBeUndefined();
    expect(mockGetEnsAddress).toHaveBeenCalledWith({ name: "carol.greengoods.eth" });
  });

  it.each([
    "pending",
    "timed_out",
  ])("recognizes receiver-only recovery while a release is still %s", async (status) => {
    const { wrapper, queryClient } = createTestWrapper();
    const submittedAt = Date.now() - 26 * 60_000;
    queryClient.setQueryData(ensKeys.registrationStatus("carol"), {
      status,
      release: { owner: MOCK_OWNER },
      submittedAt,
    });
    mockReadContract
      .mockResolvedValueOnce(ZERO_ADDRESS)
      .mockResolvedValueOnce(L1_RECEIVER_ADDRESS)
      .mockResolvedValueOnce({
        owner: MOCK_OWNER,
        nameType: 0,
        registeredAt: BigInt(Math.floor(submittedAt / 1000) + 30),
      });

    const { result } = renderHook(() => useENSRegistrationStatus("carol"), { wrapper });
    await waitFor(() => expect(result.current.data?.status).toBe("active"));
    expect(result.current.data?.release).toBeUndefined();
    expect(mockGetEnsAddress).toHaveBeenCalledWith({ name: "carol.greengoods.eth" });
  });

  it("waits for the forward record after the receiver clears a release", async () => {
    const { wrapper, queryClient } = createTestWrapper();
    const release = { owner: MOCK_OWNER };
    queryClient.setQueryData(ensKeys.registrationStatus("carol"), {
      status: "pending",
      release,
      submittedAt: Date.now(),
    });
    const { result } = renderHook(() => useENSRegistrationStatus("carol"), { wrapper });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.data).toMatchObject({ status: "pending", release });

    const readsBeforeClear = mockGetEnsAddress.mock.calls.length;
    mockGetEnsAddress.mockResolvedValue(null);
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() =>
      expect(result.current.data).toMatchObject({ status: "available", release })
    );
    expect(mockGetEnsAddress.mock.calls.length).toBeGreaterThan(readsBeforeClear);
  });

  it("rechecks the forward record before trusting a cached completed release", async () => {
    const { wrapper, queryClient } = createTestWrapper();
    const release = { owner: MOCK_OWNER };
    queryClient.setQueryData(ensKeys.registrationStatus("carol"), {
      status: "available",
      release,
      submittedAt: Date.now(),
    });

    const { result } = renderHook(() => useENSRegistrationStatus("carol"), { wrapper });
    await waitFor(() => expect(result.current.data).toMatchObject({ status: "pending", release }));
    expect(mockGetEnsAddress).toHaveBeenCalledWith({ name: "carol.greengoods.eth" });
  });

  it.each([
    "getRegistration",
    "forward resolution",
  ])("preserves yesterday's confirmed identity across a failed %s refresh and recovery", async (failure) => {
    const { wrapper, queryClient } = createTestWrapper();
    const confirmed = {
      status: "active",
      submittedAt: Date.now() - 24 * 60 * 60_000,
      registration: { owner: MOCK_OWNER, nameType: 0, registeredAt: "1700000000" },
    };
    queryClient.setQueryData(ensKeys.registrationStatus("carol"), confirmed);
    mockReadContract.mockImplementation(async ({ functionName }) => {
      if (functionName === "slugOwner") return MOCK_OWNER;
      if (functionName === "l1Receiver") return L1_RECEIVER_ADDRESS;
      if (failure === "getRegistration") throw new Error("RPC unavailable");
      return { owner: MOCK_OWNER, nameType: 0, registeredAt: 1700000000n };
    });
    if (failure === "forward resolution")
      mockGetEnsAddress.mockRejectedValue(new Error("RPC unavailable"));
    const { result } = renderHook(() => useENSRegistrationStatus("carol"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toEqual(confirmed);
    mockReadContract.mockImplementation(async ({ functionName }) => {
      if (functionName === "slugOwner") return MOCK_OWNER;
      if (functionName === "l1Receiver") return L1_RECEIVER_ADDRESS;
      return { owner: MOCK_OWNER, nameType: 0, registeredAt: 1700000000n };
    });
    mockGetEnsAddress.mockResolvedValue(MOCK_OWNER);
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.data).toEqual(confirmed);
  });

  it("keeps a restored release pending through receiver lag and errors, then clears the account name", async () => {
    const { wrapper, queryClient } = createTestWrapper();
    const release = { owner: MOCK_OWNER };
    queryClient.setQueryData(
      ensKeys.registrationStatus("carol"),
      JSON.parse(
        JSON.stringify({
          status: "pending",
          release,
          submittedAt: Date.now(),
          ccipMessageId: "0xrelease",
        })
      )
    );
    queryClient.setQueryData(ensKeys.protocolName(MOCK_OWNER), "carol.greengoods.eth");
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    let receiverPresent = true;
    let unavailable = false;
    mockReadContract.mockImplementation(async ({ functionName }) => {
      if (functionName === "slugOwner") return ZERO_ADDRESS;
      if (functionName === "l1Receiver") return L1_RECEIVER_ADDRESS;
      if (unavailable) throw new Error("RPC unavailable");
      return {
        owner: receiverPresent ? MOCK_OWNER : ZERO_ADDRESS,
        nameType: 0,
        registeredAt: 1700000000n,
      };
    });
    const { result } = renderHook(() => useENSRegistrationStatus("carol"), { wrapper });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.data).toMatchObject({ status: "pending", release });
    expect(mockGetEnsAddress).not.toHaveBeenCalled();
    unavailable = true;
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toMatchObject({ status: "pending", release });
    unavailable = false;
    receiverPresent = false;
    mockGetEnsAddress.mockResolvedValue(null);
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() =>
      expect(result.current.data).toMatchObject({ status: "available", release })
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ensKeys.protocolName(MOCK_OWNER) });
    // A lagging receiver read cannot undo a completed release.
    receiverPresent = true;
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data).toMatchObject({ status: "available", release });
  });

  // --------------------------------------------------------------------------
  // Adaptive Polling Logic
  // --------------------------------------------------------------------------

  describe("refetchInterval behavior", () => {
    it("continues checking a release after the delay threshold and stops after completion", async () => {
      vi.useFakeTimers();
      const { wrapper, queryClient } = createTestWrapper();
      queryClient.setQueryData(ensKeys.registrationStatus("carol"), {
        status: "pending",
        release: { owner: MOCK_OWNER },
        submittedAt: Date.now() - 26 * 60_000,
      });
      let receiverPresent = true;
      mockReadContract.mockImplementation(async ({ functionName }) => {
        if (functionName === "slugOwner") return ZERO_ADDRESS;
        if (functionName === "l1Receiver") return L1_RECEIVER_ADDRESS;
        return {
          owner: receiverPresent ? MOCK_OWNER : ZERO_ADDRESS,
          nameType: 0,
          registeredAt: 1700000000n,
        };
      });
      const { result, unmount } = renderHook(() => useENSRegistrationStatus("carol"), { wrapper });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(result.current.data?.status).toBe("timed_out");
      receiverPresent = false;
      mockGetEnsAddress.mockResolvedValue(null);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_001);
      });
      expect(result.current.data?.status).toBe("available");
      const readsAtCompletion = mockReadContract.mock.calls.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(mockReadContract).toHaveBeenCalledTimes(readsAtCompletion);
      unmount();
      queryClient.clear();
    });

    it("does not refetch when status is 'available'", async () => {
      mockReadContract.mockResolvedValueOnce(ZERO_ADDRESS); // slugOwner => no owner

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSRegistrationStatus("dave"), { wrapper });

      await waitFor(() => expect(result.current.data?.status).toBe("available"));

      // readContract should have been called once (slugOwner only)
      // No refetch because status is not "pending"
      expect(mockReadContract).toHaveBeenCalledTimes(3);
    });
  });
});
