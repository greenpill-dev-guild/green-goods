/**
 * usePublicGardens — public read-side garden list for the Living Archive journal.
 *
 * Composes:
 *   - **Envio indexer** (`getGardens`): garden metadata, role addresses, createdAt.
 *   - **EAS** (`getWorks`): aggregates field-note (Work) counts, contributor
 *     counts, and last activity timestamps.
 *
 * No auth path — intended for visitors landing on `/sites` or the landing
 * page's "Live Observations" panel.
 *
 * ### Indexer-scope gaps surfaced here
 *
 * - **No `slug`** on `Garden` in the schema — derived client-side from `name`.
 *   Gardens with empty names fall back to the lowercased address as slug.
 * - **No `lastActivity`** field — derived from max `createdAt` across the
 *   garden's work attestations; falls back to `Garden.createdAt` when no
 *   works exist.
 * - **No `public-readable` flag on Action submissions** — v1 treats every
 *   on-chain `Work` attestation as public; gating ships when governance lands.
 *
 * Failures in the EAS layer are treated as soft (zero stats) so the indexer
 * data still renders.
 */

import { useQuery } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { queryKeys } from "../../config/query-keys";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { logger } from "../../modules/app/logger";
import { getWorks } from "../../modules/data/eas";
import { getGardens } from "../../modules/data/greengoods";
import { derivePublicGardenSlug } from "../../public-contracts";
import type { Address } from "../../types/domain";

export interface PublicGardenSummary {
  id: string;
  /** Lowercased garden address (Address type). */
  address: Address;
  /** Human-readable name from indexer (may be empty if uninitialized). */
  name: string;
  /** Slug derived from name — see header for limitations. */
  slug: string;
  /** Free-text location set by the operator. */
  location: string;
  bannerImage: string;
  description: string;
  /** Most recent activity in seconds (EAS work timestamp or garden createdAt). */
  lastActivityAt: number;
  /** Count of `Work` attestations bound to this garden. */
  actionCount: number;
  /** Distinct gardener addresses across all works for this garden. */
  contributorCount: number;
  /** Operator addresses surfaced to the public detail page. */
  operators: Address[];
  /** Evaluator addresses surfaced for the "Verified Site" credibility path. */
  evaluators: Address[];
}

/**
 * Slugify a garden name. Mirrors the same algorithm a future seasons primitive
 * would use, so generated links remain stable when slug data lands on-chain.
 */
const deriveSlug = derivePublicGardenSlug;

export function usePublicGardens(chainId: number = DEFAULT_CHAIN_ID) {
  return useQuery({
    queryKey: queryKeys.public.gardens(chainId),
    queryFn: async (): Promise<PublicGardenSummary[]> => {
      const gardens = await getGardens();
      // Filter placeholder gardens. The indexer's `Garden.initialized` flag is
      // not exposed by `getGardens`; we approximate "placeholder" as a garden
      // with no name AND no location. A garden with a name but no location
      // (or vice-versa) is still public — it just hasn't filled all metadata.
      const initializedGardens = gardens.filter((g) => {
        const hasName = (g.name ?? "").trim().length > 0;
        const hasLocation = (g.location ?? "").trim().length > 0;
        return hasName || hasLocation;
      });

      if (initializedGardens.length === 0) return [];

      const gardenAddresses = initializedGardens.map((g) => g.id);

      // EAS lookup is best-effort: if it fails, surface gardens with zero stats.
      let works: Awaited<ReturnType<typeof getWorks>> = [];
      try {
        works = await getWorks(gardenAddresses, chainId);
      } catch (error) {
        logger.warn("[usePublicGardens] EAS works fetch failed; degrading to indexer-only", {
          error,
        });
      }

      const statsByGarden = new Map<
        string,
        { actionCount: number; contributors: Set<string>; lastActivityAt: number }
      >();

      for (const work of works) {
        const key = work.gardenAddress.toLowerCase();
        const entry = statsByGarden.get(key) ?? {
          actionCount: 0,
          contributors: new Set<string>(),
          lastActivityAt: 0,
        };
        entry.actionCount += 1;
        entry.contributors.add(work.gardenerAddress.toLowerCase());
        if (work.createdAt > entry.lastActivityAt) {
          entry.lastActivityAt = work.createdAt;
        }
        statsByGarden.set(key, entry);
      }

      return initializedGardens.map<PublicGardenSummary>((garden) => {
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
          contributorCount: stats?.contributors.size ?? 0,
          operators: garden.operators ?? [],
          evaluators: garden.evaluators ?? [],
        };
      });
    },
    staleTime: STALE_TIME_RARE,
    placeholderData: (previousData) => previousData ?? undefined,
  });
}

/**
 * Pure helper exported for unit tests and downstream consumers (e.g.
 * `usePublicGardenDetail`). Not part of the public hook surface but kept here
 * to avoid a separate utility module.
 */
export const publicGardenHelpers = { deriveSlug } as const;
