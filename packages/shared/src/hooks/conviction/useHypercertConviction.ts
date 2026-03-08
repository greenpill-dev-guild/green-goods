import { useQuery } from "@tanstack/react-query";
import { getConvictionWeightsFromSubgraph } from "../../modules/data/gardens";
import type { ConvictionWeight } from "../../types/conviction";
import type { Address } from "../../types/domain";
import { normalizeAddress } from "../../utils/blockchain/address";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";

interface UseHypercertConvictionOptions {
  enabled?: boolean;
}

export function useHypercertConviction(
  poolAddress?: Address,
  options: UseHypercertConvictionOptions = {}
) {
  const chainId = useCurrentChain();
  const enabled = options.enabled ?? true;
  const normalizedPool = poolAddress ? normalizeAddress(poolAddress) : undefined;

  const query = useQuery({
    queryKey: queryKeys.conviction.convictionWeights(normalizedPool ?? "", chainId),
    queryFn: async (): Promise<ConvictionWeight[]> => {
      if (!normalizedPool) return [];
      return getConvictionWeightsFromSubgraph(normalizedPool, chainId);
    },
    enabled: enabled && Boolean(normalizedPool),
    staleTime: STALE_TIME_MEDIUM,
  });

  return {
    ...query,
    weights: (query.data ?? []) as ConvictionWeight[],
  };
}
