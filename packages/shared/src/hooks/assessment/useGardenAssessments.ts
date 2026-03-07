import { useQuery } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { getGardenAssessments } from "../../modules/data/eas";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";

export function useGardenAssessments(gardenAddress?: string, chainId: number = DEFAULT_CHAIN_ID) {
  return useQuery({
    queryKey: queryKeys.assessments.byGardenBase(gardenAddress ?? "", chainId),
    queryFn: () => {
      if (!gardenAddress) {
        return Promise.resolve([]);
      }
      return getGardenAssessments(gardenAddress, chainId);
    },
    enabled: Boolean(gardenAddress),
    staleTime: STALE_TIME_MEDIUM,
    refetchInterval: 60_000,
  });
}
