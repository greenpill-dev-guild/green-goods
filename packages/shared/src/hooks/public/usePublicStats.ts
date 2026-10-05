/**
 * usePublicStats — network-wide aggregate stats for the Living Archive's
 * "Quantifiable Restoration" panel and the landing-page Network Total tile.
 *
 * Composes:
 *   - **Envio indexer** (`getGardens`): the gardens and their gardeners.
 *   - **EAS** (`fetchListedApprovedWorks`, shared with the other public
 *     aggregates on a page; `getGardenAssessments`).
 *
 * Every count covers the gardens the website lists, the same set the archive
 * shows, and entries count approved work only. Hands at work are the
 * gardeners and stewards of those gardens, each address once.
 *
 * No auth path. Every source is best-effort, so one outage doesn't blank the
 * page: gardens and assessments settle side by side, then the listed gardens'
 * approved work is read. A count that cannot be established is
 * `null`, never zero: a failed read, or a decision that could not be read,
 * leaves the number unknown. Without the garden list no count can be scoped
 * to listed gardens, so every count is `null`.
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

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { isGardenPubliclyVisible } from "../../config/garden-visibility";
import { publicKeys } from "../../config/query-keys/public";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { logger } from "../../modules/app/logger";
import { getGardenAssessments } from "../../modules/data/eas";
import { getGardens } from "../../modules/data/greengoods";
import { fetchListedApprovedWorks } from "./listedApprovedWorks";
import { publicGardenHelpers } from "./usePublicGardens";

/** Each count is `null` when it could not be established; see the file header. */
export interface PublicStats {
  gardenCount: number | null;
  contributorCount: number | null;
  fieldNoteCount: number | null;
  attestationCount: number | null;

  // ----- Indexer-scope gaps -----
  // These remain `undefined` in v1; see file header for the data-source
  // requirements that would unlock each metric.
  carbonSequesteredTons?: number;
  waterRetentionPercent?: number;
  speciesPlanted?: number;
  areaRegeneratingSqFt?: number;
}

export function usePublicStats(chainId: number = DEFAULT_CHAIN_ID) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: publicKeys.stats(chainId),
    queryFn: async (): Promise<PublicStats> => {
      const [gardensResult, assessmentsResult] = await Promise.allSettled([
        getGardens(),
        getGardenAssessments(undefined, chainId),
      ]);

      if (gardensResult.status === "rejected") {
        logger.warn("[usePublicStats] gardens fetch failed", { error: gardensResult.reason });
      }
      if (assessmentsResult.status === "rejected") {
        logger.warn("[usePublicStats] assessments fetch failed", {
          error: assessmentsResult.reason,
        });
      }

      if (gardensResult.status === "rejected") {
        return {
          gardenCount: null,
          contributorCount: null,
          fieldNoteCount: null,
          attestationCount: null,
        };
      }

      // Same predicate the archive and the evidence ledger use, so no headline
      // count can include a garden a visitor cannot browse, or its people and records.
      const visibleGardens = gardensResult.value.filter(isGardenPubliclyVisible);
      const listed = new Set(visibleGardens.map((garden) => garden.id.toLowerCase()));
      const inListedGarden = (gardenAddress: string) => listed.has(gardenAddress.toLowerCase());
      // The same people each garden's own count is built from, so the total
      // is those counts with a person in two gardens counted once.
      const gardeners = new Set(visibleGardens.flatMap(publicGardenHelpers.gardenerAddresses));

      // The listed gardens' approved work, through the read the page's other
      // aggregates share. A read that fails or comes back partial is unknown.
      const approved = await fetchListedApprovedWorks(
        queryClient,
        visibleGardens.map((garden) => garden.id),
        chainId
      );

      return {
        gardenCount: visibleGardens.length,
        contributorCount: gardeners.size,
        fieldNoteCount: approved.partial ? null : approved.works.length,
        attestationCount:
          assessmentsResult.status === "fulfilled"
            ? assessmentsResult.value.filter((assessment) =>
                inListedGarden(assessment.gardenAddress)
              ).length
            : null,
        // Oracle-derived metrics intentionally left undefined — see header.
      };
    },
    staleTime: STALE_TIME_RARE,
    placeholderData: (previousData) => previousData ?? undefined,
  });
}
