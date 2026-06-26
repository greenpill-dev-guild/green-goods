/**
 * Read harvestable generated yield for an Octant V2 campaign vault.
 *
 * The metric is only available when the campaign manifest records a verified
 * per-campaign strategy address. Without that proof, `/vaults` renders an
 * unavailable state instead of falling back to donated-router shares or an
 * invented generated-yield number.
 *
 * For the Octant V2 pilot YDS contracts, harvestable generated yield is the
 * live value of the strategy's upstream source position plus idle strategy WETH,
 * minus the strategy's last tracked `totalAssets()`.
 *
 * @module hooks/vault/useOctantVaultHarvestableYield
 */

import { useQuery } from "@tanstack/react-query";
import { createPublicClientForChain } from "../../config/pimlico";
import { queryKeys } from "../../config/query-keys";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import type {
  OctantVaultCampaignAssetManifest,
  OctantVaultYieldSource,
  OctantVaultYieldStrategy,
} from "../../modules/vault-crowdfunding";
import type { Address } from "../../types/domain";
import { ERC20_BALANCE_ABI, OCTANT_VAULT_ABI, STRATEGY_ABI } from "../../utils/blockchain/abis";

export type OctantVaultHarvestableYieldStatus = "unavailable" | "zero" | "positive";
export type OctantVaultHarvestableYieldUnavailableReason =
  | "missing_vault"
  | "missing_strategy"
  | "read_error";

export interface OctantVaultHarvestableYield {
  status: OctantVaultHarvestableYieldStatus;
  strategyAddress: Address | null;
  /** Live source-position assets plus idle strategy assets, in the campaign asset unit. */
  strategyAssets: bigint;
  /** Baseline assets already tracked by the strategy's last report. */
  vaultDebt: bigint;
  harvestableAssets: bigint;
  isLoading: boolean;
  isError: boolean;
  unavailableReason?: OctantVaultHarvestableYieldUnavailableReason;
}

export interface UseOctantVaultHarvestableYieldOptions {
  vaultAddress?: Address;
  chainId?: number;
  asset?: OctantVaultCampaignAssetManifest;
  yieldSource?: OctantVaultYieldSource;
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
  const { vaultAddress, chainId, asset, yieldSource, yieldStrategy } = options;
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
      const sourceAddress = yieldSource?.address;
      const sourceChainId = yieldSource?.chainId ?? strategyChainId;
      const assetAddress = asset?.address;
      const strategyClient = createPublicClientForChain(strategyChainId);
      const sourceClient =
        sourceChainId === strategyChainId
          ? strategyClient
          : createPublicClientForChain(sourceChainId);

      try {
        if (!sourceAddress || !assetAddress) {
          return unavailableResult("read_error", strategyAddress);
        }

        const [trackedAssetsResult, sourceSharesResult, idleAssetsResult] = await Promise.all([
          strategyClient.readContract({
            address: strategyAddress,
            abi: STRATEGY_ABI,
            functionName: "totalAssets",
          }),
          sourceClient.readContract({
            address: sourceAddress,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [strategyAddress],
          }),
          strategyClient.readContract({
            address: assetAddress,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [strategyAddress],
          }),
        ]);

        const trackedAssets = typeof trackedAssetsResult === "bigint" ? trackedAssetsResult : 0n;
        const sourceShares = typeof sourceSharesResult === "bigint" ? sourceSharesResult : 0n;
        const idleAssets = typeof idleAssetsResult === "bigint" ? idleAssetsResult : 0n;
        const sourceAssetsResult = await sourceClient.readContract({
          address: sourceAddress,
          abi: OCTANT_VAULT_ABI,
          functionName: "convertToAssets",
          args: [sourceShares],
        });
        const sourceAssets = typeof sourceAssetsResult === "bigint" ? sourceAssetsResult : 0n;
        const liveStrategyAssets = sourceAssets + idleAssets;
        const harvestableAssets =
          liveStrategyAssets > trackedAssets ? liveStrategyAssets - trackedAssets : 0n;

        return {
          strategyAddress,
          strategyAssets: liveStrategyAssets,
          vaultDebt: trackedAssets,
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
