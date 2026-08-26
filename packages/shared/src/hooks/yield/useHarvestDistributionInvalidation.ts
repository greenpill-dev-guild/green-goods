import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useProgressiveInvalidation } from "../utils/useTimeout";
import type { HarvestDistributionParams } from "./useHarvestDistribution";

/**
 * Financial-state refresh for the harvest & distribute workflow.
 *
 * Runs the immediate direct-contract and indexed invalidations after a stage,
 * then repeats the indexed-query invalidations on the standard indexer-lag
 * schedule: the first refetch commonly reaches Envio before it has processed
 * the block, and that stale response would otherwise stay cached.
 */
export function useHarvestDistributionInvalidation() {
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const lastParamsRef = useRef<HarvestDistributionParams | null>(null);

  const invalidateIndexedState = useCallback(() => {
    const params = lastParamsRef.current;
    if (!params) return;
    for (const queryKey of queryInvalidation.onHarvestDistribution(
      params.gardenAddress,
      params.assetAddress,
      chainId
    )) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [queryClient, chainId]);

  const { start: scheduleIndexerFollowUp } = useProgressiveInvalidation(
    invalidateIndexedState,
    INDEXER_LAG_SCHEDULE_MS
  );

  return async (params: HarvestDistributionParams) => {
    lastParamsRef.current = params;
    const invalidations = queryInvalidation.onHarvestDistribution(
      params.gardenAddress,
      params.assetAddress,
      chainId
    );
    await Promise.all(
      [...invalidations, ...queryInvalidation.onchainReads()].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey })
      )
    );
    scheduleIndexerFollowUp();
  };
}
