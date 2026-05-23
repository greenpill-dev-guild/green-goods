import { useMemo } from "react";
import type { Address } from "../../types/domain";
import type { GardenVault, VaultDeposit } from "../../types/vaults";
import {
  getNetDeposited,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
} from "../../utils/blockchain/vaults";
import { useGardenVaults } from "../vault/useGardenVaults";
import { useMyVaultDeposits } from "../vault/useMyVaultDeposits";
import { type PublicGardenSummary, usePublicGardens } from "./usePublicGardens";

export interface PublicEndowmentInput {
  deposits: VaultDeposit[];
  gardens: PublicGardenSummary[];
  vaults: GardenVault[];
}

export interface PublicEndowmentPosition {
  id: string;
  chainId: number;
  gardenAddress: Address;
  gardenName: string;
  gardenLocation: string;
  gardenSlug?: string;
  vaultAddress: Address;
  asset: Address;
  assetSymbol: string;
  decimals: number;
  shares: bigint;
  totalEndowed: bigint;
  netEndowed: bigint;
  hasGardenMetadata: boolean;
  hasVaultMetadata: boolean;
}

export interface PublicEndowmentAssetTotal {
  chainId: number;
  asset: Address;
  assetSymbol: string;
  decimals: number;
  totalEndowed: bigint;
  netEndowed: bigint;
  positionCount: number;
}

export interface PublicEndowmentGardenGroup {
  gardenAddress: Address;
  gardenName: string;
  gardenLocation: string;
  gardenSlug?: string;
  hasGardenMetadata: boolean;
  positions: PublicEndowmentPosition[];
}

export interface PublicEndowmentPortfolio {
  hasPositions: boolean;
  positions: PublicEndowmentPosition[];
  gardenGroups: PublicEndowmentGardenGroup[];
  assetTotals: PublicEndowmentAssetTotal[];
  gardenCount: number;
}

interface UsePublicEndowmentPositionsOptions {
  chainId?: number;
  enabled?: boolean;
}

const EMPTY_PORTFOLIO: PublicEndowmentPortfolio = {
  hasPositions: false,
  positions: [],
  gardenGroups: [],
  assetTotals: [],
  gardenCount: 0,
};

function normalize(value: string | undefined | null): string {
  return value?.toLowerCase() ?? "";
}

