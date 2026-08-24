import { useQuery } from "@tanstack/react-query";
import { getRegisteredHypercertsFromSubgraph } from "../../modules/data/gardens";
import type { Address } from "../../types/domain";
import { normalizeAddress } from "../../utils/blockchain/address";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { STALE_TIME_SLOW } from "../../config/query-keys/constants";
import { convictionKeys } from "../../config/query-keys/hypercert";

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
    queryKey: convictionKeys.registeredHypercerts(normalizedPool ?? "", chainId),
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
