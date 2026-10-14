/**
 * usePublicGardens — public read-side garden list for the Living Archive journal.
 *
 * Composes:
 *   - **Envio indexer** (`getGardens`): garden metadata, role addresses, createdAt.
 *     The gardener count comes from the role addresses, not from work.
 *   - **EAS** (`fetchListedApprovedWorks`, shared with the other public
 *     aggregates on a page): aggregates field-note (Work) counts and last
 *     activity timestamps from approved work only. Pending and rejected work
 *     is not public.
 *
 * No auth path — intended for visitors landing on `/sites` or the landing
 * page's "Live Observations" panel.
 *
 * ### Indexer-scope gaps surfaced here
 *
 * - **No `slug`** on `Garden` in the schema — derived client-side from `name`.
 *   Gardens with empty names fall back to the lowercased address as slug.
 * - **No `lastActivity`** field — derived from max `createdAt` across the
 *   garden's approved work; falls back to `Garden.createdAt` when it has none.
 *
 * Discovery requires approved work. An incomplete work read is an error, so
 * cached results survive and an outage never becomes a successful empty list.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import {
  filterGardensWithApprovedWork,
  isGardenPubliclyVisible,
} from "../../config/garden-visibility";
import { publicKeys } from "../../config/query-keys/public";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { getGardens } from "../../modules/data/greengoods";
import { derivePublicGardenSlug } from "../../public-contracts/garden-slug";
import type { Address, Garden } from "../../types/domain";
import { fetchListedApprovedWorks } from "./listedApprovedWorks";

export interface PublicGardenSummary {
  id: string;
  /** Lowercased garden address (Address type). */
  address: Address;
  /** Human-readable name from indexer (may be empty if uninitialized). */
  name: string;
  /** Slug derived from name — see header for limitations. */
  slug: string;
  /** Free-text location set by the steward. */
  location: string;
  bannerImage: string;
  description: string;
  /** Most recent activity in seconds (EAS work timestamp or garden createdAt). */
  lastActivityAt: number;
  /** Count of `Work` attestations bound to this garden. */
  actionCount: number;
  /**
   * People with the gardener or steward role in this garden, each address once
   * (`publicGardenHelpers.gardenerAddresses`). The number does not wait for
   * approved work. Every "N gardeners" label on the website reads this field,
   * and the garden's own page shows the same count as "Hands at work".
   */
  gardenerCount: number;
  /** Steward addresses surfaced to the public detail page. */
  stewards: Address[];
  /** Evaluator addresses surfaced for the "Verified Site" credibility path. */
  evaluators: Address[];
}

/**
 * Slugify a garden name. Mirrors the same algorithm a future seasons primitive
 * would use, so generated links remain stable when slug data lands on-chain.
 */
const deriveSlug = derivePublicGardenSlug;

/**
 * The people a garden counts on the public website: every address holding its
 * gardener or steward role, lower-cased, each once. A steward tends the garden
 * too, and an address that holds both roles is one person, not two. Every
 * public people count is built from this list: the "N gardeners" labels, a
 * garden page's "Hands at work", and the home page's total (`usePublicStats`).
 */
function gardenerAddresses(garden: Pick<Garden, "gardeners" | "stewards">): string[] {
  const roleHolders = [...(garden.gardeners ?? []), ...(garden.stewards ?? [])];
  return [...new Set(roleHolders.map((address) => address.toLowerCase()))];
}

export function usePublicGardens(
  chainId: number = DEFAULT_CHAIN_ID,
  options: { enabled?: boolean } = {}
) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: publicKeys.gardens(chainId),
    enabled: options.enabled ?? true,
    queryFn: async (): Promise<PublicGardenSummary[]> => {
      const gardens = await getGardens();
      // Curated visibility plus the placeholder check, both owned by
      // config/garden-visibility.ts so the archive, the proof counters, and the
      // evidence ledger can never disagree about which gardens are public.
      const initializedGardens = gardens.filter(isGardenPubliclyVisible);

      if (initializedGardens.length === 0) return [];

      const gardenAddresses = initializedGardens.map((g) => g.id);

      // Shared with the other public aggregates on the page.
      const { works: approvedWorks, partial } = await fetchListedApprovedWorks(
        queryClient,
        gardenAddresses,
        chainId
      );
      if (partial) throw new Error("Public garden work could not be fully loaded");
      const listedGardens = filterGardensWithApprovedWork(initializedGardens, approvedWorks);

      const statsByGarden = new Map<string, { actionCount: number; lastActivityAt: number }>();

      for (const work of approvedWorks) {
        const key = work.gardenAddress.toLowerCase();
        const entry = statsByGarden.get(key) ?? { actionCount: 0, lastActivityAt: 0 };
        entry.actionCount += 1;
        if (work.createdAt > entry.lastActivityAt) {
          entry.lastActivityAt = work.createdAt;
        }
        statsByGarden.set(key, entry);
      }

      return listedGardens.map<PublicGardenSummary>((garden) => {
        const stats = statsByGarden.get(garden.id.toLowerCase());
        // Garden.createdAt arrives in ms (greengoods.ts multiplies by 1000),
        // EAS works arrive in seconds. Normalize lastActivityAt to seconds so
        // page consumers can format consistently.
        const fallbackSeconds = Math.floor((garden.createdAt ?? Date.now()) / 1000);
        return {
          id: garden.id,
          address: garden.id as Address,
          name: garden.name,
          slug: deriveSlug(garden.name, garden.id),
          location: garden.location,
          bannerImage: garden.bannerImage,
          description: garden.description,
          lastActivityAt:
            stats?.lastActivityAt && stats.lastActivityAt > 0
              ? stats.lastActivityAt
              : fallbackSeconds,
          actionCount: stats?.actionCount ?? 0,
          gardenerCount: gardenerAddresses(garden).length,
          stewards: garden.stewards ?? [],
          evaluators: garden.evaluators ?? [],
        };
      });
    },
    staleTime: STALE_TIME_RARE,
    refetchOnMount: "always",
    placeholderData: (previousData) => previousData ?? undefined,
  });
}

/**
 * Pure helper exported for unit tests and downstream consumers (e.g.
 * `usePublicGardenDetail`). Not part of the public hook surface but kept here
 * to avoid a separate utility module.
 */
export const publicGardenHelpers = { deriveSlug, gardenerAddresses } as const;
