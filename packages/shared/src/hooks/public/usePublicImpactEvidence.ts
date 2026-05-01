/**
 * usePublicImpactEvidence - visitor-safe evidence slice for `/impact`.
 *
 * Aggregates three record kinds into a single ledger:
 *   - **Assessment** — EAS attestations against the Assessment schema
 *   - **Work** — EAS attestations against the Work schema (carries media)
 *   - **Certificate** — Impact Certificates (Hypercerts indexed via Envio)
 *
 * Cycle order on the Impact page is Assessment → Work → Certificate, but the
 * ledger is sorted by `createdAt desc` so the most recent activity surfaces
 * first regardless of kind. The `kind` discriminator lets the UI filter the
 * list per stage without reshaping the data.
 *
 * V1 keeps deterministic local caps (50 candidate Gardens, 100 records per
 * kind during the slice step) so a single Garden with many records doesn't
 * starve the rest. Each source is fetched in parallel with `allSettled`, and
 * failures degrade to `partialData: true` rather than failing the whole page.
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
import { getGardenHypercerts } from "../../modules/data/hypercerts-fetch";

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

      // First pass: pull all Work entries to determine recency-ordered Garden caps.
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

      // Second pass: fetch all three kinds in parallel for the capped Garden set.
      const [assessmentResults, hypercertResults] = await Promise.all([
        Promise.allSettled(
          cappedGardenSources.map((garden) => getGardenAssessments(garden.id, chainId))
        ),
        Promise.allSettled(
          cappedGardenSources.map((garden) => getGardenHypercerts(garden.id, chainId))
        ),
      ]);

      const easFailed = assessmentResults.some((result) => result.status === "rejected");
      const certFailed = hypercertResults.some((result) => result.status === "rejected");
      if (easFailed) {
        logger.warn("[usePublicImpactEvidence] one or more EAS assessment reads failed");
      }
      if (certFailed) {
        logger.warn("[usePublicImpactEvidence] one or more Hypercert reads failed");
      }

      const records: PublicImpactEvidenceRecord[] = [];
      const gardenById = new Map(cappedGardenSources.map((garden) => [garden.id, garden]));

      // Assessments — title + description; no media (CID-only).
      assessmentResults.forEach((result, index) => {
        if (result.status !== "fulfilled") return;
        const garden = cappedGardenSources[index];
        if (!garden) return;
        for (const assessment of result.value) {
          records.push({
            id: `assessment:${assessment.id}`,
            kind: "assessment",
            gardenId: garden.id,
            gardenName: garden.name,
            title: assessment.title,
            domain: assessment.domain,
            summary: assessment.description,
            timeWindow: { start: assessment.startDate, end: assessment.endDate },
            easUid: assessment.id,
            sourceAvailable: Boolean(assessment.assessmentConfigCID),
            createdAt: assessment.createdAt,
          });
        }
      });

      // Work — first-class evidence, carries `media[]` from the EAS Work schema.
      const cappedGardenIds = new Set(cappedGardenSources.map((garden) => garden.id.toLowerCase()));
      for (const work of worksResult) {
        const garden = gardenById.get(work.gardenAddress);
        if (!cappedGardenIds.has(work.gardenAddress.toLowerCase())) continue;
        const gardenContext =
          garden ?? cappedGardenSources.find((g) => g.id === work.gardenAddress);
        if (!gardenContext) continue;
        records.push({
          id: `work:${work.id}`,
          kind: "work",
          gardenId: gardenContext.id,
          gardenName: gardenContext.name,
          title: work.title,
          summary: work.feedback,
          media: work.media,
          easUid: work.id,
          sourceAvailable: work.media.length > 0 || Boolean(work.metadata),
          createdAt: work.createdAt,
        });
      }

      // Certificates — Hypercert mints. `imageUri` is optional but common.
      hypercertResults.forEach((result, index) => {
        if (result.status !== "fulfilled") return;
        const garden = cappedGardenSources[index];
        if (!garden) return;
        for (const cert of result.value) {
          records.push({
            id: `certificate:${cert.id}`,
            kind: "certificate",
            gardenId: garden.id,
            gardenName: garden.name,
            title: cert.title ?? `Impact Certificate · ${cert.tokenId.toString()}`,
            summary: cert.description ?? undefined,
            media: cert.imageUri ? [cert.imageUri] : undefined,
            hypercertId: cert.id,
            sourceAvailable: Boolean(cert.metadataUri),
            createdAt: cert.mintedAt,
          });
        }
      });

      records.sort((left, right) => right.createdAt - left.createdAt);

      return createPublicImpactSlice({
        gardens: gardenSources,
        records,
        page,
        pageSize,
        easFailed,
        partialData: easFailed || certFailed,
      });
    },
    staleTime: STALE_TIME_RARE,
    placeholderData: (previousData) => previousData ?? undefined,
  });
}
