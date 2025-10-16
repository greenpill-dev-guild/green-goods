import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import {
  fetchGardenAssessments,
  type GardenAssessmentAttestation,
} from "@/modules/eas";
import { useAdminStore } from "@/stores/admin";
import { parseAssessment, type GardenAssessmentWithParsed } from "@/utils/assessments";

export function useGardenAssessments(
  gardenAddress?: string,
  limit?: number
): UseQueryResult<GardenAssessmentWithParsed[], Error> {
  const selectedChainId = useAdminStore((state) => state.selectedChainId);

  return useQuery<
    GardenAssessmentAttestation[],
    Error,
    GardenAssessmentWithParsed[],
    [string, number, string | undefined, number | undefined]
  >({
    queryKey: ["garden-assessments", selectedChainId, gardenAddress, limit],
    queryFn: () =>
      fetchGardenAssessments({ gardenAddress, chainId: selectedChainId, limit }),
    select: (data) => data.map((attestation) => parseAssessment(attestation)),
    enabled: Boolean(selectedChainId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
