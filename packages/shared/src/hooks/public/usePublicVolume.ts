/**
 * usePublicVolume — Season-scoped wrapper for the Living Archive's
 * `Vol. <N>` editorial framing.
 *
 * Composes:
 *   - **Envio indexer** (`getGardens`): garden roster used to find which
 *     gardens were active in the volume window.
 *   - **EAS** (`getWorks`, `getGardenAssessments`): activity within the
 *     volume's time window.
 *
 * No auth path. v1 implements **Season One: Onboarding & Cultivation** with
 * a hardcoded start/open-end window keyed off the pilot launch date. When
 * the Seasons-as-primitive contract lands (`docs/concepts/strategy-and-goals`
 * and `project_campaigns_as_seasons`), this hook should switch to deriving
 * the window from the Season entity in the indexer rather than the constants
 * below.
 *
 * ### Indexer-scope gaps surfaced here
 *
 * - **No on-chain Season primitive yet** — the start/end window below is a
 *   hardcode. Pages can still render `Vol. I — Onboarding & Cultivation`
 *   as the volume label.
 * - Gardens active in the window are derived by the presence of any
 *   `Work` attestation in EAS that falls inside the window. There is no
 *   cheap "first-seen" index.
 */

import { useQuery } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { queryKeys } from "../../config/query-keys";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { logger } from "../../modules/app/logger";
import { getGardenAssessments, getWorks } from "../../modules/data/eas";
import { getGardens } from "../../modules/data/greengoods";
import type { Address } from "../../types/domain";

export const SEASON_ONE_VOLUME_ID = 1 as const;

/**
 * Season One window — start = 2025-04-01 UTC (pilot launch); end = `null`
 * meaning "still open". Update once the Seasons primitive ships and the
 * canonical timestamps move on-chain.
 */
export const SEASON_ONE_WINDOW = {
  label: "Season One: Onboarding & Cultivation",
  /** Pilot launch — 2025-04-01T00:00:00Z. */
  startSeconds: 1_743_465_600,
  /** Open-ended; `null` = no upper bound. */
  endSeconds: null as number | null,
} as const;

interface VolumeMetadata {
  id: number;
  label: string;
  startSeconds: number;
  endSeconds: number | null;
}

const VOLUMES: ReadonlyMap<number, VolumeMetadata> = new Map([
  [
    SEASON_ONE_VOLUME_ID,
    {
      id: SEASON_ONE_VOLUME_ID,
      label: SEASON_ONE_WINDOW.label,
      startSeconds: SEASON_ONE_WINDOW.startSeconds,
      endSeconds: SEASON_ONE_WINDOW.endSeconds,
    },
  ],
]);

export interface PublicVolumeActiveGarden {
  id: string;
  address: Address;
  name: string;
  location: string;
  bannerImage: string;
}

export interface PublicVolume {
  id: number;
  label: string;
  startSeconds: number;
  endSeconds: number | null;
  activeGardens: PublicVolumeActiveGarden[];
  /** Distinct gardener addresses with at least one work in the window. */
  contributorCount: number;
  /** Total `Work` attestations within the window. */
  actionCount: number;
  /** Total `GardenAssessment` attestations within the window. */
  attestationCount: number;
}

export function usePublicVolume(volumeId: number, chainId: number = DEFAULT_CHAIN_ID) {
  return useQuery({
    queryKey: queryKeys.public.volume(chainId, volumeId),
    queryFn: async (): Promise<PublicVolume | null> => {
      const meta = VOLUMES.get(volumeId);
      if (!meta) return null;

      const inWindow = (timeSeconds: number): boolean => {
        if (timeSeconds < meta.startSeconds) return false;
        if (meta.endSeconds !== null && timeSeconds > meta.endSeconds) return false;
        return true;
      };

      const gardens = await getGardens();
      const initializedGardens = gardens.filter(
        (g) => (g.name ?? "").trim().length > 0 || (g.location ?? "").trim().length > 0
      );

      if (initializedGardens.length === 0) {
        return {
          id: meta.id,
          label: meta.label,
          startSeconds: meta.startSeconds,
          endSeconds: meta.endSeconds,
          activeGardens: [],
          contributorCount: 0,
          actionCount: 0,
          attestationCount: 0,
        };
      }

      const ids = initializedGardens.map((g) => g.id);

      // Both EAS reads are best-effort — surface zero counts if either fails.
      const [worksResult, assessmentsResult] = await Promise.allSettled([
        getWorks(ids, chainId),
        getGardenAssessments(undefined, chainId),
      ]);

      const works =
        worksResult.status === "fulfilled"
          ? worksResult.value.filter((w) => inWindow(w.createdAt))
          : [];
      const assessments =
        assessmentsResult.status === "fulfilled"
          ? assessmentsResult.value.filter((a) => inWindow(a.createdAt))
          : [];

      if (worksResult.status === "rejected") {
        logger.warn("[usePublicVolume] EAS works fetch failed", { error: worksResult.reason });
      }
      if (assessmentsResult.status === "rejected") {
        logger.warn("[usePublicVolume] EAS assessments fetch failed", {
          error: assessmentsResult.reason,
        });
      }

      const activeGardenIds = new Set(works.map((w) => w.gardenAddress.toLowerCase()));
      const activeGardens = initializedGardens
        .filter((g) => activeGardenIds.has(g.id.toLowerCase()))
        .map<PublicVolumeActiveGarden>((g) => ({
          id: g.id,
          address: g.id as Address,
          name: g.name,
          location: g.location,
          bannerImage: g.bannerImage,
        }));

      const contributorAddresses = new Set(works.map((w) => w.gardenerAddress.toLowerCase()));

      return {
        id: meta.id,
        label: meta.label,
        startSeconds: meta.startSeconds,
        endSeconds: meta.endSeconds,
        activeGardens,
        contributorCount: contributorAddresses.size,
        actionCount: works.length,
        attestationCount: assessments.length,
      };
    },
    staleTime: STALE_TIME_RARE,
    placeholderData: (previousData) => previousData ?? undefined,
  });
}
