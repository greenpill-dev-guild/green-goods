/**
 * usePublicStats — network-wide aggregate stats for the Living Archive's
 * "Quantifiable Restoration" panel and the landing-page Network Total tile.
 *
 * Composes:
 *   - **Envio indexer** (`getGardens`): the gardens and their gardeners.
 *   - **EAS** (`getWorks`, then `readApprovedWorks`; `getGardenAssessments`).
 *
 * Every count covers the gardens the website lists, the same set the archive
 * shows, and entries count approved work only. Hands at work are the
 * gardeners of those gardens, each address once.
 *
 * No auth path. All three sources are queried with `Promise.allSettled` so
 * one outage doesn't blank the page. Without the garden list no count can be
 * scoped to listed gardens, so every count is zero.
 *
 * ### Indexer-scope gaps surfaced here
 *
 * The external visual handoff surfaces several quantifiable metrics that **are not**
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

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { isGardenPubliclyVisible } from "../../config/garden-visibility";
import { publicKeys } from "../../config/query-keys/public";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { logger } from "../../modules/app/logger";
import { getGardenAssessments, getWorks } from "../../modules/data/eas";
import { getGardens } from "../../modules/data/greengoods";
import { readApprovedWorks } from "../../modules/work/work-list";

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
    queryKey: publicKeys.stats(chainId),
    queryFn: async (): Promise<PublicStats> => {
      const [gardensResult, worksResult, assessmentsResult] = await Promise.allSettled([
        getGardens(),
        getWorks(undefined, chainId),
        getGardenAssessments(undefined, chainId),
      ]);

      if (gardensResult.status === "rejected") {
        logger.warn("[usePublicStats] gardens fetch failed", { error: gardensResult.reason });
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
      const works = worksResult.status === "fulfilled" ? worksResult.value : [];
      const assessments = assessmentsResult.status === "fulfilled" ? assessmentsResult.value : [];

      // Same predicate the archive and the evidence ledger use, so no headline
      // count can include a garden a visitor cannot browse, or its people and records.
      const visibleGardens = gardens.filter(isGardenPubliclyVisible);
      const listed = new Set(visibleGardens.map((garden) => garden.id.toLowerCase()));
      const inListedGarden = (gardenAddress: string) => listed.has(gardenAddress.toLowerCase());
      const { works: approvedWorks } = await readApprovedWorks(
        works.filter((work) => inListedGarden(work.gardenAddress)),
        chainId
      );
      const gardeners = new Set(
        visibleGardens.flatMap((garden) => garden.gardeners.map((address) => address.toLowerCase()))
      );

      return {
        gardenCount: visibleGardens.length,
        contributorCount: gardeners.size,
        fieldNoteCount: approvedWorks.length,
        attestationCount: assessments.filter((assessment) =>
          inListedGarden(assessment.gardenAddress)
        ).length,
        // Oracle-derived metrics intentionally left undefined — see header.
      };
    },
    staleTime: STALE_TIME_RARE,
    placeholderData: (previousData) => previousData ?? undefined,
  });
}
