/**
 * usePublicGardenDetail — single-garden read for the public `/gardens/:id` page.
 *
 * Composes:
 *   - **Envio indexer** (`getGardens`): garden record + role addresses.
 *   - **EAS** (`getWorks`): every public field note for the garden. The caller
 *     owns the visible window (see `fieldNotes`).
 *   - **EAS** (`getGardenAssessments`): evaluator-attestation count, used by
 *     the "Verified Site" badge on the public detail page.
 *
 * Both EAS reads are best-effort, and a failed read returns an empty list. That
 * is indistinguishable from a genuinely empty garden, so failures are reported
 * on `partialData` / `unavailableSources` rather than only logged.
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

import { DEFAULT_CHAIN_ID, getEASConfig } from "../../config/blockchain";
import { isGardenPubliclyVisible } from "../../config/garden-visibility";
import { queryKeys } from "../../config/query-keys";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { logger } from "../../modules/app/logger";
import { getGardenAssessments, getWorks } from "../../modules/data/eas";
import { getGardens } from "../../modules/data/greengoods";
import type { Address, Garden } from "../../types/domain";
import type { EASWork } from "../../types/eas-responses";
import { isZeroBytes32 } from "../../utils/blockchain/vaults";
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

/**
 * Which best-effort EAS reads failed. A failed read yields an empty list, which
 * is indistinguishable from a genuinely empty garden — so callers that publish
 * counts need to know the difference before claiming zero.
 */
export interface PublicGardenUnavailableSources {
  works: boolean;
  assessments: boolean;
}

export interface PublicGardenDetail {
  garden: Garden | null;
  /**
   * Every public field note for the garden, newest first. Callers own the
   * visible window: the query key does not carry a page size, so a caller that
   * asked the hook to slice could never widen the slice without a refetch.
   */
  fieldNotes: PublicFieldNote[];
  contributors: PublicGardenContributor[];
  /** Count of evaluator attestations published for this garden (EAS). */
  assessmentCount: number;
  /** Total field-note count. Equal to `fieldNotes.length`; kept for callers that render "N of M". */
  totalFieldNotes: number;
  /** True when either EAS read failed. Same name and meaning as `usePublicImpactEvidence`. */
  partialData: boolean;
  unavailableSources: PublicGardenUnavailableSources;
}

export interface UsePublicGardenDetailOptions {
  chainId?: number;
}

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
  const lookup = slugOrAddress?.trim().toLowerCase() ?? "";

  return useQuery({
    queryKey: queryKeys.public.gardenDetail(lookup || "none", chainId),
    enabled: lookup.length > 0,
    queryFn: async (): Promise<PublicGardenDetail> => {
      // Resolve against the public set only. Without this, a garden curated
      // off the archive would still render a full detail page at its own URL,
      // which is the leak the curation is meant to close.
      const gardens = (await getGardens()).filter(isGardenPubliclyVisible);

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
          partialData: false,
          unavailableSources: { works: false, assessments: false },
        };
      }

      // EAS reads: works for this garden + assessment summary. Both are
      // best-effort so a single source outage doesn't blank the page. Each
      // failure is reported on `unavailableSources` — an empty list from a
      // failed read means "we don't know", and a public page that renders it
      // as 0 states something it cannot support.
      const [worksResult, assessmentsResult] = await Promise.allSettled([
        getWorks(matched.id, chainId),
        getGardenAssessments(matched.id, chainId),
      ]);

      const allWorks = worksResult.status === "fulfilled" ? worksResult.value : [];
      const assessments = assessmentsResult.status === "fulfilled" ? assessmentsResult.value : [];

      // A rejected read is not the only way to not-know. Both readers return a
      // fulfilled `[]` when their schema UID is unset on this chain, which
      // `allSettled` cannot distinguish from a genuinely empty garden — and a
      // page that renders that as 0 states something it cannot support, which
      // is the whole point of these flags.
      const easConfig = getEASConfig(chainId);
      const unavailableSources: PublicGardenUnavailableSources = {
        works: worksResult.status === "rejected" || isZeroBytes32(easConfig.WORK.uid),
        assessments:
          assessmentsResult.status === "rejected" || isZeroBytes32(easConfig.ASSESSMENT.uid),
      };

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

      // Sort newest first. No cap: the query key carries no page size, so a
      // caller that wanted more than a hook-side slice could never get it
      // without a second fetch. The full set is already in memory here.
      const sortedWorks = [...allWorks].sort((a, b) => b.createdAt - a.createdAt);
      const fieldNotes = sortedWorks.map(adaptWorkToFieldNote);

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
        fieldNotes,
        contributors,
        assessmentCount: assessments.length,
        totalFieldNotes: fieldNotes.length,
        partialData: unavailableSources.works || unavailableSources.assessments,
        unavailableSources,
      };
    },
    staleTime: STALE_TIME_RARE,
  });
}
