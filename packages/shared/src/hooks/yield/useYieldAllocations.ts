import { useQuery } from "@tanstack/react-query";
import { logger } from "../../modules/app/logger";
import { greenGoodsIndexer } from "../../modules/data/graphql-client";
import type { Address } from "../../types/domain";
import type { YieldAllocation } from "../../types/gardens-community";
import { normalizeAddress } from "../../utils/blockchain/address";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";

interface UseYieldAllocationsOptions {
  enabled?: boolean;
  limit?: number;
}

/** GraphQL response shape for yield allocations */
interface YieldAllocationResponse {
  YieldAllocation: Array<{
    garden: string;
    asset: string;
    cookieJarAmount: string;
    fractionsAmount: string;
    juiceboxAmount: string;
    timestamp: number;
    txHash: string;
  }>;
}

const YIELD_ALLOCATIONS_QUERY = `
  query YieldAllocations($garden: String!, $chainId: Int!, $limit: Int!) {
    YieldAllocation(
      where: { garden: { _eq: $garden }, chainId: { _eq: $chainId } }
      order_by: { timestamp: desc }
      limit: $limit
    ) {
      garden
      asset
      cookieJarAmount
      fractionsAmount
      juiceboxAmount
      timestamp
      txHash
    }
  }
`;

/**
 * Query yield allocation history for a garden from the indexer.
 * Returns allocation records sorted by most recent first.
 */
export function useYieldAllocations(
  gardenAddress?: Address,
  options: UseYieldAllocationsOptions = {}
) {
  const chainId = useCurrentChain();
  const enabled = options.enabled ?? true;
  const limit = options.limit ?? 20;
  const normalizedGarden = gardenAddress ? normalizeAddress(gardenAddress) : undefined;

  const query = useQuery({
    queryKey: queryKeys.yield.allocations(normalizedGarden ?? "", chainId, limit),
    queryFn: async (): Promise<YieldAllocation[]> => {
      if (!normalizedGarden) return [];

      const { data, error } = await greenGoodsIndexer.query<YieldAllocationResponse>(
        YIELD_ALLOCATIONS_QUERY,
        { garden: normalizedGarden, chainId, limit },
        "YieldAllocations"
      );

      if (error) {
        logger.error("Yield allocations query failed", {
          error,
          gardenAddress: normalizedGarden,
          chainId,
        });
        throw error;
      }

      if (!data) return [];

      return (data.YieldAllocation ?? []).map((row) => ({
        gardenAddress: row.garden as Address,
        assetAddress: row.asset as Address,
        cookieJarAmount: BigInt(row.cookieJarAmount),
        fractionsAmount: BigInt(row.fractionsAmount),
        juiceboxAmount: BigInt(row.juiceboxAmount),
        timestamp: row.timestamp,
        txHash: row.txHash,
      }));
    },
    enabled: enabled && Boolean(normalizedGarden),
    staleTime: STALE_TIME_MEDIUM,
    // Ensure chain switches never flash stale allocations from a previous scope.
    placeholderData: [],
  });

  return {
    ...query,
    allocations: (query.data ?? []) as YieldAllocation[],
  };
}
