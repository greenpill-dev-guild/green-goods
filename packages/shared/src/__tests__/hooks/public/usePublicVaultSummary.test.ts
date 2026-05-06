/**
 * usePublicVaultSummary Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Address } from "../../../types/domain";
import type { YieldAllocation } from "../../../types/gardens-community";
import type { GardenVault } from "../../../types/vaults";

const WETH = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";
const DAI = "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1";
const GARDEN_A = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN_B = "0x3333333333333333333333333333333333333333" as Address;

const {
  mockGetAllYieldAllocations,
  mockUseGardenVaults,
  mockUseHarvestableYield,
  mockUseStrategyRate,
} = vi.hoisted(() => ({
  mockGetAllYieldAllocations: vi.fn(),
  mockUseGardenVaults: vi.fn(),
  mockUseHarvestableYield: vi.fn(),
  mockUseStrategyRate: vi.fn(),
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 42161,
}));

vi.mock("../../../hooks/vault/useGardenVaults", () => ({
  useGardenVaults: (...args: unknown[]) => mockUseGardenVaults(...args),
}));

vi.mock("../../../hooks/vault/useHarvestableYield", () => ({
  useHarvestableYield: (...args: unknown[]) => mockUseHarvestableYield(...args),
}));

vi.mock("../../../hooks/vault/useStrategyRate", () => ({
  useStrategyRate: (...args: unknown[]) => mockUseStrategyRate(...args),
}));

vi.mock("../../../modules/data/yield-allocations", () => ({
  getAllYieldAllocations: (...args: unknown[]) => mockGetAllYieldAllocations(...args),
}));

const { usePublicVaultSummary } = await import("../../../hooks/public/usePublicVaultSummary");

function vault(overrides: Partial<GardenVault>): GardenVault {
  return {
    id: "vault",
    chainId: 42161,
    garden: GARDEN_A,
    asset: WETH,
    vaultAddress: "0x2222222222222222222222222222222222222222",
    totalDeposited: 0n,
    totalWithdrawn: 0n,
    totalHarvestCount: 0,
    donationAddress: null,
    depositorCount: 0,
    paused: false,
    createdAt: 0,
    ...overrides,
  } as GardenVault;
}

function allocation(overrides: Partial<YieldAllocation>): YieldAllocation {
  return {
    gardenAddress: GARDEN_A,
    assetAddress: DAI as Address,
    cookieJarAmount: 0n,
    fractionsAmount: 0n,
    juiceboxAmount: 0n,
    totalAmount: 0n,
    timestamp: 1,
    txHash: "0xhash",
    ...overrides,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function TestWrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("usePublicVaultSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllYieldAllocations.mockResolvedValue([]);
    mockUseGardenVaults.mockReturnValue({ vaults: [], isLoading: false, isError: false });
    mockUseHarvestableYield.mockReturnValue({
      entries: [],
      total: 0n,
      isLoading: false,
      isError: false,
    });
    mockUseStrategyRate.mockReturnValue({
      apr: undefined,
      apy: undefined,
      isLoading: false,
      isError: false,
    });
  });

  it("aggregates DAI and ETH vault totals and accrued yield across the network and by Garden", async () => {
    mockUseGardenVaults.mockReturnValue({
      vaults: [
        vault({
          id: "weth-vault",
          garden: GARDEN_A,
          asset: WETH,
          vaultAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          totalDeposited: 1_000n,
          totalWithdrawn: 100n,
        }),
        vault({
          id: "dai-vault-a",
          garden: GARDEN_A,
          asset: DAI,
          vaultAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          totalDeposited: 2_000n,
        }),
        vault({
          id: "dai-vault-b",
          garden: GARDEN_B,
          asset: DAI,
          vaultAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
          totalDeposited: 1_000n,
        }),
      ],
      isLoading: false,
      isError: false,
    });
    mockUseHarvestableYield.mockReturnValue({
      entries: [
        {
          vaultAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          assetAddress: WETH,
          harvestable: 5n,
        },
        {
          vaultAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          assetAddress: DAI,
          harvestable: 3n,
        },
      ],
      total: 8n,
      isLoading: false,
      isError: false,
    });
    mockGetAllYieldAllocations.mockResolvedValue([
      allocation({ gardenAddress: GARDEN_A, assetAddress: WETH as Address, totalAmount: 7n }),
      allocation({ gardenAddress: GARDEN_A, assetAddress: DAI as Address, totalAmount: 11n }),
      allocation({ gardenAddress: GARDEN_B, assetAddress: DAI as Address, totalAmount: 13n }),
    ]);
    mockUseStrategyRate.mockImplementation((assetAddress?: string) => ({
      apr: assetAddress?.toLowerCase() === WETH ? 2.25 : 5.5,
      apy: undefined,
      isLoading: false,
      isError: false,
    }));

    const { result } = renderHook(() => usePublicVaultSummary(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isAllocationLoading).toBe(false));

    expect(result.current.hasVaults).toBe(true);
    expect(result.current.assets.map((asset) => asset.symbol)).toEqual(["DAI", "ETH"]);
    expect(result.current.assets[0]).toMatchObject({
      symbol: "DAI",
      netDeposited: 3_000n,
      accruingYield: 3n,
      currentValue: 3_003n,
      allocatedYield: 24n,
      accruedYield: 27n,
      apr: 5.5,
    });
    expect(result.current.assets[1]).toMatchObject({
      symbol: "ETH",
      netDeposited: 900n,
      accruingYield: 5n,
      currentValue: 905n,
      allocatedYield: 7n,
      accruedYield: 12n,
      apr: 2.25,
    });

    expect(result.current.gardensByAddress[GARDEN_A.toLowerCase()].assets[0]).toMatchObject({
      symbol: "DAI",
      currentValue: 2_003n,
      allocatedYield: 11n,
      accruedYield: 14n,
    });
    expect(result.current.gardensByAddress[GARDEN_A.toLowerCase()].assets[1]).toMatchObject({
      symbol: "ETH",
      currentValue: 905n,
      allocatedYield: 7n,
      accruedYield: 12n,
    });
  });

  it("keeps indexed totals when APR and live accruing reads are unavailable", async () => {
    mockUseGardenVaults.mockReturnValue({
      vaults: [
        vault({
          asset: WETH,
          totalDeposited: 1_000n,
        }),
      ],
      isLoading: false,
      isError: false,
    });
    mockUseHarvestableYield.mockReturnValue({
      entries: [],
      total: 0n,
      isLoading: false,
      isError: true,
    });
    mockGetAllYieldAllocations.mockResolvedValue([
      allocation({ assetAddress: WETH as Address, totalAmount: 9n }),
    ]);
    mockUseStrategyRate.mockReturnValue({
      apr: undefined,
      apy: undefined,
      isLoading: false,
      isError: true,
    });

    const { result } = renderHook(() => usePublicVaultSummary(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isAllocationLoading).toBe(false));

    expect(result.current.assets[0]).toMatchObject({
      symbol: "ETH",
      netDeposited: 1_000n,
      accruingYield: undefined,
      currentValue: 1_000n,
      allocatedYield: 9n,
      accruedYield: 9n,
      apr: undefined,
      isAprError: true,
    });
  });

  it("omits allocated and accrued yield when indexed allocation reads fail", async () => {
    mockUseGardenVaults.mockReturnValue({
      vaults: [
        vault({
          asset: DAI,
          totalDeposited: 2_000n,
        }),
      ],
      isLoading: false,
      isError: false,
    });
    mockUseHarvestableYield.mockReturnValue({
      entries: [
        {
          vaultAddress: "0x2222222222222222222222222222222222222222",
          assetAddress: DAI,
          harvestable: 4n,
        },
      ],
      total: 4n,
      isLoading: false,
      isError: false,
    });
    mockGetAllYieldAllocations.mockRejectedValue(new Error("indexer unavailable"));

    const { result } = renderHook(() => usePublicVaultSummary(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isAllocationError).toBe(true));

    expect(result.current.assets[0]).toMatchObject({
      symbol: "DAI",
      netDeposited: 2_000n,
      accruingYield: 4n,
      currentValue: 2_004n,
      allocatedYield: undefined,
      accruedYield: undefined,
    });
  });
});
