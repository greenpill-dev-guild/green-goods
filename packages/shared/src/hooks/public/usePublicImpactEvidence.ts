/**
 * usePublicImpactEvidence - visitor-safe evidence slice for `/impact`.
 *
 * V1 uses the current shared EAS reads and applies deterministic local caps:
 * 50 candidate Gardens and 100 assessment records. `getGardenAssessments`
 * cannot currently limit per Garden, so this hook accepts that per-Garden
 * overfetch for v1 and preserves `sourceLimitReached` for UI honesty.
 */

import { useQuery } from "@tanstack/react-query";
import {
  createPublicImpactSlice,
  PUBLIC_IMPACT_DEFAULT_PAGE_SIZE,
  PUBLIC_IMPACT_GARDEN_FETCH_CAP,
  type PublicImpactEvidenceRecord,
  type PublicImpactSlice,
} from "../../public-contracts";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { queryKeys } from "../../config/query-keys";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { logger } from "../../modules/app/logger";
import { getGardenAssessments, getWorks } from "../../modules/data/eas";
import { getGardens } from "../../modules/data/greengoods";

export interface UsePublicImpactEvidenceOptions {
  page?: number;
  pageSize?: number;
  chainId?: number;
}

export function usePublicImpactEvidence(options: UsePublicImpactEvidenceOptions = {}) {
  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, options.pageSize ?? PUBLIC_IMPACT_DEFAULT_PAGE_SIZE);

  return useQuery({
    queryKey: queryKeys.public.impactEvidence(chainId, page, pageSize),
    queryFn: async (): Promise<PublicImpactSlice> => {
      const gardens = await getGardens();
      const visibleGardens = gardens.filter(
        (garden) =>
          (garden.name ?? "").trim().length > 0 || (garden.location ?? "").trim().length > 0
      );

      const worksResult = await getWorks(
        visibleGardens.map((garden) => garden.id),
        chainId
      ).catch((error) => {
        logger.warn("[usePublicImpactEvidence] EAS works fetch failed", { error });
        return [];
      });

      const latestWorkByGarden = new Map<string, number>();
      for (const work of worksResult) {
        const key = work.gardenAddress.toLowerCase();
        latestWorkByGarden.set(key, Math.max(latestWorkByGarden.get(key) ?? 0, work.createdAt));
      }

      const gardenSources = visibleGardens.map((garden) => ({
        id: garden.id,
        address: garden.id,
        name: garden.name,
        location: garden.location,
        latestActivityAt:
          latestWorkByGarden.get(garden.id.toLowerCase()) ??
          Math.floor((garden.createdAt ?? Date.now()) / 1000),
      }));

      const cappedGardenSources = [...gardenSources]
        .sort((left, right) => {
          const activityDelta = (right.latestActivityAt ?? 0) - (left.latestActivityAt ?? 0);
          if (activityDelta !== 0) return activityDelta;
          return left.id.localeCompare(right.id);
        })
        .slice(0, PUBLIC_IMPACT_GARDEN_FETCH_CAP);

      const assessmentResults = await Promise.allSettled(
        cappedGardenSources.map((garden) => getGardenAssessments(garden.id, chainId))
      );
      const easFailed = assessmentResults.some((result) => result.status === "rejected");
      if (easFailed) {
        logger.warn("[usePublicImpactEvidence] one or more EAS assessment reads failed");
      }

      const records: PublicImpactEvidenceRecord[] = assessmentResults.flatMap((result, index) => {
        if (result.status !== "fulfilled") return [];
        const garden = cappedGardenSources[index];
        if (!garden) return [];
        return result.value.map((assessment) => ({
          id: assessment.id,
          gardenId: garden.id,
          gardenName: garden.name,
          title: assessment.title,
          domain: assessment.domain,
          summary: assessment.description,
          timeWindow: { start: assessment.startDate, end: assessment.endDate },
          easUid: assessment.id,
          sourceAvailable: Boolean(assessment.assessmentConfigCID),
          createdAt: assessment.createdAt,
        }));
      });

      return createPublicImpactSlice({
        gardens: gardenSources,
        records,
        page,
        pageSize,
        easFailed,
        partialData: easFailed,
      });
    },
    staleTime: STALE_TIME_RARE,
    placeholderData: (previousData) => previousData ?? undefined,
  });
}
