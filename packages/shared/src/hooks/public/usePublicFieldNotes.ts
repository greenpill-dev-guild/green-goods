/**
 * usePublicFieldNotes — paginated public feed of field notes (action submissions)
 * for the Living Archive `/field-notes` route.
 *
 * Composes:
 *   - **Envio indexer** (`getGardens`): list of garden addresses for the chain,
 *     used as the recipient batch when no `gardenAddress` filter is supplied.
 *   - **EAS** (`getWorks`): the Work attestations that become public field
 *     notes.
 *
 * No auth path — every approved on-chain `Work` attestation is treated as
 * public for v1.
 *
 * ### Indexer-scope gaps surfaced here
 *
 * - **No `public-readable` flag** on action submissions (Work attestations).
 *   v1 ships default-public; per the plan's open question, an opt-in flag at
 *   the action level may land later. When it does, the queryFn should add a
 *   `where` clause filtering on that flag — until then this hook surfaces all
 *   non-revoked Work attestations.
 * - **No volume binding** at the indexer/EAS level. The `volume` option is
 *   accepted for forward-compat with the Seasons primitive but currently
 *   filters by the hardcoded Season One window from `usePublicVolume`.
 * - **EAS pagination** is `LIMIT/OFFSET` style after a single full fetch —
 *   the EAS GraphQL surface used here does not offer native cursors; treat
 *   this as a v1 implementation that will need a backend aggregator once
 *   submission volume crosses ~1k attestations.
 */

import { useQuery } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { queryKeys } from "../../config/query-keys";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { getWorks } from "../../modules/data/eas";
import { getGardens } from "../../modules/data/greengoods";
import type { Address } from "../../types/domain";
import type { EASWork } from "../../types/eas-responses";
import type { PublicFieldNote } from "./usePublicGardenDetail";
import { SEASON_ONE_VOLUME_ID, SEASON_ONE_WINDOW } from "./usePublicVolume";

export interface UsePublicFieldNotesOptions {
  gardenAddress?: string;
  /** Volume identifier — only Season One (`1`) is recognized in v1. */
  volume?: number;
  /** Page size — default 20. */
  limit?: number;
  /** Offset cursor (number of items to skip from the start of the sorted list). */
  cursor?: number;
  chainId?: number;
}

export interface PublicFieldNotesPage {
  fieldNotes: PublicFieldNote[];
  hasMore: boolean;
  /** Offset to pass back as `cursor` for the next page; undefined when finished. */
  nextCursor?: number;
  /** Total field notes available given the current filter set. */
  total: number;
}

const DEFAULT_LIMIT = 20;

function adapt(work: EASWork): PublicFieldNote {
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

export function usePublicFieldNotes(opts: UsePublicFieldNotesOptions = {}) {
  const chainId = opts.chainId ?? DEFAULT_CHAIN_ID;
  const limit = Math.max(1, opts.limit ?? DEFAULT_LIMIT);
  const cursor = Math.max(0, opts.cursor ?? 0);
  const gardenAddress = opts.gardenAddress;
  const volume = opts.volume;

  return useQuery({
    queryKey: queryKeys.public.fieldNotes(chainId, {
      gardenAddress: gardenAddress?.toLowerCase(),
      volume,
      limit,
      cursor,
    }),
    queryFn: async (): Promise<PublicFieldNotesPage> => {
      // Resolve the recipient set the EAS query should target.
      let recipient: string | string[] | undefined;
      if (gardenAddress) {
        recipient = gardenAddress;
      } else {
        const gardens = await getGardens();
        const ids = gardens
          .filter((g) => (g.name ?? "").trim().length > 0 || (g.location ?? "").trim().length > 0)
          .map((g) => g.id as Address);
        if (ids.length === 0) {
          return { fieldNotes: [], hasMore: false, total: 0 };
        }
        recipient = ids;
      }

      const works = await getWorks(recipient, chainId);

      // Volume window (v1: Season One only). When `volume` is unset we leave
      // every work in scope so the journal feed shows the full public archive.
      let scoped = works;
      if (volume === SEASON_ONE_VOLUME_ID) {
        scoped = works.filter((work) => {
          if (work.createdAt < SEASON_ONE_WINDOW.startSeconds) return false;
          if (
            SEASON_ONE_WINDOW.endSeconds !== null &&
            work.createdAt > SEASON_ONE_WINDOW.endSeconds
          ) {
            return false;
          }
          return true;
        });
      }

      const sorted = [...scoped].sort((a, b) => b.createdAt - a.createdAt);
      const sliced = sorted.slice(cursor, cursor + limit);
      const total = sorted.length;
      const hasMore = cursor + limit < total;
      const nextCursor = hasMore ? cursor + limit : undefined;

      return {
        fieldNotes: sliced.map(adapt),
        hasMore,
        nextCursor,
        total,
      };
    },
    staleTime: STALE_TIME_RARE,
    placeholderData: (previousData) => previousData ?? undefined,
  });
}
