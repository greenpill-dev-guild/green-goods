/**
 * Garden Community & Pools Hook Tests
 * @vitest-environment jsdom
 *
 * Tests useGardenCommunity and useGardenPools hooks after the subgraph refactor.
 * These hooks use a dual-path pattern:
 * - When communityAddress is provided (via options), uses subgraph (fast path)
 * - Otherwise falls back to RPC via fetchGardensModuleAddress + readContract
 *
 * useGardenCommunity additionally enriches subgraph results with on-chain
 * weightScheme via RPC (not available in subgraph).
 *
 * Covers:
 * - Subgraph fast path with communityAddress
 * - RPC fallback without communityAddress
 * - Subgraph + RPC enrichment for GardenCommunity
 * - Address normalization, disabled guards, error handling
 * - Weight scheme and pool type mapping
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x3333333333333333333333333333333333333333";
const TEST_GARDENS_MODULE = "0x6666666666666666666666666666666666666666";
const TEST_COMMUNITY = "0x7777777777777777777777777777777777777777";
const TEST_GOODS_TOKEN = "0x9999999999999999999999999999999999999999";
const TEST_POOL_1 = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TEST_POOL_2 = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

// Mock gardens subgraph data functions
const mockGetGardenCommunity = vi.fn();
const mockGetGardenPools = vi.fn();

vi.mock("../../../modules/data/gardens", () => ({
  getGardenCommunityFromSubgraph: (...args: unknown[]) => mockGetGardenCommunity(...args),
  getGardenPoolsFromSubgraph: (...args: unknown[]) => mockGetGardenPools(...args),
}));

// Mock garden-modules utility (RPC fallback path)
const mockFetchGardensModuleAddress = vi.fn();
vi.mock("../../../utils/blockchain/garden-modules", () => ({
  fetchGardensModuleAddress: (...args: unknown[]) => mockFetchGardensModuleAddress(...args),
}));

// Mock readContract (RPC fallback + enrichment)
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

import { useGardenCommunity } from "../../../hooks/conviction/useGardenCommunity";
import { useGardenPools } from "../../../hooks/conviction/useGardenPools";
import { WeightScheme } from "../../../types/gardens-community";
import type { Address } from "../../../types/domain";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ============================================
// useGardenCommunity — subgraph path
// ============================================

describe("useGardenCommunity — subgraph path", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("maps subgraph data to GardenCommunity type with RPC enrichment", async () => {
    // Subgraph returns base data
    mockGetGardenCommunity.mockResolvedValueOnce({
      gardenAddress: TEST_GARDEN.toLowerCase() as Address,
      communityAddress: TEST_COMMUNITY as Address,
      goodsTokenAddress: TEST_GOODS_TOKEN as Address,
      weightScheme: WeightScheme.Linear,
      stakeAmount: 1000000000000000000n,
    });
    // RPC enrichment: fetchGardensModuleAddress + readContract for weightScheme
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract.mockResolvedValueOnce(1); // getGardenWeightScheme (Exponential)

    const { result } = renderHook(
      () =>
        useGardenCommunity(TEST_GARDEN as Address, {
          communityAddress: TEST_COMMUNITY as Address,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.community).not.toBeNull();
    expect(result.current.community?.communityAddress).toBe(TEST_COMMUNITY);
    // Enriched from RPC
    expect(result.current.community?.weightScheme).toBe(WeightScheme.Exponential);
    expect(result.current.community?.goodsTokenAddress).toBe(TEST_GOODS_TOKEN);
    expect(result.current.community?.stakeAmount).toBe(1000000000000000000n);
  });

  it("returns null when garden address is undefined", () => {
    const { result } = renderHook(() => useGardenCommunity(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockGetGardenCommunity).not.toHaveBeenCalled();
    expect(result.current.community).toBeNull();
  });

  it("returns null when subgraph returns null (no community found)", async () => {
    mockGetGardenCommunity.mockResolvedValueOnce(null);

    const { result } = renderHook(
      () =>
        useGardenCommunity(TEST_GARDEN as Address, {
          communityAddress: TEST_COMMUNITY as Address,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.community).toBeNull();
  });

  it("respects enabled option", () => {
    renderHook(
      () =>
        useGardenCommunity(TEST_GARDEN as Address, {
          communityAddress: TEST_COMMUNITY as Address,
          enabled: false,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    expect(mockGetGardenCommunity).not.toHaveBeenCalled();
  });

  it("normalizes garden address before subgraph query", async () => {
    const mixedCase = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
    mockGetGardenCommunity.mockResolvedValueOnce({
      gardenAddress: mixedCase.toLowerCase() as Address,
      communityAddress: TEST_COMMUNITY as Address,
      goodsTokenAddress: TEST_GOODS_TOKEN as Address,
      weightScheme: WeightScheme.Linear,
      stakeAmount: 1000000000000000000n,
    });
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract.mockResolvedValueOnce(0);

    const { result } = renderHook(
      () =>
        useGardenCommunity(mixedCase as Address, {
          communityAddress: TEST_COMMUNITY as Address,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetGardenCommunity).toHaveBeenCalledWith(
      TEST_COMMUNITY,
      mixedCase.toLowerCase(),
      TEST_CHAIN_ID
    );
  });

  it("returns null on subgraph error", async () => {
    mockGetGardenCommunity.mockRejectedValueOnce(new Error("Subgraph error"));

    const { result } = renderHook(
      () =>
        useGardenCommunity(TEST_GARDEN as Address, {
          communityAddress: TEST_COMMUNITY as Address,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.community).toBeNull();
  });

  it("includes gardenAddress in returned community", async () => {
    mockGetGardenCommunity.mockResolvedValueOnce({
      gardenAddress: TEST_GARDEN.toLowerCase() as Address,
      communityAddress: TEST_COMMUNITY as Address,
      goodsTokenAddress: TEST_GOODS_TOKEN as Address,
      weightScheme: WeightScheme.Linear,
      stakeAmount: 1000000000000000000n,
    });
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract.mockResolvedValueOnce(1); // getGardenWeightScheme

    const { result } = renderHook(
      () =>
        useGardenCommunity(TEST_GARDEN as Address, {
          communityAddress: TEST_COMMUNITY as Address,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.community?.gardenAddress).toBe(TEST_GARDEN.toLowerCase());
  });
});

// ============================================
// useGardenCommunity — RPC fallback path
// ============================================

describe("useGardenCommunity — RPC fallback", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("assembles GardenCommunity from RPC when no communityAddress", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract
      .mockResolvedValueOnce(TEST_COMMUNITY) // getGardenCommunity
      .mockResolvedValueOnce(1) // getGardenWeightScheme (Exponential)
      .mockResolvedValueOnce(TEST_GOODS_TOKEN) // goodsToken
      .mockResolvedValueOnce(1000000000000000000n); // stakeAmountPerMember

    const { result } = renderHook(() => useGardenCommunity(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetGardenCommunity).not.toHaveBeenCalled();
    expect(result.current.community).not.toBeNull();
    expect(result.current.community?.communityAddress).toBe(TEST_COMMUNITY);
    expect(result.current.community?.weightScheme).toBe(1);
  });

  it("returns null when no GardensModule is configured (RPC fallback)", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useGardenCommunity(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.community).toBeNull();
    expect(mockReadContract).not.toHaveBeenCalled();
  });

  it("maps Linear weight scheme (0) correctly via RPC", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract
      .mockResolvedValueOnce(TEST_COMMUNITY)
      .mockResolvedValueOnce(0) // Linear
      .mockResolvedValueOnce(TEST_GOODS_TOKEN)
      .mockResolvedValueOnce(1000000000000000000n);

    const { result } = renderHook(() => useGardenCommunity(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.community?.weightScheme).toBe(0);
  });

  it("maps Power weight scheme (2) correctly via RPC", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract
      .mockResolvedValueOnce(TEST_COMMUNITY)
      .mockResolvedValueOnce(2) // Power
      .mockResolvedValueOnce(TEST_GOODS_TOKEN)
      .mockResolvedValueOnce(500000000000000000n);

    const { result } = renderHook(() => useGardenCommunity(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.community?.weightScheme).toBe(2);
    expect(result.current.community?.stakeAmount).toBe(500000000000000000n);
  });

  it("returns isError when RPC readContract rejects", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract.mockRejectedValueOnce(new Error("RPC error"));

    const { result } = renderHook(() => useGardenCommunity(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.community).toBeNull();
  });
});

// ============================================
// useGardenPools — subgraph path
// ============================================

describe("useGardenPools — subgraph path", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("returns annotated signal pools from subgraph", async () => {
    mockGetGardenPools.mockResolvedValueOnce([
      {
        poolAddress: TEST_POOL_1,
        poolType: 0,
        gardenAddress: TEST_GARDEN.toLowerCase(),
        communityAddress: TEST_COMMUNITY,
      },
      {
        poolAddress: TEST_POOL_2,
        poolType: 1,
        gardenAddress: TEST_GARDEN.toLowerCase(),
        communityAddress: TEST_COMMUNITY,
      },
    ]);

    const { result } = renderHook(
      () =>
        useGardenPools(TEST_GARDEN as Address, {
          communityAddress: TEST_COMMUNITY as Address,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.pools).toHaveLength(2);
    expect(result.current.pools[0].poolAddress).toBe(TEST_POOL_1);
    expect(result.current.pools[0].poolType).toBe(0);
    expect(result.current.pools[1].poolAddress).toBe(TEST_POOL_2);
    expect(result.current.pools[1].poolType).toBe(1);
    expect(result.current.pools[0].gardenAddress).toBe(TEST_GARDEN.toLowerCase());
    expect(result.current.pools[0].communityAddress).toBe(TEST_COMMUNITY);
  });

  it("returns empty array when garden address is undefined", () => {
    const { result } = renderHook(() => useGardenPools(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockGetGardenPools).not.toHaveBeenCalled();
    expect(result.current.pools).toEqual([]);
  });

  it("returns empty array on subgraph error", async () => {
    mockGetGardenPools.mockRejectedValueOnce(new Error("Subgraph error"));

    const { result } = renderHook(
      () =>
        useGardenPools(TEST_GARDEN as Address, {
          communityAddress: TEST_COMMUNITY as Address,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.pools).toEqual([]);
  });

  it("handles empty pool list from subgraph", async () => {
    mockGetGardenPools.mockResolvedValueOnce([]);

    const { result } = renderHook(
      () =>
        useGardenPools(TEST_GARDEN as Address, {
          communityAddress: TEST_COMMUNITY as Address,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.pools).toEqual([]);
  });

  it("assigns Hypercert type to single pool at index 0", async () => {
    mockGetGardenPools.mockResolvedValueOnce([
      {
        poolAddress: TEST_POOL_1,
        poolType: 0,
        gardenAddress: TEST_GARDEN.toLowerCase(),
        communityAddress: TEST_COMMUNITY,
      },
    ]);

    const { result } = renderHook(
      () =>
        useGardenPools(TEST_GARDEN as Address, {
          communityAddress: TEST_COMMUNITY as Address,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.pools).toHaveLength(1);
    expect(result.current.pools[0].poolType).toBe(0);
  });

  it("normalizes garden address before subgraph query", async () => {
    const mixedCase = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
    mockGetGardenPools.mockResolvedValueOnce([
      {
        poolAddress: TEST_POOL_1,
        poolType: 0,
        gardenAddress: mixedCase.toLowerCase(),
        communityAddress: TEST_COMMUNITY,
      },
    ]);

    const { result } = renderHook(
      () =>
        useGardenPools(mixedCase as Address, {
          communityAddress: TEST_COMMUNITY as Address,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetGardenPools).toHaveBeenCalledWith(
      TEST_COMMUNITY,
      mixedCase.toLowerCase(),
      TEST_CHAIN_ID
    );
    expect(result.current.pools[0].gardenAddress).toBe(mixedCase.toLowerCase());
  });

  it("respects enabled option", () => {
    renderHook(
      () =>
        useGardenPools(TEST_GARDEN as Address, {
          communityAddress: TEST_COMMUNITY as Address,
          enabled: false,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    expect(mockGetGardenPools).not.toHaveBeenCalled();
  });
});

// ============================================
// useGardenPools — RPC fallback path
// ============================================

describe("useGardenPools — RPC fallback", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("returns pools via RPC when no communityAddress", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract
      .mockResolvedValueOnce([TEST_POOL_1, TEST_POOL_2]) // getGardenSignalPools
      .mockResolvedValueOnce(TEST_COMMUNITY); // getGardenCommunity

    const { result } = renderHook(() => useGardenPools(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetGardenPools).not.toHaveBeenCalled();
    expect(result.current.pools).toHaveLength(2);
    expect(result.current.pools[0].poolType).toBe(0);
    expect(result.current.pools[1].poolType).toBe(1);
    expect(result.current.pools[0].communityAddress).toBe(TEST_COMMUNITY);
  });

  it("returns empty when no GardensModule configured (RPC fallback)", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useGardenPools(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.pools).toEqual([]);
  });

  it("returns isError when RPC rejects", async () => {
    mockFetchGardensModuleAddress.mockResolvedValueOnce(TEST_GARDENS_MODULE);
    mockReadContract.mockRejectedValueOnce(new Error("RPC error"));

    const { result } = renderHook(() => useGardenPools(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.pools).toEqual([]);
  });

  it("normalizes garden address in RPC path", async () => {
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
});
