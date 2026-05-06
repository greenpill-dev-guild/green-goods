import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { queryKeys, STALE_TIME_MEDIUM } from "../../config/query-keys";
import { getAllYieldAllocations } from "../../modules/data/yield-allocations";
import type { Address } from "../../types/domain";
import type { YieldAllocation } from "../../types/gardens-community";
import type { GardenVault } from "../../types/vaults";
import {
  getNetDeposited,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
} from "../../utils/blockchain/vaults";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useGardenVaults } from "../vault/useGardenVaults";
import { useHarvestableYield } from "../vault/useHarvestableYield";
import { useStrategyRate } from "../vault/useStrategyRate";

export type PublicVaultSummaryAssetSymbol = "DAI" | "ETH";

export interface PublicVaultSummaryAsset {
  symbol: PublicVaultSummaryAssetSymbol;
  asset: Address;
  chainId: number;
  decimals: number;
  vaultCount: number;
  netDeposited: bigint;
  accruingYield: bigint | undefined;
  currentValue: bigint;
  allocatedYield: bigint | undefined;
  accruedYield: bigint | undefined;
  apr: number | undefined;
  apy: number | undefined;
  isAprLoading: boolean;
  isAprError: boolean;
}

export interface PublicGardenVaultSummary {
  garden: Address;
  hasVaults: boolean;
  assets: PublicVaultSummaryAsset[];
}

export interface PublicVaultSummary {
  hasVaults: boolean;
  isLoading: boolean;
  isError: boolean;
  isYieldLoading: boolean;
  isYieldError: boolean;
  isAllocationLoading: boolean;
  isAllocationError: boolean;
  assets: PublicVaultSummaryAsset[];
  gardensByAddress: Record<string, PublicGardenVaultSummary>;
}

interface AssetAccumulator {
  symbol: PublicVaultSummaryAssetSymbol;
  asset: Address;
  chainId: number;
  decimals: number;
  vaultCount: number;
  netDeposited: bigint;
  accruingYield: bigint | undefined;
}

interface YieldTotals {
  network: Map<PublicVaultSummaryAssetSymbol, bigint>;
  gardens: Map<string, Map<PublicVaultSummaryAssetSymbol, bigint>>;
}

const ASSET_ORDER: PublicVaultSummaryAssetSymbol[] = ["DAI", "ETH"];

export function usePublicVaultSummary(): PublicVaultSummary {
  const chainId = useCurrentChain();
  const vaultQuery = useGardenVaults(undefined);
  const vaults = vaultQuery.vaults;
  const harvestable = useHarvestableYield(vaults, { enabled: vaults.length > 0 });
  const allocationsQuery = useQuery({
    queryKey: queryKeys.yield.protocolSummary(chainId),
    queryFn: () => getAllYieldAllocations(chainId),
    enabled: vaults.length > 0,
    staleTime: STALE_TIME_MEDIUM,
  });

  const preferredAssets = useMemo(() => getPreferredAssets(vaults), [vaults]);
  const ethRate = useStrategyRate(preferredAssets.ETH?.asset, {
    chainId: preferredAssets.ETH?.chainId,
    enabled: Boolean(preferredAssets.ETH),
  });
  const daiRate = useStrategyRate(preferredAssets.DAI?.asset, {
    chainId: preferredAssets.DAI?.chainId,
    enabled: Boolean(preferredAssets.DAI),
  });

  const { assets, gardensByAddress } = useMemo(() => {
    const canUseLiveYield = !harvestable.isLoading && !harvestable.isError;
    const harvestableByVault = new Map<string, bigint>();
    if (canUseLiveYield) {
      for (const entry of harvestable.entries) {
        harvestableByVault.set(entry.vaultAddress.toLowerCase(), entry.harvestable);
      }
    }

    const hasAllocationData = Boolean(allocationsQuery.data) && !allocationsQuery.isError;
    const yieldTotals = hasAllocationData
      ? aggregateYieldAllocations(allocationsQuery.data ?? [], chainId)
      : undefined;

    const networkBySymbol = new Map<PublicVaultSummaryAssetSymbol, AssetAccumulator>();
    const gardenByAddress = new Map<string, Map<PublicVaultSummaryAssetSymbol, AssetAccumulator>>();

    for (const vault of vaults) {
      const symbol = getPublicVaultAssetSymbol(vault.asset, vault.chainId);
      if (!symbol) continue;

      const liveYield = canUseLiveYield
        ? (harvestableByVault.get(vault.vaultAddress.toLowerCase()) ?? 0n)
        : undefined;

      upsertVaultAccumulator(networkBySymbol, vault, symbol, liveYield);

      const gardenKey = vault.garden.toLowerCase();
      const gardenAssets = gardenByAddress.get(gardenKey) ?? new Map();
      upsertVaultAccumulator(gardenAssets, vault, symbol, liveYield);
      gardenByAddress.set(gardenKey, gardenAssets);
    }

    const networkAssets = finalizeAssets(networkBySymbol, yieldTotals?.network, (symbol) =>
      symbol === "ETH" ? ethRate : daiRate
    );

    const gardens: Record<string, PublicGardenVaultSummary> = {};
    for (const [garden, assetMap] of gardenByAddress.entries()) {
      const allocatedBySymbol = yieldTotals?.gardens.get(garden);
      const gardenAssets = finalizeAssets(assetMap, allocatedBySymbol, (symbol) =>
        symbol === "ETH" ? ethRate : daiRate
      );
      gardens[garden] = {
        garden: garden as Address,
        hasVaults: gardenAssets.length > 0,
        assets: gardenAssets,
      };
    }

    return { assets: networkAssets, gardensByAddress: gardens };
  }, [
    vaults,
    harvestable.entries,
    harvestable.isError,
    harvestable.isLoading,
    allocationsQuery.data,
    allocationsQuery.isError,
    chainId,
    ethRate,
    daiRate,
  ]);

  return {
    hasVaults: assets.length > 0,
    isLoading: vaultQuery.isLoading,
    isError: vaultQuery.isError,
    isYieldLoading: harvestable.isLoading,
    isYieldError: harvestable.isError,
    isAllocationLoading: allocationsQuery.isLoading,
    isAllocationError: allocationsQuery.isError,
    assets,
    gardensByAddress,
  };
}

