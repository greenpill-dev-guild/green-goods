/**
 * Read harvestable generated yield for an Octant V2 campaign vault.
 *
 * The metric is only available when the campaign manifest records a verified
 * per-campaign strategy address. Without that proof, `/vaults` renders an
 * unavailable state instead of falling back to donated-router shares or an
 * invented generated-yield number.
 *
 * Harvestable generated yield = max(strategy.totalAssets() - vault.totalDebt(), 0)
 *
 * @module hooks/vault/useOctantVaultHarvestableYield
 */

import { useQuery } from "@tanstack/react-query";
import { createPublicClientForChain } from "../../config/pimlico";
import { queryKeys } from "../../config/query-keys";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import type { OctantVaultYieldStrategy } from "../../modules/vault-crowdfunding";
import type { Address } from "../../types/domain";
import { OCTANT_VAULT_ABI, STRATEGY_ABI } from "../../utils/blockchain/abis";

export type OctantVaultHarvestableYieldStatus = "unavailable" | "zero" | "positive";
export type OctantVaultHarvestableYieldUnavailableReason =
  | "missing_vault"
  | "missing_strategy"
  | "read_error";

export interface OctantVaultHarvestableYield {
  status: OctantVaultHarvestableYieldStatus;
  strategyAddress: Address | null;
  strategyAssets: bigint;
  vaultDebt: bigint;
  harvestableAssets: bigint;
  isLoading: boolean;
  isError: boolean;
  unavailableReason?: OctantVaultHarvestableYieldUnavailableReason;
}

export interface UseOctantVaultHarvestableYieldOptions {
  vaultAddress?: Address;
  chainId?: number;
  yieldStrategy?: OctantVaultYieldStrategy;
  enabled?: boolean;
}

interface HarvestableYieldQueryResult {
  strategyAddress: Address | null;
  strategyAssets: bigint;
  vaultDebt: bigint;
  harvestableAssets: bigint;
  unavailableReason?: OctantVaultHarvestableYieldUnavailableReason;
}

function unavailableResult(
  reason: OctantVaultHarvestableYieldUnavailableReason,
  strategyAddress: Address | null = null
): HarvestableYieldQueryResult {
  return {
    strategyAddress,
    strategyAssets: 0n,
    vaultDebt: 0n,
    harvestableAssets: 0n,
    unavailableReason: reason,
  };
}

export function useOctantVaultHarvestableYield(
  options: UseOctantVaultHarvestableYieldOptions = {}
): OctantVaultHarvestableYield {
  const { vaultAddress, chainId, yieldStrategy } = options;
  const enabled = (options.enabled ?? true) && Boolean(vaultAddress && chainId);

  const query = useQuery({
    queryKey:
      vaultAddress && chainId
        ? queryKeys.vaults.octantHarvestableYield(vaultAddress, chainId, yieldStrategy?.address)
        : (["greengoods", "vaults", "octantHarvestableYield", "disabled"] as const),
    enabled,
    staleTime: STALE_TIME_MEDIUM,
    queryFn: async (): Promise<HarvestableYieldQueryResult> => {
      if (!vaultAddress || !chainId) return unavailableResult("missing_vault");
      if (!yieldStrategy?.address) return unavailableResult("missing_strategy");

      const strategyAddress = yieldStrategy.address;
      const strategyChainId = yieldStrategy.chainId ?? chainId;
      const strategyClient = createPublicClientForChain(strategyChainId);
      const vaultClient =
        strategyChainId === chainId ? strategyClient : createPublicClientForChain(chainId);

      try {
        const [strategyAssetsResult, vaultDebtResult] = await Promise.all([
          strategyClient.readContract({
            address: strategyAddress,
            abi: STRATEGY_ABI,
            functionName: "totalAssets",
          }),
          vaultClient.readContract({
            address: vaultAddress,
            abi: OCTANT_VAULT_ABI,
            functionName: "totalDebt",
          }),
        ]);

        const strategyAssets =
          typeof strategyAssetsResult === "bigint" ? strategyAssetsResult : 0n;
        const vaultDebt = typeof vaultDebtResult === "bigint" ? vaultDebtResult : 0n;
        const harvestableAssets = strategyAssets > vaultDebt ? strategyAssets - vaultDebt : 0n;

        return {
          strategyAddress,
          strategyAssets,
          vaultDebt,
          harvestableAssets,
        };
      } catch {
        return unavailableResult("read_error", strategyAddress);
      }
    },
  });

  if (!enabled) {
    return {
      status: "unavailable",
      strategyAddress: null,
      strategyAssets: 0n,
      vaultDebt: 0n,
      harvestableAssets: 0n,
      isLoading: false,
      isError: false,
      unavailableReason: "missing_vault",
    };
  }

  if (query.isError) {
    return {
      status: "unavailable",
      strategyAddress: null,
      strategyAssets: 0n,
      vaultDebt: 0n,
      harvestableAssets: 0n,
      isLoading: false,
      isError: true,
      unavailableReason: "read_error",
    };
  }

  const data = query.data;
  if (!data || data.unavailableReason) {
    return {
      status: "unavailable",
      strategyAddress: data?.strategyAddress ?? null,
      strategyAssets: data?.strategyAssets ?? 0n,
      vaultDebt: data?.vaultDebt ?? 0n,
      harvestableAssets: data?.harvestableAssets ?? 0n,
      isLoading: query.isLoading,
      isError: false,
      unavailableReason: data?.unavailableReason ?? "missing_vault",
    };
  }

  return {
    status: data.harvestableAssets > 0n ? "positive" : "zero",
    strategyAddress: data.strategyAddress,
    strategyAssets: data.strategyAssets,
    vaultDebt: data.vaultDebt,
    harvestableAssets: data.harvestableAssets,
    isLoading: query.isLoading,
    isError: false,
  };
}
