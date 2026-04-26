/**
 * usePublicGardenDetail — single-garden read for `/sites/:slug` pages.
 *
 * Composes:
 *   - **Envio indexer** (`getGardens`): garden record + role addresses.
 *   - **EAS** (`getWorks`): public field notes for the garden, paginated.
 *   - **EAS** (`getGardenAssessments`): evaluator-attestation count, used by
 *     the "Verified Site" badge on the public detail page.
 *
 * No auth path. The slug parameter accepts either a derived slug ("pacific-
 * northwest-conservatory") or a raw garden address (fallback when the slug
 * collides or hasn't been registered yet).
 *
 * ### Indexer-scope gaps surfaced here
 *
 * - **No on-chain `slug`** — we resolve via `deriveSlug(name)` then fall
 *   back to address match. The Seasons primitive (when it lands) should
 *   move slug onto the contract.
 * - **No assessment detail in indexer** — `GardenAssessment` lives entirely
 *   in EAS; this hook returns an aggregate count only. Detail pages can
 *   call `useGardenAssessments` (auth-gated) for the full attestation list.
 * - **Hypercert linkage** is in the indexer (`Hypercert.garden`) but display
 *   metadata (image, description) is intentionally out-of-scope per the
 *   indexer boundary, so this hook does not surface hypercerts. Use
 *   `useHypercerts({ gardenId })` for that path.
 */

import { useQuery } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { queryKeys } from "../../config/query-keys";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { logger } from "../../modules/app/logger";
import { getGardenAssessments, getWorks } from "../../modules/data/eas";
import { getGardens } from "../../modules/data/greengoods";
import type { Address, Garden } from "../../types/domain";
import type { EASWork } from "../../types/eas-responses";
import { publicGardenHelpers } from "./usePublicGardens";

export interface PublicFieldNote {
  id: string;
  title: string;
  feedback: string;
  media: string[];
  gardenerAddress: Address;
  gardenAddress: Address;
  actionUID: number;
  /** Seconds since epoch (EAS native unit). */
  createdAt: number;
}

export interface PublicGardenContributor {
  address: Address;
  /** Number of approved field notes the contributor has logged at this garden. */
  fieldNoteCount: number;
}

export interface PublicGardenDetail {
  garden: Garden | null;
  fieldNotes: PublicFieldNote[];
  contributors: PublicGardenContributor[];
  /** Count of evaluator attestations published for this garden (EAS). */
  assessmentCount: number;
  /** Total field-note count (not capped by `fieldNotesLimit`). */
  totalFieldNotes: number;
}

export interface UsePublicGardenDetailOptions {
  fieldNotesLimit?: number;
  chainId?: number;
}

const DEFAULT_FIELD_NOTES_LIMIT = 10;

function adaptWorkToFieldNote(work: EASWork): PublicFieldNote {
  return {
    id: work.id,
    title: work.title,
    feedback: work.feedback,
    media: work.media,
    gardenerAddress: work.gardenerAddress,
    gardenAddress: work.gardenAddress,
    actionUID: work.actionUID,
    createdAt: work.createdAt,
  };
}

export function usePublicGardenDetail(
  slugOrAddress: string | undefined,
  options: UsePublicGardenDetailOptions = {}
) {
  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const fieldNotesLimit = options.fieldNotesLimit ?? DEFAULT_FIELD_NOTES_LIMIT;
  const lookup = slugOrAddress?.trim().toLowerCase() ?? "";

  return useQuery({
    queryKey: queryKeys.public.gardenDetail(lookup || "none", chainId),
    enabled: lookup.length > 0,
    queryFn: async (): Promise<PublicGardenDetail> => {
      const gardens = await getGardens();

      const matched =
        gardens.find((g) => g.id.toLowerCase() === lookup) ??
        gardens.find(
          (g) => publicGardenHelpers.deriveSlug(g.name ?? "", g.id).toLowerCase() === lookup
        ) ??
        null;

      if (!matched) {
        return {
          garden: null,
          fieldNotes: [],
          contributors: [],
          assessmentCount: 0,
          totalFieldNotes: 0,
        };
      }

      // EAS reads: works for this garden + assessment summary. Both are
      // best-effort so a single source outage doesn't blank the page.
      const [worksResult, assessmentsResult] = await Promise.allSettled([
        getWorks(matched.id, chainId),
        getGardenAssessments(matched.id, chainId),
      ]);

      const allWorks = worksResult.status === "fulfilled" ? worksResult.value : [];
      const assessments = assessmentsResult.status === "fulfilled" ? assessmentsResult.value : [];

      if (worksResult.status === "rejected") {
        logger.warn("[usePublicGardenDetail] EAS works fetch failed", {
          error: worksResult.reason,
          garden: matched.id,
        });
      }
      if (assessmentsResult.status === "rejected") {
        logger.warn("[usePublicGardenDetail] EAS assessments fetch failed", {
          error: assessmentsResult.reason,
          garden: matched.id,
        });
      }

      // Sort newest first; cap at fieldNotesLimit for UI rendering.
      const sortedWorks = [...allWorks].sort((a, b) => b.createdAt - a.createdAt);
      const visible = sortedWorks.slice(0, fieldNotesLimit).map(adaptWorkToFieldNote);

      // Tally contributor activity over the FULL work set (not just the
      // visible page) so the contributor list reflects total participation.
      const counts = new Map<string, number>();
      for (const work of sortedWorks) {
        const key = work.gardenerAddress.toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const contributors: PublicGardenContributor[] = Array.from(counts.entries())
        .map(([address, fieldNoteCount]) => ({
          address: address as Address,
          fieldNoteCount,
        }))
        .sort((a, b) => b.fieldNoteCount - a.fieldNoteCount);

      return {
        garden: matched,
        fieldNotes: visible,
        contributors,
        assessmentCount: assessments.length,
        totalFieldNotes: sortedWorks.length,
      };
    },
    staleTime: STALE_TIME_RARE,
    placeholderData: (previousData) => previousData ?? undefined,
  });
}