function formatGardenFallback(address: Address): string {
  return `Garden ${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}

function buildVaultKey(vaultAddress: Address, chainId: number): string {
  return `${chainId}:${normalize(vaultAddress)}`;
}

function buildAssetKey(asset: Address, chainId: number): string {
  return `${chainId}:${normalize(asset)}`;
}

export function buildPublicEndowmentPortfolio(
  input: PublicEndowmentInput
): PublicEndowmentPortfolio {
  if (input.deposits.length === 0) return EMPTY_PORTFOLIO;

  const gardensByAddress = new Map<string, PublicGardenSummary>();
  for (const garden of input.gardens) {
    gardensByAddress.set(normalize(garden.address), garden);
    gardensByAddress.set(normalize(garden.id), garden);
  }

  const vaultsByAddress = new Map<string, GardenVault>();
  for (const vault of input.vaults) {
    vaultsByAddress.set(buildVaultKey(vault.vaultAddress, vault.chainId), vault);
  }

  const positions: PublicEndowmentPosition[] = [];
  const gardenGroupsByAddress = new Map<string, PublicEndowmentGardenGroup>();
  const assetTotalsByAsset = new Map<string, PublicEndowmentAssetTotal>();

  for (const deposit of input.deposits) {
    if (deposit.shares <= 0n) continue;

    const garden = gardensByAddress.get(normalize(deposit.garden));
    const vault = vaultsByAddress.get(buildVaultKey(deposit.vaultAddress, deposit.chainId));
    const assetSymbol = getVaultAssetSymbol(deposit.asset, deposit.chainId);
    const decimals = getVaultAssetDecimals(deposit.asset, deposit.chainId);
    const gardenName = garden?.name?.trim() || formatGardenFallback(deposit.garden);
    const gardenLocation = garden?.location?.trim() ?? "";
    const netEndowed = getNetDeposited(deposit.totalDeposited, deposit.totalWithdrawn);

    const position: PublicEndowmentPosition = {
      id: deposit.id,
      chainId: deposit.chainId,
      gardenAddress: deposit.garden,
      gardenName,
      gardenLocation,
      gardenSlug: garden?.slug,
      vaultAddress: deposit.vaultAddress,
      asset: deposit.asset,
      assetSymbol,
      decimals,
      shares: deposit.shares,
      totalEndowed: deposit.totalDeposited,
      netEndowed,
      hasGardenMetadata: Boolean(garden),
      hasVaultMetadata: Boolean(vault),
    };

    positions.push(position);

    const gardenKey = normalize(deposit.garden);
    const group =
      gardenGroupsByAddress.get(gardenKey) ??
      ({
        gardenAddress: deposit.garden,
        gardenName,
        gardenLocation,
        gardenSlug: garden?.slug,
        hasGardenMetadata: Boolean(garden),
        positions: [],
      } satisfies PublicEndowmentGardenGroup);
    group.positions.push(position);
    gardenGroupsByAddress.set(gardenKey, group);

    const assetKey = buildAssetKey(deposit.asset, deposit.chainId);
    const total =
      assetTotalsByAsset.get(assetKey) ??
      ({
        chainId: deposit.chainId,
        asset: deposit.asset,
        assetSymbol,
        decimals,
        totalEndowed: 0n,
        netEndowed: 0n,
        positionCount: 0,
      } satisfies PublicEndowmentAssetTotal);
    total.totalEndowed += deposit.totalDeposited;
    total.netEndowed += netEndowed;
    total.positionCount += 1;
    assetTotalsByAsset.set(assetKey, total);
  }

  if (positions.length === 0) return EMPTY_PORTFOLIO;

  const gardenGroups = Array.from(gardenGroupsByAddress.values());
  return {
    hasPositions: true,
    positions,
    gardenGroups,
    assetTotals: Array.from(assetTotalsByAsset.values()),
    gardenCount: gardenGroups.length,
  };
}

export function usePublicEndowmentPositions(
  userAddress?: Address,
  options: UsePublicEndowmentPositionsOptions = {}
) {
  const enabled = options.enabled ?? true;
  const depositsQuery = useMyVaultDeposits(userAddress, {
    chainId: options.chainId,
    enabled: enabled && Boolean(userAddress),
  });
  const vaultsQuery = useGardenVaults(undefined, {
    chainId: options.chainId,
    enabled: enabled && Boolean(userAddress),
  });
  const gardensQuery = usePublicGardens(options.chainId, {
    enabled: enabled && Boolean(userAddress),
  });

  const portfolio = useMemo(
    () =>
      buildPublicEndowmentPortfolio({
        deposits: depositsQuery.deposits,
        gardens: gardensQuery.data ?? [],
        vaults: vaultsQuery.vaults,
      }),
    [depositsQuery.deposits, gardensQuery.data, vaultsQuery.vaults]
  );

  return {
    ...portfolio,
    deposits: depositsQuery.deposits,
    vaults: vaultsQuery.vaults,
    gardens: gardensQuery.data ?? [],
    isLoading: depositsQuery.isLoading || vaultsQuery.isLoading || gardensQuery.isLoading,
    isFetching: depositsQuery.isFetching || vaultsQuery.isFetching || gardensQuery.isFetching,
    isError: depositsQuery.isError || vaultsQuery.isError || gardensQuery.isError,
    error: depositsQuery.error ?? vaultsQuery.error ?? gardensQuery.error,
    refetch: async () => {
      await Promise.all([depositsQuery.refetch(), vaultsQuery.refetch(), gardensQuery.refetch()]);
    },
  };
}
