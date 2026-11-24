import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { yieldKeys } from "../../config/query-keys/vault";
import { getAllYieldAllocations } from "../../modules/data/yield-allocations";
import type { PublicVaultYield } from "../../modules/data/public-vault-yield";
import type { Address } from "../../types/domain";
import type { YieldAllocation } from "../../types/gardens-community";
import type { GardenVault } from "../../types/vaults";
import {
  getNetDeposited,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
} from "../../utils/blockchain/vaults";
import { useGardenVaults } from "../vault/useGardenVaults";

export type PublicVaultSummaryAssetSymbol = "DAI" | "ETH";

export interface PublicVaultSummaryAsset {
  symbol: PublicVaultSummaryAssetSymbol;
  asset: Address;
  chainId: number;
  decimals: number;
  vaultCount: number;
  depositorCount: number;
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

const ASSET_ORDER: PublicVaultSummaryAssetSymbol[] = ["DAI", "ETH"];

interface CatalogAccumulator {
  symbol: PublicVaultSummaryAssetSymbol;
  asset: Address;
  chainId: number;
  decimals: number;
  vaultCount: number;
  depositorCount: number;
  netDeposited: bigint;
  accruingYield: bigint;
  liveYieldComplete: boolean;
}

/**
 * Public, provider-free vault summary.
 *
 * Indexed balances render first; a lazy public-client read adds live yield and
 * rates without booting Wagmi or a wallet UI.
 */
export function usePublicVaultCatalogSummary(): PublicVaultSummary {
  const chainId = DEFAULT_CHAIN_ID;
  const vaultQuery = useGardenVaults(undefined, { chainId });
  const vaults = vaultQuery.vaults;
  const liveVaults = useMemo(
    () => vaults.filter((vault) => getPublicVaultAssetSymbol(vault.asset, vault.chainId)),
    [vaults]
  );
  const liveQuery = useQuery({
    queryKey: yieldKeys.publicVaultCatalog(chainId, liveVaults),
    queryFn: async ({ signal }) => {
      const { readPublicVaultYield } = await import("../../modules/data/public-vault-yield");
      return readPublicVaultYield(liveVaults, chainId, signal);
    },
    enabled: liveVaults.length > 0,
    staleTime: STALE_TIME_MEDIUM,
  });
  const liveYield = liveQuery.isError ? undefined : liveQuery.data;
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
      const yieldValue = liveYield?.yieldByVault[vault.vaultAddress.toLowerCase()];
      upsertCatalogAccumulator(network, vault, symbol, yieldValue);

      const gardenKey = vault.garden.toLowerCase();
      const gardenAssets = byGarden.get(gardenKey) ?? new Map();
      upsertCatalogAccumulator(gardenAssets, vault, symbol, yieldValue);
      byGarden.set(gardenKey, gardenAssets);
    }

    const publicAssets = finalizeCatalogAssets(
      network,
      allocations?.network,
      hasAllocationData,
      liveYield,
      liveQuery.isLoading
    );
    const publicGardens: Record<string, PublicGardenVaultSummary> = {};
    for (const [garden, gardenAssets] of byGarden) {
      const gardenPublicAssets = finalizeCatalogAssets(
        gardenAssets,
        allocations?.gardens.get(garden),
        hasAllocationData,
        liveYield,
        liveQuery.isLoading
      );
      publicGardens[garden] = {
        garden: garden as Address,
        hasVaults: gardenPublicAssets.length > 0,
        assets: gardenPublicAssets,
      };
    }

    return { assets: publicAssets, gardensByAddress: publicGardens };
  }, [
    allocationsQuery.data,
    allocationsQuery.isError,
    chainId,
    vaults,
    liveYield,
    liveQuery.isLoading,
  ]);

  return {
    hasVaults: assets.length > 0,
    isLoading: vaultQuery.isLoading,
    isError: vaultQuery.isError,
    isYieldLoading: liveQuery.isLoading,
    isYieldError:
      liveQuery.isError ||
      Boolean(liveYield && assets.some((asset) => asset.accruingYield === undefined)),
    isAllocationLoading: allocationsQuery.isLoading,
    isAllocationError: allocationsQuery.isError,
    assets,
    gardensByAddress,
  };
}

function upsertCatalogAccumulator(
  bySymbol: Map<PublicVaultSummaryAssetSymbol, CatalogAccumulator>,
  vault: GardenVault,
  symbol: PublicVaultSummaryAssetSymbol,
  liveYield: bigint | undefined
) {
  const current = bySymbol.get(symbol) ?? {
    symbol,
    asset: vault.asset,
    chainId: vault.chainId,
    decimals: getVaultAssetDecimals(vault.asset, vault.chainId),
    vaultCount: 0,
    depositorCount: 0,
    netDeposited: 0n,
    accruingYield: 0n,
    liveYieldComplete: true,
  };
  current.vaultCount += 1;
  current.depositorCount += vault.depositorCount;
  current.netDeposited += getNetDeposited(vault.totalDeposited, vault.totalWithdrawn);
  if (liveYield === undefined) current.liveYieldComplete = false;
  else current.accruingYield += liveYield;
  bySymbol.set(symbol, current);
}

function finalizeCatalogAssets(
  bySymbol: Map<PublicVaultSummaryAssetSymbol, CatalogAccumulator>,
  allocatedBySymbol: Map<PublicVaultSummaryAssetSymbol, bigint> | undefined,
  hasAllocationData: boolean,
  liveYield: PublicVaultYield | undefined,
  isLoading: boolean
): PublicVaultSummaryAsset[] {
  return ASSET_ORDER.flatMap((symbol) => {
    const entry = bySymbol.get(symbol);
    if (!entry) return [];
    const allocatedYield = hasAllocationData ? (allocatedBySymbol?.get(symbol) ?? 0n) : undefined;
    const accruingYield = entry.liveYieldComplete ? entry.accruingYield : undefined;
    const rate = liveYield?.ratesByAsset[entry.asset.toLowerCase()];
    const { liveYieldComplete: _complete, ...asset } = entry;
    return [
      {
        ...asset,
        currentValue: entry.netDeposited + (accruingYield ?? 0n),
        accruingYield,
        allocatedYield,
        accruedYield:
          allocatedYield !== undefined && accruingYield !== undefined
            ? allocatedYield + accruingYield
            : undefined,
        apr: rate?.apr,
        apy: rate?.apy,
        isAprLoading: isLoading,
        isAprError: !isLoading && !rate,
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
