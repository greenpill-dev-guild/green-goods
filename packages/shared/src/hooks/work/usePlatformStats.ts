import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { STALE_TIMES } from "../../config/react-query";
import { logger } from "../../modules/app/logger";
import { getGardenAssessments, getWorks } from "../../modules/data/eas";
import type { EASGardenAssessment, EASWork } from "../../types/eas-responses";
import { queryKeys } from "../query-keys";

export interface PlatformStats {
  totalWorks: number;
  pendingWorks: number;
  approvedWorks: number;
  totalAssessments: number;
  works: EASWork[];
  assessments: EASGardenAssessment[];
}

/**
 * Fetches platform-wide work and assessment counts from EAS.
 *
 * Uses batched queries — all garden addresses in a single `{ recipient: { in: [...] } }` clause
 * rather than N+1 per-garden fetches. Stale time matches baseLists (5 min) since the
 * dashboard doesn't need real-time counts.
 *
 * @param gardenAddresses - Array of garden contract addresses to query works/assessments for
 */
export function usePlatformStats(gardenAddresses: string[]) {
  const chainId = DEFAULT_CHAIN_ID;

  return useQuery({
    queryKey: queryKeys.platform.stats(chainId),
    queryFn: async (): Promise<PlatformStats> => {
      const [works, assessments] = await Promise.all([
        gardenAddresses.length > 0
          ? getWorks(gardenAddresses, chainId)
          : Promise.resolve([] as EASWork[]),
        getGardenAssessments(undefined, chainId),
      ]);

      logger.debug("Platform stats fetched", {
        works: works.length,
        assessments: assessments.length,
      });

      return {
        totalWorks: works.length,
        pendingWorks: works.length, // All works without approval status at this level
        approvedWorks: 0, // Would need work approvals query — kept simple for dashboard
        totalAssessments: assessments.length,
        works,
        assessments,
      };
    },
    staleTime: STALE_TIMES.baseLists,
    enabled: gardenAddresses.length > 0,
  });
}
