import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import { normalizeAddress } from "../../utils/blockchain/address";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useProgressiveInvalidation } from "../utils/useTimeout";
import type { HarvestDistributionParams } from "./useHarvestDistribution";

/**
 * Financial-state refresh for the harvest & distribute workflow.
 *
 * Fires the direct-contract and indexed invalidations after a stage, then
 * repeats the indexed-query invalidations on the standard indexer-lag
 * schedule: the first refetch commonly reaches Envio before it has processed
 * the block, and that stale response would otherwise stay cached. Refetches
 * are never awaited — the broad wagmi roots span the whole application, and
 * one slow unrelated read must not delay the mutation settling; the outcome
 * renders from the mutation result, and the caller refetches its own reads.
 */
export function useHarvestDistributionInvalidation() {
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const lastKeysRef = useRef<{ garden: string; asset: string } | null>(null);

  const invalidateIndexedState = useCallback(() => {
    const keys = lastKeysRef.current;
    if (!keys) return;
    for (const queryKey of queryInvalidation.onHarvestDistribution(
      keys.garden,
      keys.asset,
      chainId
    )) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [queryClient, chainId]);

  const { start: scheduleIndexerFollowUp } = useProgressiveInvalidation(
    invalidateIndexedState,
    INDEXER_LAG_SCHEDULE_MS
  );

  return (params: HarvestDistributionParams) => {
    // Indexed cache keys are built from lowercased addresses (e.g.
    // useGardenVaults), while params may carry checksummed values.
    lastKeysRef.current = {
      garden: normalizeAddress(params.gardenAddress),
      asset: normalizeAddress(params.assetAddress),
    };
    invalidateIndexedState();
    for (const queryKey of queryInvalidation.onchainReads()) {
      void queryClient.invalidateQueries({ queryKey });
    }
    scheduleIndexerFollowUp();
  };
}
