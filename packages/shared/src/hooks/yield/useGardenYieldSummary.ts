import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { logger } from "../../modules/app/logger";
import { getGardenYieldAllocations } from "../../modules/data/yield-allocations";
import type { Address } from "../../types/domain";
import { normalizeAddress } from "../../utils/blockchain/address";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";
import {
  type AggregateYieldSummary,
  EMPTY_YIELD_SUMMARY,
  summarizeYieldAllocations,
} from "./summary";

/** Aggregated yield summary for a single garden */
export interface GardenYieldSummary extends AggregateYieldSummary {}

interface UseGardenYieldSummaryOptions {
  enabled?: boolean;
}

/**
 * Fetches ALL yield allocations for a garden (no limit) and aggregates
 * them into a summary. Fixes the bug where the Community tab undercounted
 * yield after 20 allocation events.
 */
export function useGardenYieldSummary(
  gardenAddress?: Address,
  options: UseGardenYieldSummaryOptions = {}
) {
  const chainId = useCurrentChain();
  const enabled = (options.enabled ?? true) && Boolean(gardenAddress);
  const normalizedGarden = gardenAddress ? normalizeAddress(gardenAddress) : undefined;

  const query = useQuery({
    queryKey: queryKeys.yield.gardenSummary(normalizedGarden ?? "", chainId),
    queryFn: async () => {
      if (!normalizedGarden) return [];
      const allocations = await getGardenYieldAllocations(normalizedGarden as Address, chainId);
      logger.debug("[useGardenYieldSummary] Fetched allocations", {
        gardenAddress: normalizedGarden,
        chainId,
        count: allocations.length,
      });
      return allocations;
    },
    enabled,
    staleTime: STALE_TIME_MEDIUM,
  });

  const summary = useMemo(
    (): GardenYieldSummary => summarizeYieldAllocations(query.data) as GardenYieldSummary,
    [query.data]
  );

  return {
    ...query,
    summary: query.isError ? (EMPTY_YIELD_SUMMARY as GardenYieldSummary) : summary,
  };
}
