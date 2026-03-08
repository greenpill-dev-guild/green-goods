import { useQuery } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { getGardenAssessments } from "../../modules/data/eas";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";

export function useGardenAssessments(gardenAddress?: string, chainId?: number) {
  const resolvedChainId = chainId ?? DEFAULT_CHAIN_ID;

  return useQuery({
    queryKey: queryKeys.assessments.byGardenBase(gardenAddress ?? "", resolvedChainId),
    queryFn: () => {
      if (!gardenAddress) {
        return Promise.resolve([]);
      }
      return getGardenAssessments(gardenAddress, resolvedChainId);
    },
    enabled: Boolean(gardenAddress),
    staleTime: STALE_TIME_MEDIUM,
    refetchInterval: 60_000,
  });
}
