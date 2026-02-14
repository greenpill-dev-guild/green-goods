/**
 * Garden Community & Pools Hook Tests
 * @vitest-environment jsdom
 *
 * Tests useGardenCommunity and useGardenPools hooks:
 * - GardensModule resolution via GardenToken
 * - Multi-call data assembly
 * - Address normalization
 * - Disabled/undefined guard behavior
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_CHAIN_ID = 84532;
const TEST_GARDEN = "0x3333333333333333333333333333333333333333";
const TEST_GARDENS_MODULE = "0x6666666666666666666666666666666666666666";
const TEST_COMMUNITY = "0x7777777777777777777777777777777777777777";
const TEST_POWER_REGISTRY = "0x8888888888888888888888888888888888888888";
const TEST_GOODS_TOKEN = "0x9999999999999999999999999999999999999999";
const TEST_POOL_1 = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TEST_POOL_2 = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

// Mock wagmi core readContract
const mockReadContract = vi.fn();
vi.mock("@wagmi/core", () => ({
  readContract: (...args: unknown[]) => mockReadContract(...args),
}));

// Mock wagmi
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

// Mock garden-modules utility
const mockFetchGardensModuleAddress = vi.fn();
vi.mock("../../../utils/blockchain/garden-modules", () => ({
  fetchGardensModuleAddress: (...args: unknown[]) => mockFetchGardensModuleAddress(...args),
}));

import { useGardenCommunity } from "../../../hooks/conviction/useGardenCommunity";
import { useGardenPools } from "../../../hooks/conviction/useGardenPools";
import type { Address } from "../../../types/domain";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useGardenCommunity", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("assembles GardenCommunity from multiple readContract calls", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract
      .mockResolvedValueOnce(TEST_COMMUNITY) // getGardenCommunity
      .mockResolvedValueOnce(1) // getGardenWeightScheme (Exponential)
      .mockResolvedValueOnce(TEST_POWER_REGISTRY) // getGardenPowerRegistry
      .mockResolvedValueOnce(TEST_GOODS_TOKEN) // goodsToken
      .mockResolvedValueOnce(1000000000000000000n); // STAKE_AMOUNT_PER_MEMBER (1e18)

    const { result } = renderHook(() => useGardenCommunity(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.community).not.toBeNull();
    expect(result.current.community?.communityAddress).toBe(TEST_COMMUNITY);
    expect(result.current.community?.weightScheme).toBe(1); // Exponential
    expect(result.current.community?.powerRegistryAddress).toBe(TEST_POWER_REGISTRY);
    expect(result.current.community?.goodsTokenAddress).toBe(TEST_GOODS_TOKEN);
    expect(result.current.community?.stakeAmount).toBe(1000000000000000000n);
  });

  it("returns null when garden address is undefined", () => {
    const { result } = renderHook(() => useGardenCommunity(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockFetchGardensModuleAddress).not.toHaveBeenCalled();
    expect(result.current.community).toBeNull();
  });

  it("returns null when no GardensModule is configured", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useGardenCommunity(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.community).toBeNull();
    expect(mockReadContract).not.toHaveBeenCalled();
  });

  it("respects enabled option", () => {
    renderHook(() => useGardenCommunity(TEST_GARDEN as Address, { enabled: false }), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockFetchGardensModuleAddress).not.toHaveBeenCalled();
  });

  it("normalizes garden address before lookup", async () => {
    const mixedCase = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract
      .mockResolvedValueOnce(TEST_COMMUNITY)
      .mockResolvedValueOnce(0) // Linear
      .mockResolvedValueOnce(TEST_POWER_REGISTRY)
      .mockResolvedValueOnce(TEST_GOODS_TOKEN)
      .mockResolvedValueOnce(1000000000000000000n);

    const { result } = renderHook(() => useGardenCommunity(mixedCase as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetchGardensModuleAddress).toHaveBeenCalledWith(
      mixedCase.toLowerCase(),
      TEST_CHAIN_ID
    );
  });
});

describe("useGardenPools", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("returns annotated signal pools with pool types", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract
      .mockResolvedValueOnce([TEST_POOL_1, TEST_POOL_2]) // getGardenSignalPools
      .mockResolvedValueOnce(TEST_COMMUNITY); // getGardenCommunity

    const { result } = renderHook(() => useGardenPools(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.pools).toHaveLength(2);
    expect(result.current.pools[0].poolAddress).toBe(TEST_POOL_1);
    expect(result.current.pools[0].poolType).toBe(0); // Hypercert
    expect(result.current.pools[1].poolAddress).toBe(TEST_POOL_2);
    expect(result.current.pools[1].poolType).toBe(1); // Action
    expect(result.current.pools[0].gardenAddress).toBe(TEST_GARDEN.toLowerCase());
    expect(result.current.pools[0].communityAddress).toBe(TEST_COMMUNITY);
  });

  it("returns empty array when garden address is undefined", () => {
    const { result } = renderHook(() => useGardenPools(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockFetchGardensModuleAddress).not.toHaveBeenCalled();
    expect(result.current.pools).toEqual([]);
  });

  it("returns empty array when no GardensModule is configured", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useGardenPools(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.pools).toEqual([]);
  });

  it("handles empty pool list", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract
      .mockResolvedValueOnce([]) // empty pools
      .mockResolvedValueOnce(TEST_COMMUNITY);

    const { result } = renderHook(() => useGardenPools(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.pools).toEqual([]);
  });

  it("assigns Hypercert type to single pool at index 0", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract
      .mockResolvedValueOnce([TEST_POOL_1]) // single pool
      .mockResolvedValueOnce(TEST_COMMUNITY);

    const { result } = renderHook(() => useGardenPools(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.pools).toHaveLength(1);
    expect(result.current.pools[0].poolType).toBe(0); // Hypercert
  });

  it("normalizes garden address before lookup", async () => {
    const mixedCase = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract.mockResolvedValueOnce([TEST_POOL_1]).mockResolvedValueOnce(TEST_COMMUNITY);

    const { result } = renderHook(() => useGardenPools(mixedCase as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetchGardensModuleAddress).toHaveBeenCalledWith(
      mixedCase.toLowerCase(),
      TEST_CHAIN_ID
    );
    expect(result.current.pools[0].gardenAddress).toBe(mixedCase.toLowerCase());
  });

  it("respects enabled option", () => {
    renderHook(() => useGardenPools(TEST_GARDEN as Address, { enabled: false }), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockFetchGardensModuleAddress).not.toHaveBeenCalled();
  });

  it("returns isError when readContract rejects", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract.mockRejectedValueOnce(new Error("RPC error"));

    const { result } = renderHook(() => useGardenPools(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.pools).toEqual([]);
  });
});

describe("useGardenCommunity — additional coverage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("maps Linear weight scheme (0) correctly", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract
      .mockResolvedValueOnce(TEST_COMMUNITY)
      .mockResolvedValueOnce(0) // Linear
      .mockResolvedValueOnce(TEST_POWER_REGISTRY)
      .mockResolvedValueOnce(TEST_GOODS_TOKEN)
      .mockResolvedValueOnce(1000000000000000000n);

    const { result } = renderHook(() => useGardenCommunity(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.community?.weightScheme).toBe(0); // Linear
  });

  it("maps Power weight scheme (2) correctly", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract
      .mockResolvedValueOnce(TEST_COMMUNITY)
      .mockResolvedValueOnce(2) // Power
      .mockResolvedValueOnce(TEST_POWER_REGISTRY)
      .mockResolvedValueOnce(TEST_GOODS_TOKEN)
      .mockResolvedValueOnce(500000000000000000n);

    const { result } = renderHook(() => useGardenCommunity(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.community?.weightScheme).toBe(2); // Power
    expect(result.current.community?.stakeAmount).toBe(500000000000000000n);
  });

  it("returns isError when readContract rejects", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract.mockRejectedValueOnce(new Error("RPC error"));

    const { result } = renderHook(() => useGardenCommunity(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.community).toBeNull();
  });

  it("includes gardenAddress in returned community", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract
      .mockResolvedValueOnce(TEST_COMMUNITY)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(TEST_POWER_REGISTRY)
      .mockResolvedValueOnce(TEST_GOODS_TOKEN)
      .mockResolvedValueOnce(1000000000000000000n);

    const { result } = renderHook(() => useGardenCommunity(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.community?.gardenAddress).toBe(TEST_GARDEN.toLowerCase());
  });
});
