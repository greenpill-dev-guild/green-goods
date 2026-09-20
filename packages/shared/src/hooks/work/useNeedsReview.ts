/**
 * useNeedsReview Hook
 *
 * Works awaiting review in the given gardens. Each garden is read through the
 * same paged query, and resolved the same way, as the garden Work tab, so a
 * review shows one state on every screen: a decision made on this device
 * (confirmed on chain, sent with a passkey, or queued offline) counts as
 * reviewed at once instead of waiting for the indexer.
 *
 * @module hooks/work/useNeedsReview
 */

import {
  type QueryObserverResult,
  useQueries,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { worksKeys } from "../../config/query-keys/work";
import { type OverlayWork, resolveGardenWorkRows } from "../../modules/work/local-status-overlay";
import { WORK_LIST_PAGE_SIZE } from "../../modules/work/work-list";
import type { Address, Work } from "../../types/domain";
import type { EASWorkListRow } from "../../types/eas-responses";
import { isUserAddress } from "../../utils/blockchain/address";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { gardenWorkListQuery } from "./gardenWorkListQuery";

export interface NeedsReviewState {
  /** Loaded work rows, including reviewed history, for opening their detail route. */
  allWorks: Work[];
  /**
   * Pending works someone else submitted in these gardens, newest first. Each
   * garden contributes its loaded page, the same window its Work tab shows.
   */
  works: Work[];
  /** Works decided on this device that the indexer has not reported yet, newest first. */
  decidedHere: Work[];
  /**
   * Every garden read succeeded, covers the garden's whole history, and every
   * work's status is known, so a count, including zero, is a claim the data
   * backs. A garden with more work than its loaded page is never ready: older
   * pending work may sit beyond the page.
   */
  ready: boolean;
  isLoading: boolean;
  isFetching: boolean;
  /** A garden read failed with nothing saved to show. */
  isError: boolean;
  /** When the oldest of the garden reads last succeeded. */
  savedAt: number | undefined;
  /** Re-read every garden. Resolves false when any read failed. */
  refetch: () => Promise<boolean>;
}

type GardenRead = UseQueryResult<EASWorkListRow[]>;

function combineReads(results: GardenRead[]) {
  return {
    data: results.map((result) => result.data),
    allSucceeded: results.every((result) => result.status === "success"),
    isLoading: results.some((result) => result.isLoading),
    isFetching: results.some((result) => result.isFetching),
    isError: results.some((result) => result.isError && result.data === undefined),
    savedAt: results.reduce<number | undefined>(
      (oldest, result) =>
        result.dataUpdatedAt > 0 && (oldest === undefined || result.dataUpdatedAt < oldest)
          ? result.dataUpdatedAt
          : oldest,
      undefined
    ),
    refetchers: results.map((result) => result.refetch),
  };
}

function combineData(results: UseQueryResult<OverlayWork[]>[]) {
  return results.map((result) => result.data);
}

function newestFirst(a: Work, b: Work) {
  return b.createdAt - a.createdAt;
}

export function useNeedsReview(
  gardenIds: string[],
  address: Address | undefined
): NeedsReviewState {
  const queryClient = useQueryClient();
  const primaryAddress = usePrimaryAddress();
  const chainId = DEFAULT_CHAIN_ID;
  const gardenKey = [...new Set(gardenIds.map((id) => id.toLowerCase()))].sort().join(",");
  const gardens = useMemo(() => (gardenKey ? gardenKey.split(",") : []), [gardenKey]);

  const reads = useQueries({
    queries: gardens.map((garden) => ({
      ...gardenWorkListQuery(queryClient, garden, chainId),
      enabled: Boolean(address),
    })),
    combine: combineReads,
  });
  // Decisions the approval hooks wrote, and the rows the garden screen last
  // resolved for this account. Observed, never fetched.
  const decisions = useQueries({
    queries: gardens.map((garden) => ({
      queryKey: worksKeys.merged(garden, chainId),
      queryFn: () =>
        queryClient.getQueryData<OverlayWork[]>(worksKeys.merged(garden, chainId)) ?? [],
      enabled: false,
    })),
    combine: combineData,
  });
  const saved = useQueries({
    queries: gardens.map((garden) => ({
      queryKey: worksKeys.local(garden, chainId, primaryAddress ?? undefined),
      queryFn: () =>
        queryClient.getQueryData<OverlayWork[]>(
          worksKeys.local(garden, chainId, primaryAddress ?? undefined)
        ) ?? [],
      enabled: false,
    })),
    combine: combineData,
  });

  const resolved = useMemo(() => {
    const now = Date.now();
    const works: Work[] = [];
    const decidedHere: Work[] = [];
    const allWorks: Work[] = [];
    let unknown = 0;
    let incomplete = false;
    gardens.forEach((garden, index) => {
      const window =
        queryClient.getQueryData<number>(worksKeys.window(garden, chainId)) ?? WORK_LIST_PAGE_SIZE;
      // The read carries one row past the window when older work exists.
      if ((reads.data[index]?.length ?? 0) > window) incomplete = true;
      const { rows, unknownIds } = resolveGardenWorkRows({
        remote: reads.data[index]?.slice(0, window),
        saved: saved[index] ?? decisions[index],
        overlay: decisions[index],
        now,
      });
      unknown += unknownIds.size;
      for (const row of rows) {
        allWorks.push(row);
        // A work whose status is unknown stays out rather than asking for a second review.
        if (unknownIds.has(row.id)) continue;
        if (row.status === "pending") {
          if (!isUserAddress(row.gardenerAddress, address)) works.push(row);
        } else if (
          (row.status === "approved" || row.status === "rejected") &&
          (row._txHash !== undefined || row._isPending === true)
        ) {
          decidedHere.push(row);
        }
      }
    });
    return {
      works: works.sort(newestFirst),
      decidedHere: decidedHere.sort(newestFirst),
      allWorks: allWorks.sort(newestFirst),
      unknown,
      incomplete,
    };
  }, [gardens, reads.data, saved, decisions, address, chainId, queryClient]);

  const { refetchers } = reads;
  const refetch = useCallback(async () => {
    const results: QueryObserverResult<EASWorkListRow[]>[] = await Promise.all(
      refetchers.map((refetchGarden) => refetchGarden())
    );
    return results.every((result) => result.status !== "error");
  }, [refetchers]);

  return {
    allWorks: resolved.allWorks,
    works: resolved.works,
    decidedHere: resolved.decidedHere,
    ready:
      gardens.length === 0 ||
      (reads.allSucceeded && resolved.unknown === 0 && !resolved.incomplete),
    isLoading: reads.isLoading,
    isFetching: reads.isFetching,
    isError: reads.isError,
    savedAt: reads.savedAt,
    refetch,
  };
}
