/**
 * Read the live gross/donation-funding APY of an Octant V2 campaign vault's
 * external yield source, for the `/vaults` strategy section.
 *
 * Octant YDS depositors keep a flat price-per-share — profit is donated to the
 * project's `dragonRouter` — so there is no depositor APY to read. The meaningful
 * rate is the underlying source's gross APY: the rate that funds donations. The
 * deployed strategy exposes no source getter, so the source is recorded in the
 * campaign manifest ({@link OctantVaultYieldSource}) and its live APY is read
 * through the matching {@link findYieldSourceAdapter | adapter}. Every failure
 * mode degrades to an explicit unavailable state — the hook never invents a
 * number.
 *
 * @module hooks/vault/useOctantVaultStrategyApy
 */

import { useQuery } from "@tanstack/react-query";
import { createPublicClientForChain } from "../../config/pimlico";
import { queryKeys } from "../../config/query-keys";
import { STALE_TIME_SLOW } from "../../config/query-keys/constants";
import { logger } from "../../modules/app/logger";
import type { OctantVaultYieldSource } from "../../modules/vault-crowdfunding";
import type { Address } from "../../types/domain";
import { OCTANT_VAULT_ABI } from "../../utils/blockchain/abis";
import { findYieldSourceAdapter, type YieldSourceKind } from "../../utils/blockchain/yield-sources";

export type OctantVaultStrategyApyStatus = "unavailable" | "zero" | "positive";
export type OctantVaultStrategyApyUnavailableReason =
  | "missing_vault"
  | "missing_source"
  | "shutdown"
  | "unsupported_source"
  | "read_error";

export interface OctantVaultStrategyApy {
  status: OctantVaultStrategyApyStatus;
  /** Gross/donation-funding rate as a percentage. NOT a depositor return (depositor PPS is flat). */
  apy: number | null;
  apr: number | null;
  sourceAddress: Address | null;
  sourceKind: YieldSourceKind;
  isLoading: boolean;
  isError: boolean;
  unavailableReason?: OctantVaultStrategyApyUnavailableReason;
}

export interface UseOctantVaultStrategyApyOptions {
  vaultAddress?: Address;
  chainId?: number;
  yieldSource?: OctantVaultYieldSource;
  enabled?: boolean;
}

interface StrategyApyQueryResult {
  apy: number | null;
  apr: number | null;
  sourceAddress: Address | null;
  sourceKind: YieldSourceKind;
  unavailableReason?: OctantVaultStrategyApyUnavailableReason;
}

function unavailableResult(
  reason: OctantVaultStrategyApyUnavailableReason,
  sourceAddress: Address | null = null,
  sourceKind: YieldSourceKind = "unknown"
): StrategyApyQueryResult {
  return { apy: null, apr: null, sourceAddress, sourceKind, unavailableReason: reason };
}

export function useOctantVaultStrategyApy(
  options: UseOctantVaultStrategyApyOptions = {}
): OctantVaultStrategyApy {
  const { vaultAddress, chainId, yieldSource } = options;
  const enabled = (options.enabled ?? true) && Boolean(vaultAddress && chainId);

  const query = useQuery({
    queryKey:
      vaultAddress && chainId
        ? queryKeys.vaults.vaultStrategyApy(vaultAddress, chainId)
        : (["greengoods", "vaults", "vaultStrategyApy", "disabled"] as const),
    enabled,
    staleTime: STALE_TIME_SLOW,
    queryFn: async (): Promise<StrategyApyQueryResult> => {
      if (!vaultAddress || !chainId) return unavailableResult("missing_vault");
      if (!yieldSource?.address) return unavailableResult("missing_source");

      const { kind: sourceKind, address: sourceAddress } = yieldSource;
      const sourceChainId = yieldSource.chainId ?? chainId;

      // Honest gate: don't surface a yield rate for a shut-down vault. Best-effort —
      // a flaky read must not hide an otherwise-valid source rate.
      try {
        const shutdown = await createPublicClientForChain(chainId).readContract({
          address: vaultAddress,
          abi: OCTANT_VAULT_ABI,
          functionName: "isShutdown",
        });
        if (shutdown === true) return unavailableResult("shutdown", sourceAddress, sourceKind);
      } catch (error) {
        logger.error("[useOctantVaultStrategyApy] isShutdown read failed", {
          error,
          chainId,
          vaultAddress,
        });
      }

      const adapter = findYieldSourceAdapter(sourceKind);
      if (!adapter) return unavailableResult("unsupported_source", sourceAddress, sourceKind);

      try {
        const result = await adapter.readApy({ sourceAddress, chainId: sourceChainId });
        return { apy: result.apy, apr: result.apr, sourceAddress, sourceKind };
      } catch (error) {
        logger.error("[useOctantVaultStrategyApy] source APY read failed", {
          error,
          chainId: sourceChainId,
          sourceAddress,
          sourceKind,
        });
        return unavailableResult("read_error", sourceAddress, sourceKind);
      }
    },
  });

  if (!enabled) {
    return {
      status: "unavailable",
      apy: null,
      apr: null,
      sourceAddress: null,
      sourceKind: "unknown",
      isLoading: false,
      isError: false,
      unavailableReason: "missing_vault",
    };
  }

  if (query.isError) {
    return {
      status: "unavailable",
      apy: null,
      apr: null,
      sourceAddress: null,
      sourceKind: "unknown",
      isLoading: false,
      isError: true,
      unavailableReason: "read_error",
    };
  }

  const data = query.data;
  if (!data || data.unavailableReason) {
    return {
      status: "unavailable",
      apy: data?.apy ?? null,
      apr: data?.apr ?? null,
      sourceAddress: data?.sourceAddress ?? null,
      sourceKind: data?.sourceKind ?? "unknown",
      isLoading: query.isLoading,
      isError: false,
      unavailableReason: data?.unavailableReason ?? "missing_vault",
    };
  }

  return {
    status: (data.apy ?? 0) > 0 ? "positive" : "zero",
    apy: data.apy,
    apr: data.apr,
    sourceAddress: data.sourceAddress,
    sourceKind: data.sourceKind,
    isLoading: query.isLoading,
    isError: false,
  };
}
