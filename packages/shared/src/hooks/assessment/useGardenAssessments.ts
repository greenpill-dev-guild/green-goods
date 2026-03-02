import { useQuery } from "@tanstack/react-query";

import { getGardenAssessments } from "../../modules/data/eas";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";

export function useGardenAssessments(gardenAddress?: string) {
  const selectedChainId = useAdminStore((state: AdminState) => state.selectedChainId);

  return useQuery({
    queryKey: queryKeys.assessments.byGardenBase(gardenAddress ?? "", selectedChainId),
    queryFn: () => {
      if (!gardenAddress) {
        return Promise.resolve([]);
      }
      return getGardenAssessments(gardenAddress, selectedChainId);
    },
    enabled: Boolean(gardenAddress),
    staleTime: STALE_TIME_MEDIUM,
    refetchInterval: 60_000,
  });
}
