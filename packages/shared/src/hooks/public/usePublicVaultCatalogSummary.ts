import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { yieldKeys } from "../../config/query-keys/vault";
import { getAllYieldAllocations } from "../../modules/data/yield-allocations";
import type { Address } from "../../types/domain";
import type { YieldAllocation } from "../../types/gardens-community";
import type { GardenVault } from "../../types/vaults";
import {
  getNetDeposited,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
} from "../../utils/blockchain/vaults";
import { useGardenVaults } from "../vault/useGardenVaults";
import type {
  PublicGardenVaultSummary,
  PublicVaultSummary,
  PublicVaultSummaryAsset,
  PublicVaultSummaryAssetSymbol,
} from "./usePublicVaultSummary";

const ASSET_ORDER: PublicVaultSummaryAssetSymbol[] = ["DAI", "ETH"];

interface CatalogAccumulator {
  symbol: PublicVaultSummaryAssetSymbol;
  asset: Address;
  chainId: number;
  decimals: number;
  vaultCount: number;
  depositorCount: number;
  netDeposited: bigint;
}

/**
 * Public, provider-free vault summary.
 *
 * This deliberately uses indexed records only, so editorial routes can render
 * useful balances and allocation totals without booting Wagmi or a wallet UI.
 * Live strategy APR and harvestable yield remain optional wallet-island data.
 */
export function usePublicVaultCatalogSummary(): PublicVaultSummary {
  const chainId = DEFAULT_CHAIN_ID;
  const vaultQuery = useGardenVaults(undefined, { chainId });
  const vaults = vaultQuery.vaults;
  const allocationsQuery = useQuery({
    queryKey: yieldKeys.protocolSummary(chainId),
    queryFn: () => getAllYieldAllocations(chainId),
    enabled: vaults.length > 0,
    staleTime: STALE_TIME_MEDIUM,
  });

  const { assets, gardensByAddress } = useMemo(() => {
    const hasAllocationData = Boolean(allocationsQuery.data) && !allocationsQuery.isError;
    const allocations = hasAllocationData
      ? aggregateYieldAllocations(allocationsQuery.data ?? [], chainId)
      : undefined;
    const network = new Map<PublicVaultSummaryAssetSymbol, CatalogAccumulator>();
    const byGarden = new Map<string, Map<PublicVaultSummaryAssetSymbol, CatalogAccumulator>>();

    for (const vault of vaults) {
      const symbol = getPublicVaultAssetSymbol(vault.asset, vault.chainId);
      if (!symbol) continue;
      upsertCatalogAccumulator(network, vault, symbol);

      const gardenKey = vault.garden.toLowerCase();
      const gardenAssets = byGarden.get(gardenKey) ?? new Map();
      upsertCatalogAccumulator(gardenAssets, vault, symbol);
      byGarden.set(gardenKey, gardenAssets);
    }

    const publicAssets = finalizeCatalogAssets(network, allocations?.network, hasAllocationData);
    const publicGardens: Record<string, PublicGardenVaultSummary> = {};
    for (const [garden, gardenAssets] of byGarden) {
      const gardenPublicAssets = finalizeCatalogAssets(
        gardenAssets,
        allocations?.gardens.get(garden),
        hasAllocationData
      );
      publicGardens[garden] = {
        garden: garden as Address,
        hasVaults: gardenPublicAssets.length > 0,
        assets: gardenPublicAssets,
      };
    }

    return { assets: publicAssets, gardensByAddress: publicGardens };
  }, [allocationsQuery.data, allocationsQuery.isError, chainId, vaults]);

  return {
    hasVaults: assets.length > 0,
    isLoading: vaultQuery.isLoading,
    isError: vaultQuery.isError,
    isYieldLoading: false,
    isYieldError: false,
    isAllocationLoading: allocationsQuery.isLoading,
    isAllocationError: allocationsQuery.isError,
    assets,
    gardensByAddress,
  };
}

function upsertCatalogAccumulator(
  bySymbol: Map<PublicVaultSummaryAssetSymbol, CatalogAccumulator>,
  vault: GardenVault,
  symbol: PublicVaultSummaryAssetSymbol
) {
  const current = bySymbol.get(symbol) ?? {
    symbol,
    asset: vault.asset,
    chainId: vault.chainId,
    decimals: getVaultAssetDecimals(vault.asset, vault.chainId),
    vaultCount: 0,
    depositorCount: 0,
    netDeposited: 0n,
  };
  current.vaultCount += 1;
  current.depositorCount += vault.depositorCount;
  current.netDeposited += getNetDeposited(vault.totalDeposited, vault.totalWithdrawn);
  bySymbol.set(symbol, current);
}

function finalizeCatalogAssets(
  bySymbol: Map<PublicVaultSummaryAssetSymbol, CatalogAccumulator>,
  allocatedBySymbol: Map<PublicVaultSummaryAssetSymbol, bigint> | undefined,
  hasAllocationData: boolean
): PublicVaultSummaryAsset[] {
  return ASSET_ORDER.flatMap((symbol) => {
    const entry = bySymbol.get(symbol);
    if (!entry) return [];
    const allocatedYield = hasAllocationData ? (allocatedBySymbol?.get(symbol) ?? 0n) : undefined;
    return [
      {
        ...entry,
        currentValue: entry.netDeposited,
        accruingYield: undefined,
        allocatedYield,
        accruedYield: allocatedYield,
        apr: undefined,
        apy: undefined,
        isAprLoading: false,
        isAprError: false,
      },
    ];
  });
}

function aggregateYieldAllocations(allocations: YieldAllocation[], chainId: number) {
  const network = new Map<PublicVaultSummaryAssetSymbol, bigint>();
  const gardens = new Map<string, Map<PublicVaultSummaryAssetSymbol, bigint>>();

  for (const allocation of allocations) {
    const symbol = getPublicVaultAssetSymbol(allocation.assetAddress, chainId);
    if (!symbol) continue;
    network.set(symbol, (network.get(symbol) ?? 0n) + allocation.totalAmount);

    const gardenKey = allocation.gardenAddress.toLowerCase();
    const totals = gardens.get(gardenKey) ?? new Map();
    totals.set(symbol, (totals.get(symbol) ?? 0n) + allocation.totalAmount);
    gardens.set(gardenKey, totals);
  }

  return { network, gardens };
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
