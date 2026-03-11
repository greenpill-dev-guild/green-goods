/**
 * Conviction Voting Hook Tests
 * @vitest-environment jsdom
 *
 * Tests subgraph data mapping, query key construction, and address normalization
 * in the conviction voting query hooks.
 *
 * After the RPC → subgraph refactor, these hooks delegate to functions in
 * modules/data/gardens.ts. This file mocks that module boundary.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_CHAIN_ID = 11155111;
const TEST_POOL = "0x1111111111111111111111111111111111111111";
const TEST_VOTER = "0x2222222222222222222222222222222222222222";
const TEST_GARDEN = "0x3333333333333333333333333333333333333333";
const TEST_COMMUNITY = "0x7777777777777777777777777777777777777777";

// Mock gardens subgraph data functions
const mockGetMemberPower = vi.fn();
const mockGetConvictionWeights = vi.fn();
const mockGetRegisteredHypercerts = vi.fn();
const mockGetConvictionStrategies = vi.fn();

vi.mock("../../../modules/data/gardens", () => ({
  getMemberPowerFromSubgraph: (...args: unknown[]) => mockGetMemberPower(...args),
  getConvictionWeightsFromSubgraph: (...args: unknown[]) => mockGetConvictionWeights(...args),
  getRegisteredHypercertsFromSubgraph: (...args: unknown[]) => mockGetRegisteredHypercerts(...args),
  getConvictionStrategiesFromSubgraph: (...args: unknown[]) => mockGetConvictionStrategies(...args),
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
  getWagmiConfig: () => ({}),
}));

// Mock garden-hats utility (useConvictionStrategies RPC fallback)
const mockFetchHatsModuleAddress = vi.fn();
vi.mock("../../../utils/blockchain/garden-hats", () => ({
  fetchHatsModuleAddress: (...args: unknown[]) => mockFetchHatsModuleAddress(...args),
}));

// Mock readContract for RPC fallback paths
const mockReadContract = vi.fn();
vi.mock("@wagmi/core", () => ({
  readContract: (...args: unknown[]) => mockReadContract(...args),
}));

import { useConvictionStrategies } from "../../../hooks/conviction/useConvictionStrategies";
import { useHypercertConviction } from "../../../hooks/conviction/useHypercertConviction";
import { useMemberVotingPower } from "../../../hooks/conviction/useMemberVotingPower";
import { useRegisteredHypercerts } from "../../../hooks/conviction/useRegisteredHypercerts";
import type { Address } from "../../../types/domain";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ============================================
// useMemberVotingPower
// ============================================

describe("useMemberVotingPower", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("maps subgraph MemberPower data correctly", async () => {
    mockGetMemberPower.mockResolvedValueOnce({
      totalStake: 500n,
      pointsBudget: 1000n,
      isEligible: true,
      allocations: [
        { hypercertId: 1n, amount: 100n },
        { hypercertId: 2n, amount: 200n },
        { hypercertId: 3n, amount: 300n },
      ],
    });

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

  it("passes normalized addresses to subgraph function", async () => {
    const mixedCasePool = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
    const mixedCaseVoter = "0x9876543210aBcDeF9876543210aBcDeF98765432";

    mockGetMemberPower.mockResolvedValueOnce({
      totalStake: 100n,
      pointsBudget: 500n,
      isEligible: true,
      allocations: [],
    });

    const { result } = renderHook(
      () => useMemberVotingPower(mixedCasePool as Address, mixedCaseVoter as Address),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetMemberPower).toHaveBeenCalledWith(
      mixedCasePool.toLowerCase(),
      mixedCaseVoter.toLowerCase(),
      TEST_CHAIN_ID
    );
  });

  it("returns default values when pool address is undefined", async () => {
    const { result } = renderHook(() => useMemberVotingPower(undefined, TEST_VOTER as Address), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockGetMemberPower).not.toHaveBeenCalled();
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

    expect(mockGetMemberPower).not.toHaveBeenCalled();
    expect(result.current.power.isEligible).toBe(false);
  });

  it("handles empty allocations from subgraph", async () => {
    mockGetMemberPower.mockResolvedValueOnce({
      totalStake: 0n,
      pointsBudget: 1000n,
      isEligible: false,
      allocations: [],
    });

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

    expect(mockGetMemberPower).not.toHaveBeenCalled();
  });

  it("returns default power on subgraph error", async () => {
    mockGetMemberPower.mockRejectedValueOnce(new Error("Subgraph error"));

    const { result } = renderHook(
      () => useMemberVotingPower(TEST_POOL as Address, TEST_VOTER as Address),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.power).toEqual({
      totalStake: 0n,
      pointsBudget: 0n,
      isEligible: false,
      allocations: [],
    });
  });
});

// ============================================
// useHypercertConviction
// ============================================

describe("useHypercertConviction", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("maps subgraph ConvictionWeight data correctly", async () => {
    mockGetConvictionWeights.mockResolvedValueOnce([
      { hypercertId: 10n, weight: 500n },
      { hypercertId: 20n, weight: 1500n },
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

  it("passes normalized pool address to subgraph", async () => {
    const mixedCase = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
    mockGetConvictionWeights.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useHypercertConviction(mixedCase as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetConvictionWeights).toHaveBeenCalledWith(mixedCase.toLowerCase(), TEST_CHAIN_ID);
  });

  it("returns empty weights when pool address is undefined", () => {
    const { result } = renderHook(() => useHypercertConviction(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockGetConvictionWeights).not.toHaveBeenCalled();
    expect(result.current.weights).toEqual([]);
  });

  it("returns empty weights on subgraph error", async () => {
    mockGetConvictionWeights.mockRejectedValueOnce(new Error("Subgraph timeout"));

    const { result } = renderHook(() => useHypercertConviction(TEST_POOL as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.weights).toEqual([]);
  });

  it("handles single weight result", async () => {
    mockGetConvictionWeights.mockResolvedValueOnce([{ hypercertId: 42n, weight: 9999n }]);

    const { result } = renderHook(() => useHypercertConviction(TEST_POOL as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.weights).toHaveLength(1);
    expect(result.current.weights[0].hypercertId).toBe(42n);
  });
});

// ============================================
// useRegisteredHypercerts
// ============================================

describe("useRegisteredHypercerts", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("returns registered hypercert IDs from subgraph", async () => {
    mockGetRegisteredHypercerts.mockResolvedValueOnce([100n, 200n, 300n]);

    const { result } = renderHook(() => useRegisteredHypercerts(TEST_POOL as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.hypercertIds).toEqual([100n, 200n, 300n]);
  });

  it("passes normalized pool address to subgraph", async () => {
    const mixedCase = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
    mockGetRegisteredHypercerts.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useRegisteredHypercerts(mixedCase as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetRegisteredHypercerts).toHaveBeenCalledWith(
      mixedCase.toLowerCase(),
      TEST_CHAIN_ID
    );
  });

  it("returns empty array when pool address is undefined", () => {
    const { result } = renderHook(() => useRegisteredHypercerts(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockGetRegisteredHypercerts).not.toHaveBeenCalled();
    expect(result.current.hypercertIds).toEqual([]);
  });

  it("returns empty array on subgraph error", async () => {
    mockGetRegisteredHypercerts.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useRegisteredHypercerts(TEST_POOL as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.hypercertIds).toEqual([]);
  });

  it("handles empty proposals from subgraph", async () => {
    mockGetRegisteredHypercerts.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useRegisteredHypercerts(TEST_POOL as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hypercertIds).toEqual([]);
  });
});

// ============================================
// useConvictionStrategies
// ============================================

describe("useConvictionStrategies", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("returns strategy addresses from subgraph", async () => {
    mockGetConvictionStrategies.mockResolvedValueOnce([TEST_POOL]);

    const { result } = renderHook(
      () => useConvictionStrategies(TEST_GARDEN as Address, TEST_COMMUNITY as Address),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.strategies).toEqual([TEST_POOL]);
  });

  it("passes normalized community address to subgraph", async () => {
    const mixedCaseCommunity = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
    mockGetConvictionStrategies.mockResolvedValueOnce([]);

    const { result } = renderHook(
      () => useConvictionStrategies(TEST_GARDEN as Address, mixedCaseCommunity as Address),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetConvictionStrategies).toHaveBeenCalledWith(
      mixedCaseCommunity.toLowerCase(),
      TEST_CHAIN_ID
    );
  });

  it("returns empty strategies when garden address is undefined", () => {
    const { result } = renderHook(() => useConvictionStrategies(undefined, undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockGetConvictionStrategies).not.toHaveBeenCalled();
    expect(result.current.strategies).toEqual([]);
  });

  it("falls back to RPC when community address is undefined", async () => {
    // Without community address, uses HatsModule RPC fallback
    mockFetchHatsModuleAddress.mockResolvedValueOnce("0x4444444444444444444444444444444444444444");
    mockReadContract.mockResolvedValueOnce([TEST_POOL]);

    const { result } = renderHook(() => useConvictionStrategies(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetConvictionStrategies).not.toHaveBeenCalled();
    expect(mockFetchHatsModuleAddress).toHaveBeenCalled();
    expect(result.current.strategies).toEqual([TEST_POOL]);
  });

  it("returns empty strategies via RPC when no HatsModule configured", async () => {
    mockFetchHatsModuleAddress.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useConvictionStrategies(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.strategies).toEqual([]);
    expect(mockReadContract).not.toHaveBeenCalled();
  });

  it("returns empty on subgraph error", async () => {
    mockGetConvictionStrategies.mockRejectedValueOnce(new Error("Subgraph unavailable"));

    const { result } = renderHook(
      () => useConvictionStrategies(TEST_GARDEN as Address, TEST_COMMUNITY as Address),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.strategies).toEqual([]);
  });

  it("filters to only enabled strategies", async () => {
    // The subgraph function already filters enabled, but verify the hook returns what it gets
    mockGetConvictionStrategies.mockResolvedValueOnce([
      TEST_POOL,
      "0x5555555555555555555555555555555555555555",
    ]);

    const { result } = renderHook(
      () => useConvictionStrategies(TEST_GARDEN as Address, TEST_COMMUNITY as Address),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.strategies).toHaveLength(2);
  });
});
