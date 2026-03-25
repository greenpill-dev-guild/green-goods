import { useMemo } from "react";
import type { Address } from "../../types/domain";
import type { FunderLeaderboardEntry, FunderPosition, VaultDeposit } from "../../types/vaults";
import { getNetDeposited } from "../../utils/blockchain/vaults";
import { useAllVaultDeposits } from "./useAllVaultDeposits";
import { useBatchConvertToAssets } from "./useBatchConvertToAssets";
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
        .map((d) => ({ vaultAddress: d.vaultAddress, shares: d.shares })),
    [deposits]
  );

  const { assetMap, isLoading: convertLoading } = useBatchConvertToAssets(convertEntries);

  // Aggregate deposits by depositor
  const { funders, totalProtocolYield } = useMemo(() => {
    if (deposits.length === 0 || convertLoading) {
      return { funders: [] as FunderLeaderboardEntry[], totalProtocolYield: 0n };
    }

    const byDepositor = new Map<string, VaultDeposit[]>();
    for (const deposit of deposits) {
      const key = deposit.depositor.toLowerCase();
      const existing = byDepositor.get(key) ?? [];
      byDepositor.set(key, [...existing, deposit]);
    }

    let protocolYield = 0n;
    const entries: FunderLeaderboardEntry[] = [];

    for (const [depositorKey, depositorDeposits] of byDepositor) {
      let totalYield = 0n;
      let totalNet = 0n;
      let totalCurrent = 0n;
      const gardenSet = new Set<string>();
      const positions: FunderPosition[] = [];

      for (const deposit of depositorDeposits) {
        const netDeposited = getNetDeposited(deposit.totalDeposited, deposit.totalWithdrawn);
        const convertKey = `${deposit.vaultAddress}:${deposit.shares}`;
        const currentValue = assetMap.get(convertKey) ?? netDeposited;

        // Clamp negative yield to 0 — ERC-4626 rounding, not real losses
        const rawYield = currentValue - netDeposited;
        const yieldGenerated = rawYield > 0n ? rawYield : 0n;

        totalNet += netDeposited;
        totalCurrent += currentValue;
        totalYield += yieldGenerated;
        gardenSet.add(deposit.garden.toLowerCase());

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

      protocolYield += totalYield;

      entries.push({
        address: depositorKey as Address,
        totalYieldGenerated: totalYield,
        totalNetDeposited: totalNet,
        totalCurrentValue: totalCurrent,
        gardenCount: gardenSet.size,
        gardenAddresses: Array.from(gardenSet) as Address[],
        positions,
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

    return { funders: entries, totalProtocolYield: protocolYield };
  }, [deposits, assetMap, convertLoading]);

  return {
    funders,
    totalProtocolYield,
    isLoading: depositsLoading || convertLoading,
    isError: depositsError,
  };
}
