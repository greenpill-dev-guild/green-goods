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

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { isGardenPubliclyVisible } from "../../config/garden-visibility";
import { publicKeys } from "../../config/query-keys/public";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { logger } from "../../modules/app/logger";
import { getWorks } from "../../modules/data/eas";
import { getGardens } from "../../modules/data/greengoods";
import { derivePublicGardenSlug } from "../../public-contracts/garden-slug";
import type { Address } from "../../types/domain";

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
  /** Distinct gardener addresses across all works for this garden. */
  contributorCount: number;
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

export function usePublicGardens(
  chainId: number = DEFAULT_CHAIN_ID,
  options: { enabled?: boolean } = {}
) {
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
export const publicGardenHelpers = { deriveSlug } as const;
