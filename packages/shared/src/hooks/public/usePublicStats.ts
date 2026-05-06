/**
 * usePublicStats — network-wide aggregate stats for the Living Archive's
 * "Quantifiable Restoration" panel and the landing-page Network Total tile.
 *
 * Composes:
 *   - **Envio indexer** (`getGardens`, `getGardeners`).
 *   - **EAS** (`getWorks`, `getGardenAssessments`).
 *
 * No auth path. All four sources are queried with `Promise.allSettled` so
 * one outage doesn't blank the page.
 *
 * ### Indexer-scope gaps surfaced here
 *
 * The Stitch design surfaces several quantifiable metrics that **are not**
 * derivable from the current Envio + EAS sources. They appear in the return
 * type as `undefined` so consuming pages can render placeholder copy until
 * upstream data arrives:
 *
 * - **`carbonSequesteredTons`** — needs IoT/oracle integration (e.g. Silvi,
 *   Pachama). Out of scope for the indexer per CLAUDE.md "Indexer Boundary".
 * - **`waterRetentionPercent`** — same constraint as carbon; sensor-derived.
 * - **`speciesPlanted`** — would need either a structured field on Work
 *   submissions or a curated species registry. Neither exists today.
 * - **`areaRegeneratingSqFt`** — relies on garden geometry data we don't
 *   index. Could later be added to `Garden` metadata via ENS text records.
 *
 * The hook reports counts that **are** derivable (gardens, contributors,
 * field notes, attestations) so the page can render at least one credible
 * tile.
 */

import { useQuery } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { queryKeys } from "../../config/query-keys";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { logger } from "../../modules/app/logger";
import { getGardenAssessments, getWorks } from "../../modules/data/eas";
import { getGardeners, getGardens } from "../../modules/data/greengoods";

export interface PublicStats {
  gardenCount: number;
  contributorCount: number;
  fieldNoteCount: number;
  attestationCount: number;

  // ----- Indexer-scope gaps -----
  // These remain `undefined` in v1; see file header for the data-source
  // requirements that would unlock each metric.
  carbonSequesteredTons?: number;
  waterRetentionPercent?: number;
  speciesPlanted?: number;
  areaRegeneratingSqFt?: number;
}

export function usePublicStats(chainId: number = DEFAULT_CHAIN_ID) {
  return useQuery({
    queryKey: queryKeys.public.stats(chainId),
    queryFn: async (): Promise<PublicStats> => {
      const [gardensResult, gardenersResult, worksResult, assessmentsResult] =
        await Promise.allSettled([
          getGardens(),
          getGardeners(),
          getWorks(undefined, chainId),
          getGardenAssessments(undefined, chainId),
        ]);

      if (gardensResult.status === "rejected") {
        logger.warn("[usePublicStats] gardens fetch failed", { error: gardensResult.reason });
      }
      if (gardenersResult.status === "rejected") {
        logger.warn("[usePublicStats] gardeners fetch failed", { error: gardenersResult.reason });
      }
      if (worksResult.status === "rejected") {
        logger.warn("[usePublicStats] works fetch failed", { error: worksResult.reason });
      }
      if (assessmentsResult.status === "rejected") {
        logger.warn("[usePublicStats] assessments fetch failed", {
          error: assessmentsResult.reason,
        });
      }

      const gardens = gardensResult.status === "fulfilled" ? gardensResult.value : [];
      const gardeners = gardenersResult.status === "fulfilled" ? gardenersResult.value : [];
      const works = worksResult.status === "fulfilled" ? worksResult.value : [];
      const assessments = assessmentsResult.status === "fulfilled" ? assessmentsResult.value : [];

      // Gardens: include only initialized rows (same heuristic as
      // usePublicGardens — name OR location set).
      const visibleGardens = gardens.filter(
        (g) => (g.name ?? "").trim().length > 0 || (g.location ?? "").trim().length > 0
      );

      return {
        gardenCount: visibleGardens.length,
        contributorCount: gardeners.length,
        fieldNoteCount: works.length,
        attestationCount: assessments.length,
        // Oracle-derived metrics intentionally left undefined — see header.
      };
    },
    staleTime: STALE_TIME_RARE,
    placeholderData: (previousData) => previousData ?? undefined,
  });
}
