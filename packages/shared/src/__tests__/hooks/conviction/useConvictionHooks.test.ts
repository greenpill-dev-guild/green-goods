/**
 * Conviction Voting Hook Tests
 * @vitest-environment jsdom
 *
 * Tests ABI tuple destructuring, query key construction, and address normalization
 * in the conviction voting hooks.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_CHAIN_ID = 84532;
const TEST_POOL = "0x1111111111111111111111111111111111111111";
const TEST_VOTER = "0x2222222222222222222222222222222222222222";
const TEST_GARDEN = "0x3333333333333333333333333333333333333333";

// Mock wagmi core readContract
const mockReadContract = vi.fn();
vi.mock("@wagmi/core", () => ({
  readContract: (...args: unknown[]) => mockReadContract(...args),
}));

// Mock wagmi (needed to prevent module cache conflicts with mutation tests)
vi.mock("wagmi", () => ({
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));

// Mock chain config
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => TEST_CHAIN_ID,
}));

// Mock appkit config
vi.mock("../../../config/appkit", () => ({
  wagmiConfig: {},
}));

// Mock garden-hats utility
const mockFetchHatsModuleAddress = vi.fn();
vi.mock("../../../utils/blockchain/garden-hats", () => ({
  fetchHatsModuleAddress: (...args: unknown[]) => mockFetchHatsModuleAddress(...args),
}));

import { useMemberVotingPower } from "../../../hooks/conviction/useMemberVotingPower";
import { useHypercertConviction } from "../../../hooks/conviction/useHypercertConviction";
import { useRegisteredHypercerts } from "../../../hooks/conviction/useRegisteredHypercerts";
import { useConvictionStrategies } from "../../../hooks/conviction/useConvictionStrategies";
import type { Address } from "../../../types/domain";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useMemberVotingPower", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("correctly destructures tuple return from getVoterAllocations", async () => {
    // Simulate the 4 parallel readContract calls
    mockReadContract
      .mockResolvedValueOnce(true) // isEligibleVoter
      .mockResolvedValueOnce(500n) // voterTotalStake
      .mockResolvedValueOnce(1000n) // pointsPerVoter
      .mockResolvedValueOnce([
        // getVoterAllocations returns [uint256[], uint256[]]
        [1n, 2n, 3n],
        [100n, 200n, 300n],
      ]);

    const { result } = renderHook(
      () => useMemberVotingPower(TEST_POOL as Address, TEST_VOTER as Address),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.power.isEligible).toBe(true);
    expect(result.current.power.totalStake).toBe(500n);
    expect(result.current.power.pointsBudget).toBe(1000n);
    expect(result.current.power.allocations).toHaveLength(3);
    expect(result.current.power.allocations[0]).toEqual({
      hypercertId: 1n,
      amount: 100n,
    });
    expect(result.current.power.allocations[2]).toEqual({
      hypercertId: 3n,
      amount: 300n,
    });
  });

  it("returns default values when pool address is undefined", async () => {
    const { result } = renderHook(() => useMemberVotingPower(undefined, TEST_VOTER as Address), {
      wrapper: createWrapper(queryClient),
    });

    // Should not make any RPC calls
    expect(mockReadContract).not.toHaveBeenCalled();
    expect(result.current.power).toEqual({
      totalStake: 0n,
      pointsBudget: 0n,
      isEligible: false,
      allocations: [],
    });
  });

  it("returns default values when voter address is undefined", async () => {
    const { result } = renderHook(() => useMemberVotingPower(TEST_POOL as Address, undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockReadContract).not.toHaveBeenCalled();
    expect(result.current.power.isEligible).toBe(false);
  });

  it("handles empty allocations", async () => {
    mockReadContract
      .mockResolvedValueOnce(false) // isEligibleVoter
      .mockResolvedValueOnce(0n) // voterTotalStake
      .mockResolvedValueOnce(1000n) // pointsPerVoter
      .mockResolvedValueOnce([[], []]); // empty allocations

    const { result } = renderHook(
      () => useMemberVotingPower(TEST_POOL as Address, TEST_VOTER as Address),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.power.isEligible).toBe(false);
    expect(result.current.power.allocations).toHaveLength(0);
  });

  it("respects enabled option", () => {
    renderHook(
      () =>
        useMemberVotingPower(TEST_POOL as Address, TEST_VOTER as Address, {
          enabled: false,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    expect(mockReadContract).not.toHaveBeenCalled();
  });
});

describe("useHypercertConviction", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("correctly destructures getConvictionWeights tuple", async () => {
    // getConvictionWeights returns [uint256[], uint256[]]
    mockReadContract.mockResolvedValueOnce([
      [10n, 20n],
      [500n, 1500n],
    ]);

    const { result } = renderHook(() => useHypercertConviction(TEST_POOL as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.weights).toHaveLength(2);
    expect(result.current.weights[0]).toEqual({
      hypercertId: 10n,
      weight: 500n,
    });
    expect(result.current.weights[1]).toEqual({
      hypercertId: 20n,
      weight: 1500n,
    });
  });

  it("returns empty weights when pool address is undefined", () => {
    const { result } = renderHook(() => useHypercertConviction(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockReadContract).not.toHaveBeenCalled();
    expect(result.current.weights).toEqual([]);
  });
});

describe("useRegisteredHypercerts", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("returns registered hypercert IDs", async () => {
    mockReadContract.mockResolvedValueOnce([100n, 200n, 300n]);

    const { result } = renderHook(() => useRegisteredHypercerts(TEST_POOL as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.hypercertIds).toEqual([100n, 200n, 300n]);
  });

  it("returns empty array when pool address is undefined", () => {
    const { result } = renderHook(() => useRegisteredHypercerts(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockReadContract).not.toHaveBeenCalled();
    expect(result.current.hypercertIds).toEqual([]);
  });
});

describe("useConvictionStrategies", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("returns strategy addresses from HatsModule", async () => {
    const hatsModule = "0x4444444444444444444444444444444444444444";
    mockFetchHatsModuleAddress.mockResolvedValueOnce(hatsModule);
    mockReadContract.mockResolvedValueOnce([TEST_POOL]);

    const { result } = renderHook(() => useConvictionStrategies(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.strategies).toEqual([TEST_POOL]);
  });

  it("returns empty when garden has no HatsModule", async () => {
    mockFetchHatsModuleAddress.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useConvictionStrategies(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.strategies).toEqual([]);
    expect(mockReadContract).not.toHaveBeenCalled();
  });

  it("returns empty strategies when garden address is undefined", () => {
    const { result } = renderHook(() => useConvictionStrategies(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockFetchHatsModuleAddress).not.toHaveBeenCalled();
    expect(result.current.strategies).toEqual([]);
  });
});
