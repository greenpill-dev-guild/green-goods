import { useQuery } from "@tanstack/react-query";

import { getGardenAssessments } from "../../modules/data/eas";
import { useAdminStore, type AdminState } from "../../stores/useAdminStore";

export function useGardenAssessments(gardenAddress?: string, limit?: number) {
  const selectedChainId = useAdminStore((state: AdminState) => state.selectedChainId);

  return useQuery({
    queryKey: ["garden-assessments", selectedChainId, gardenAddress, limit],
    queryFn: () => {
      if (!gardenAddress) {
        return Promise.resolve([]);
      }
      return getGardenAssessments(gardenAddress, selectedChainId);
    },
    enabled: Boolean(gardenAddress),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
