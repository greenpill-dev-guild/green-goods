import { useQuery } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { getGardenAssessments } from "../../modules/data/eas";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { assessmentsKeys } from "../../config/query-keys/garden";
export function useGardenAssessments(gardenAddress?: string, chainId?: number) {
  const resolvedChainId = chainId ?? DEFAULT_CHAIN_ID;

  return useQuery({
    queryKey: assessmentsKeys.byGardenBase(gardenAddress ?? "", resolvedChainId),
    queryFn: async () => {
      if (!gardenAddress) {
        return [];
      }
      return getGardenAssessments(gardenAddress, resolvedChainId);
    },
    enabled: Boolean(gardenAddress),
    staleTime: STALE_TIME_MEDIUM,
    refetchInterval: 60_000,
  });
}