function upsertVaultAccumulator(
  bySymbol: Map<PublicVaultSummaryAssetSymbol, AssetAccumulator>,
  vault: GardenVault,
  symbol: PublicVaultSummaryAssetSymbol,
  liveYield: bigint | undefined
) {
  const existing = bySymbol.get(symbol) ?? {
    symbol,
    asset: vault.asset,
    chainId: vault.chainId,
    decimals: getVaultAssetDecimals(vault.asset, vault.chainId),
    vaultCount: 0,
    netDeposited: 0n,
    accruingYield: liveYield === undefined ? undefined : 0n,
  };

  existing.vaultCount += 1;
  existing.netDeposited += getNetDeposited(vault.totalDeposited, vault.totalWithdrawn);
  if (liveYield !== undefined) {
    existing.accruingYield = (existing.accruingYield ?? 0n) + liveYield;
  }
  bySymbol.set(symbol, existing);
}

function finalizeAssets(
  bySymbol: Map<PublicVaultSummaryAssetSymbol, AssetAccumulator>,
  allocatedBySymbol: Map<PublicVaultSummaryAssetSymbol, bigint> | undefined,
  getRate: (symbol: PublicVaultSummaryAssetSymbol) => ReturnType<typeof useStrategyRate>
): PublicVaultSummaryAsset[] {
  return ASSET_ORDER.flatMap((symbol) => {
    const entry = bySymbol.get(symbol);
    if (!entry) return [];

    const allocatedYield = allocatedBySymbol?.get(symbol);
    const accruingYield = entry.accruingYield;
    const accruedYield =
      allocatedYield === undefined ? undefined : allocatedYield + (accruingYield ?? 0n);
    const rate = getRate(symbol);

    return {
      ...entry,
      currentValue: entry.netDeposited + (accruingYield ?? 0n),
      allocatedYield,
      accruedYield,
      apr: rate.apr,
      apy: rate.apy,
      isAprLoading: rate.isLoading,
      isAprError: rate.isError,
    };
  });
}

function aggregateYieldAllocations(allocations: YieldAllocation[], chainId: number): YieldTotals {
  const network = new Map<PublicVaultSummaryAssetSymbol, bigint>();
  const gardens = new Map<string, Map<PublicVaultSummaryAssetSymbol, bigint>>();

  for (const allocation of allocations) {
    const symbol = getPublicVaultAssetSymbol(allocation.assetAddress, chainId);
    if (!symbol) continue;

    network.set(symbol, (network.get(symbol) ?? 0n) + allocation.totalAmount);

    const gardenKey = allocation.gardenAddress.toLowerCase();
    const gardenTotals = gardens.get(gardenKey) ?? new Map();
    gardenTotals.set(symbol, (gardenTotals.get(symbol) ?? 0n) + allocation.totalAmount);
    gardens.set(gardenKey, gardenTotals);
  }

  return { network, gardens };
}

function getPreferredAssets(vaults: readonly GardenVault[]) {
  const preferred: Partial<
    Record<PublicVaultSummaryAssetSymbol, Pick<GardenVault, "asset" | "chainId">>
  > = {};
  for (const vault of vaults) {
    const symbol = getPublicVaultAssetSymbol(vault.asset, vault.chainId);
    if (symbol && !preferred[symbol]) {
      preferred[symbol] = { asset: vault.asset, chainId: vault.chainId };
    }
  }
  return preferred;
}

function getPublicVaultAssetSymbol(
  asset: string,
  chainId: number
): PublicVaultSummaryAssetSymbol | undefined {
  const symbol = getVaultAssetSymbol(asset, chainId);
  if (symbol === "DAI") return "DAI";
  if (symbol === "WETH") return "ETH";
  return undefined;
}
