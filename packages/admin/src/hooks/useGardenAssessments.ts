import { useQuery } from "@tanstack/react-query";

import { fetchGardenAssessments } from "@/modules/eas";
import { useAdminStore } from "@/stores/admin";

export function useGardenAssessments(gardenAddress?: string, limit?: number) {
  const selectedChainId = useAdminStore((state) => state.selectedChainId);

  return useQuery({
    queryKey: ["garden-assessments", selectedChainId, gardenAddress, limit],
    queryFn: () => {
      if (!gardenAddress) {
        return Promise.resolve([]);
      }
      return fetchGardenAssessments({ gardenAddress, chainId: selectedChainId, limit });
    },
    enabled: Boolean(gardenAddress),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
