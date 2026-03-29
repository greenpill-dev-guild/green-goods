import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import type { Address } from "../../types/domain";
import type { GardenVault } from "../../types/vaults";
import { OCTANT_MODULE_ABI, OCTANT_VAULT_ABI, STRATEGY_ABI } from "../../utils/blockchain/abis";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { isZeroAddress } from "../../utils/blockchain/address";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { STALE_TIME_MEDIUM } from "../query-keys";

interface HarvestableEntry {
  vaultAddress: Address;
  assetAddress: Address;
  strategyAssets: bigint;
  vaultDebt: bigint;
  harvestable: bigint;
  idle: boolean;
}

interface UseHarvestableYieldOptions {
  enabled?: boolean;
}

/**
 * Reads the real-time harvestable yield for a garden's vaults.
 *
 * The vault's `totalAssets()` only updates during `harvest()` — it reflects
 * stale debt from the last `process_report()`. The REAL accruing yield lives
 * in `strategy.totalAssets()` (the live aToken balance from Aave).
 *
 * Harvestable yield = strategy.totalAssets() - vault.totalDebt()
 *
 * This is the yield that will become garden shares when `harvest()` is called,
 * which then flows into the three-way split (cookie jar / fractions / treasury).
 */
export function useHarvestableYield(
  vaults: GardenVault[],
  options: UseHarvestableYieldOptions = {}
) {
  const chainId = useCurrentChain();
  const octantModule = getNetworkContracts(chainId).octantModule as Address;
  const hasModule = !isZeroAddress(octantModule);
  const enabled = (options.enabled ?? true) && hasModule && vaults.length > 0;

  // Step 1: Get strategy addresses for each vault
  const strategyContracts = vaults.map((v) => ({
    address: octantModule,
    abi: OCTANT_MODULE_ABI,
    functionName: "vaultStrategies" as const,
    args: [v.vaultAddress] as const,
    chainId,
  }));

  const strategyQuery = useReadContracts({
    contracts: enabled ? strategyContracts : [],
    query: { enabled, staleTime: STALE_TIME_MEDIUM },
  });

  // Step 2: Once we have strategies, read their totalAssets + vault totalDebt
  const strategies = useMemo(() => {
    if (!strategyQuery.data) return [];
    return strategyQuery.data.map((r) => (r.status === "success" ? (r.result as Address) : null));
  }, [strategyQuery.data]);

  const hasStrategies = strategies.some((s) => s && !isZeroAddress(s));

  const yieldContracts = useMemo(() => {
    if (!hasStrategies) return [];
    const calls: Array<{
      address: Address;
      abi: typeof STRATEGY_ABI | typeof OCTANT_VAULT_ABI;
      functionName: string;
      chainId: number;
    }> = [];
    for (let i = 0; i < vaults.length; i++) {
      const strategy = strategies[i];
      if (!strategy || isZeroAddress(strategy)) {
        // Placeholder calls that will return 0 — vault has no strategy
        calls.push({
          address: vaults[i].vaultAddress,
          abi: OCTANT_VAULT_ABI,
          functionName: "totalDebt",
          chainId,
        });
        calls.push({
          address: vaults[i].vaultAddress,
          abi: OCTANT_VAULT_ABI,
          functionName: "totalDebt",
          chainId,
        });
      } else {
        calls.push({
          address: strategy,
          abi: STRATEGY_ABI,
          functionName: "totalAssets",
          chainId,
        });
        calls.push({
          address: vaults[i].vaultAddress,
          abi: OCTANT_VAULT_ABI,
          functionName: "totalDebt",
          chainId,
        });
      }
    }
    return calls;
  }, [vaults, strategies, hasStrategies, chainId]);

  const yieldQuery = useReadContracts({
    contracts: hasStrategies ? yieldContracts : [],
    query: { enabled: hasStrategies, staleTime: STALE_TIME_MEDIUM },
  });

  const result = useMemo(() => {
    const entries: HarvestableEntry[] = [];
    let total = 0n;

    if (!yieldQuery.data) return { entries, total };

    for (let i = 0; i < vaults.length; i++) {
      const strategy = strategies[i];
      const stratResult = yieldQuery.data[i * 2];
      const debtResult = yieldQuery.data[i * 2 + 1];

      const strategyAssets =
        stratResult?.status === "success" ? (stratResult.result as bigint) : 0n;
      const vaultDebt = debtResult?.status === "success" ? (debtResult.result as bigint) : 0n;

      const idle = !strategy || isZeroAddress(strategy) || strategyAssets === 0n;
      const harvestable = !idle && strategyAssets > vaultDebt ? strategyAssets - vaultDebt : 0n;

      entries.push({
        vaultAddress: vaults[i].vaultAddress,
        assetAddress: vaults[i].asset,
        strategyAssets,
        vaultDebt,
        harvestable,
        idle,
      });
      total += harvestable;
    }

    return { entries, total };
  }, [yieldQuery.data, vaults, strategies]);

  return {
    ...result,
    isLoading: strategyQuery.isLoading || (hasStrategies && yieldQuery.isLoading),
    isError: strategyQuery.isError || yieldQuery.isError,
  };
}
