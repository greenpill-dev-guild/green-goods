import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { logger } from "../../modules/app/logger";
import { getAllYieldAllocations } from "../../modules/data/yield-allocations";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";

/** Aggregated protocol-wide yield summary */
export interface ProtocolYieldSummary {
  /** Total yield allocated across all gardens */
  totalYield: bigint;
  /** Total sent to Cookie Jars */
  totalCookieJar: bigint;
  /** Total used for fraction purchases */
  totalFractions: bigint;
  /** Total sent to Juicebox treasury */
  totalJuicebox: bigint;
  /** Number of yield allocation events */
  allocationCount: number;
}

const EMPTY_SUMMARY: ProtocolYieldSummary = {
  totalYield: 0n,
  totalCookieJar: 0n,
  totalFractions: 0n,
  totalJuicebox: 0n,
  allocationCount: 0,
};

interface UseProtocolYieldSummaryOptions {
  enabled?: boolean;
}

/**
 * Aggregates all yield allocations across the protocol into a summary.
 * Fetches all YieldAllocation records from the indexer and sums client-side.
 */
export function useProtocolYieldSummary(options: UseProtocolYieldSummaryOptions = {}) {
  const chainId = useCurrentChain();
  const enabled = options.enabled ?? true;

  const query = useQuery({
    queryKey: queryKeys.yield.protocolSummary(chainId),
    queryFn: async () => {
      const allocations = await getAllYieldAllocations(chainId);

      logger.debug("[useProtocolYieldSummary] Aggregating allocations", {
        chainId,
        count: allocations.length,
      });

      return allocations;
    },
    enabled,
    staleTime: STALE_TIME_MEDIUM,
    placeholderData: [],
  });

  const summary = useMemo((): ProtocolYieldSummary => {
    const allocations = query.data;
    if (!allocations || allocations.length === 0) return EMPTY_SUMMARY;

    let totalYield = 0n;
    let totalCookieJar = 0n;
    let totalFractions = 0n;
    let totalJuicebox = 0n;

    for (const allocation of allocations) {
      totalYield += allocation.totalAmount;
      totalCookieJar += allocation.cookieJarAmount;
      totalFractions += allocation.fractionsAmount;
      totalJuicebox += allocation.juiceboxAmount;
    }

    return {
      totalYield,
      totalCookieJar,
      totalFractions,
      totalJuicebox,
      allocationCount: allocations.length,
    };
  }, [query.data]);

  return {
    ...query,
    summary,
  };
}
