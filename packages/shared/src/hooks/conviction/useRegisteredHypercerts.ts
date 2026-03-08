import { useQuery } from "@tanstack/react-query";
import { getRegisteredHypercertsFromSubgraph } from "../../modules/data/gardens";
import type { Address } from "../../types/domain";
import { normalizeAddress } from "../../utils/blockchain/address";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { queryKeys, STALE_TIME_SLOW } from "../query-keys";

interface UseRegisteredHypercertsOptions {
  enabled?: boolean;
}

export function useRegisteredHypercerts(
  poolAddress?: Address,
  options: UseRegisteredHypercertsOptions = {}
) {
  const chainId = useCurrentChain();
  const enabled = options.enabled ?? true;
  const normalizedPool = poolAddress ? normalizeAddress(poolAddress) : undefined;

  const query = useQuery({
    queryKey: queryKeys.conviction.registeredHypercerts(normalizedPool ?? "", chainId),
    queryFn: async (): Promise<bigint[]> => {
      if (!normalizedPool) return [];
      return getRegisteredHypercertsFromSubgraph(normalizedPool, chainId);
    },
    enabled: enabled && Boolean(normalizedPool),
    staleTime: STALE_TIME_SLOW,
  });

  return {
    ...query,
    hypercertIds: (query.data ?? []) as bigint[],
  };
}
