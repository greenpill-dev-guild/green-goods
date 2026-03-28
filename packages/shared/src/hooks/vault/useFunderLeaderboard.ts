import { useMemo } from "react";
import type { Address } from "../../types/domain";
import type {
  FunderAssetTotal,
  FunderLeaderboardEntry,
  FunderPosition,
  VaultDeposit,
} from "../../types/vaults";
import { getNetDeposited } from "../../utils/blockchain/vaults";
import { useAllVaultDeposits } from "./useAllVaultDeposits";
import { getBatchConvertToAssetsKey, useBatchConvertToAssets } from "./useBatchConvertToAssets";
import { useVaultDeposits } from "./useVaultDeposits";

interface UseFunderLeaderboardOptions {
  gardenAddress?: Address;
}

/**
 * Aggregates vault deposits into a funder leaderboard, ranked by yield generated.
 *
 * When `gardenAddress` is provided, scopes to a single garden.
 * Otherwise, aggregates across all gardens (protocol-wide).
 */
export function useFunderLeaderboard(options: UseFunderLeaderboardOptions = {}) {
  const { gardenAddress } = options;

  // Fetch deposits — garden-scoped or protocol-wide
  const {
    deposits: gardenDeposits,
    isLoading: gardenLoading,
    isError: gardenError,
  } = useVaultDeposits(gardenAddress, { enabled: Boolean(gardenAddress) });

  const {
    deposits: allDeposits,
    isLoading: allLoading,
    isError: allError,
  } = useAllVaultDeposits({ enabled: !gardenAddress });

  const deposits: VaultDeposit[] = gardenAddress ? gardenDeposits : allDeposits;
  const depositsLoading = gardenAddress ? gardenLoading : allLoading;
  const depositsError = gardenAddress ? gardenError : allError;

  // Build batch entries for share→asset conversion
  const convertEntries = useMemo(
    () =>
      deposits
        .filter((d) => d.shares > 0n)
        .map((d) => ({ chainId: d.chainId, vaultAddress: d.vaultAddress, shares: d.shares })),
    [deposits]
  );

  const {
    assetMap,
    isLoading: convertLoading,
    isError: convertError,
  } = useBatchConvertToAssets(convertEntries);

  const sortAssetTotals = (assetTotals: FunderAssetTotal[]) =>
    [...assetTotals].sort(
      (a, b) => a.chainId - b.chainId || a.asset.toLowerCase().localeCompare(b.asset.toLowerCase())
    );

  const upsertAssetTotal = (
    assetTotals: Map<string, FunderAssetTotal>,
    deposit: VaultDeposit,
    netDeposited: bigint,
    currentValue: bigint,
    yieldGenerated: bigint
  ) => {
    const key = `${deposit.chainId}:${deposit.asset.toLowerCase()}`;
    const existing = assetTotals.get(key) ?? {
      chainId: deposit.chainId,
      asset: deposit.asset,
      totalYieldGenerated: 0n,
      totalNetDeposited: 0n,
      totalCurrentValue: 0n,
    };

    existing.totalYieldGenerated += yieldGenerated;
    existing.totalNetDeposited += netDeposited;
    existing.totalCurrentValue += currentValue;
    assetTotals.set(key, existing);
  };

  // Aggregate deposits by depositor
  const { funders, totalProtocolYield, protocolAssetTotals } = useMemo(() => {
    if (deposits.length === 0 || convertLoading) {
      return {
        funders: [] as FunderLeaderboardEntry[],
        totalProtocolYield: 0n,
        protocolAssetTotals: [] as FunderAssetTotal[],
      };
    }

    const byDepositor = new Map<string, VaultDeposit[]>();
    const protocolAssetTotalsMap = new Map<string, FunderAssetTotal>();
    for (const deposit of deposits) {
      const key = deposit.depositor.toLowerCase();
      const existing = byDepositor.get(key) ?? [];
      byDepositor.set(key, [...existing, deposit]);
    }

    const entries: FunderLeaderboardEntry[] = [];

    for (const [depositorKey, depositorDeposits] of byDepositor) {
      let totalNet = 0n;
      let totalCurrent = 0n;
      const gardenSet = new Set<string>();
      const positions: FunderPosition[] = [];
      const funderAssetTotalsMap = new Map<string, FunderAssetTotal>();

      for (const deposit of depositorDeposits) {
        const netDeposited = getNetDeposited(deposit.totalDeposited, deposit.totalWithdrawn);
        const convertKey = getBatchConvertToAssetsKey({
          chainId: deposit.chainId,
          vaultAddress: deposit.vaultAddress,
          shares: deposit.shares,
        });
        const currentValue = assetMap.get(convertKey) ?? netDeposited;

        // Clamp negative yield to 0 — ERC-4626 rounding, not real losses
        const rawYield = currentValue - netDeposited;
        const yieldGenerated = rawYield > 0n ? rawYield : 0n;

        totalNet += netDeposited;
        totalCurrent += currentValue;
        gardenSet.add(deposit.garden.toLowerCase());
        upsertAssetTotal(funderAssetTotalsMap, deposit, netDeposited, currentValue, yieldGenerated);
        upsertAssetTotal(
          protocolAssetTotalsMap,
          deposit,
          netDeposited,
          currentValue,
          yieldGenerated
        );

        positions.push({
          garden: deposit.garden,
          asset: deposit.asset,
          vaultAddress: deposit.vaultAddress,
          shares: deposit.shares,
          netDeposited,
          currentValue,
          yieldGenerated,
        });
      }

      const assetTotals = sortAssetTotals(Array.from(funderAssetTotalsMap.values()));
      const totalYield = assetTotals.length === 1 ? assetTotals[0].totalYieldGenerated : 0n;
      entries.push({
        address: depositorKey as Address,
        totalYieldGenerated: totalYield,
        totalNetDeposited: totalNet,
        totalCurrentValue: totalCurrent,
        gardenCount: gardenSet.size,
        gardenAddresses: Array.from(gardenSet) as Address[],
        positions,
        assetTotals,
      });
    }

    // Sort by yield generated descending
    entries.sort((a, b) => {
      if (b.totalYieldGenerated > a.totalYieldGenerated) return 1;
      if (b.totalYieldGenerated < a.totalYieldGenerated) return -1;
      // Tie-break by net deposited
      if (b.totalNetDeposited > a.totalNetDeposited) return 1;
      if (b.totalNetDeposited < a.totalNetDeposited) return -1;
      return 0;
    });

    const protocolAssetTotals = sortAssetTotals(Array.from(protocolAssetTotalsMap.values()));
    const totalProtocolYield =
      protocolAssetTotals.length === 1 ? protocolAssetTotals[0].totalYieldGenerated : 0n;

    return { funders: entries, totalProtocolYield, protocolAssetTotals };
  }, [deposits, assetMap, convertLoading]);

  return {
    funders,
    totalProtocolYield,
    protocolAssetTotals,
    isLoading: depositsLoading || convertLoading,
    isError: depositsError || convertError,
  };
}
