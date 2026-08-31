import { useQuery, useQueryClient } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { publicKeys } from "../../config/query-keys/public";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { logger } from "../../modules/app/logger";
import {
  getPublicGardenPool,
  PUBLIC_HISTORY_PAGE_SIZE,
  type PublicCommitmentCycleRecord,
  type PublicCommitmentPoolRecord,
} from "../../modules/commitment-pooling/data-public-pools";
import type { CommitmentUnitSummaryRecord } from "../../modules/commitment-pooling/types";
import type { Address } from "../../types/domain";

export interface PublicGardenPoolUnavailableSources {
  commitmentPool: boolean;
  cycleMetadata: boolean;
}

export interface PublicGardenPoolData {
  pool: PublicCommitmentPoolRecord | null;
  openSeason: PublicCommitmentCycleRecord | null;
  openCampaigns: PublicCommitmentCycleRecord[];
  finishedCycles: PublicCommitmentCycleRecord[];
  poolUnitSummaries: CommitmentUnitSummaryRecord[];
  cycleUnitSummaries: CommitmentUnitSummaryRecord[];
  /** Finished cycles in total, beyond the window `finishedCycles` holds. */
  finishedCycleTotal: number;
  /** A certificate that bundles commitments exists for this Garden. */
  hasCommitmentCertificates: boolean;
  partialData: boolean;
  unavailableSources: PublicGardenPoolUnavailableSources;
}

export interface UsePublicGardenPoolOptions {
  chainId?: number;
  /**
   * Finished cycles to resolve and return, newest first. Raise it to page
   * the history; the previous window stays on screen while the next loads.
   */
  historyLimit?: number;
}

function emptyPublicGardenPool(unavailable: boolean): PublicGardenPoolData {
  return {
    pool: null,
    openSeason: null,
    openCampaigns: [],
    finishedCycles: [],
    poolUnitSummaries: [],
    cycleUnitSummaries: [],
    finishedCycleTotal: 0,
    hasCommitmentCertificates: false,
    partialData: unavailable,
    unavailableSources: { commitmentPool: unavailable, cycleMetadata: false },
  };
}

export function usePublicGardenPool(
  gardenAddress: Address | undefined,
  options: UsePublicGardenPoolOptions = {}
) {
  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const historyLimit = options.historyLimit ?? PUBLIC_HISTORY_PAGE_SIZE;
  const lookup = gardenAddress?.toLowerCase();
  const queryClient = useQueryClient();
  // The history window is part of the key so each page is its own cached
  // read; the garden slug prefix is what lets a bigger window inherit the
  // smaller one's data below without ever inheriting another garden's.
  const gardenSlug = `commitment-pool:${lookup ?? "none"}`;
  const queryKey = publicKeys.gardenDetail(`${gardenSlug}:${historyLimit}`, chainId);

  return useQuery({
    queryKey,
    enabled: lookup !== undefined,
    queryFn: async (): Promise<PublicGardenPoolData> => {
      if (!gardenAddress) return emptyPublicGardenPool(false);
      try {
        const record = await getPublicGardenPool(chainId, gardenAddress, { historyLimit });
        if (!record) return emptyPublicGardenPool(false);
        const cycleMetadataUnavailable = [
          record.openSeason,
          ...record.openCampaigns,
          ...record.finishedCycles,
        ].some((cycle) => cycle?.nameUnavailable === true);
        return {
          ...record,
          partialData: cycleMetadataUnavailable,
          unavailableSources: {
            commitmentPool: false,
            cycleMetadata: cycleMetadataUnavailable,
          },
        };
      } catch (error) {
        logger.warn("[usePublicGardenPool] Envio read failed", {
          error,
          garden: gardenAddress,
        });
        // A first read that fails has nothing truer to show than "unavailable",
        // so it resolves to that shape. A background refresh that fails must
        // not replace a record the page already holds with that shape:
        // rejecting lets Query keep the last successful data and retry on
        // its own schedule, and the page keeps showing real counts.
        const previous = queryClient.getQueryData<PublicGardenPoolData>(queryKey);
        if (previous && !previous.unavailableSources.commitmentPool) throw error;
        return emptyPublicGardenPool(true);
      }
    },
    staleTime: STALE_TIME_RARE,
    // Paging the history re-keys the query. Keep this garden's previous
    // window on screen while the wider one resolves, and never a different
    // garden's: the slug prefix check is what the cross-garden test pins.
    placeholderData: (previousData, previousQuery) => {
      const previousSlug = previousQuery?.queryKey[3];
      return typeof previousSlug === "string" && previousSlug.startsWith(`${gardenSlug}:`)
        ? previousData
        : undefined;
    },
  });
}
