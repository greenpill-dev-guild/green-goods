/**
 * useMyWorks Hook
 *
 * Fetches works submitted by the current user with optional offline merging and time filtering.
 *
 * @module hooks/work/useMyWorks
 */

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { worksKeys } from "../../config/query-keys/work";
import { getWorksByGardener } from "../../modules/data/eas";
import { resolveGardenWorkRows } from "../../modules/work/local-status-overlay";
import { useJobQueueEvents } from "../../modules/job-queue/event-bus";
import type { Work } from "../../types/domain";
import type { EASWorkListRow } from "../../types/eas-responses";
import { filterByTimeRange, sortByCreatedAt, type TimeFilter } from "../../utils/time";
import { deduplicateById, mergeAndDeduplicateByClientId } from "../../utils/work/deduplication";
import { fetchOfflineWorks } from "../../utils/work/offline";
import { useOnlineStatus } from "../app/useOnlineStatus";
import { useUser } from "../auth/useUser";
import { jobQueueDB } from "../../modules/job-queue/db";
import { retireWorkCompletionSnapshots } from "../../modules/job-queue/work-completions";
import { logger } from "../../modules/app/logger";
import { useLiveQuery } from "../utils/useLiveQuery";
import { useQueuedWorkPreviews } from "./useQueuedWorkPreviews";
import { useSendingWorkIds } from "./useSendingWorkIds";

export interface UseMyWorksOptions {
  /**
   * Include offline (queued) works in the result
   * @default false
   */
  includeOffline?: boolean;

  /**
   * Filter works by time range
   */
  timeFilter?: TimeFilter;

  /**
   * Limit number of results
   * @default 50
   */
  limit?: number;

  /**
   * Chain ID to query
   * @default DEFAULT_CHAIN_ID
   */
  chainId?: number;
}

/**
 * Hook for fetching works submitted by the current user
 *
 * Features:
 * - Fetches online works from EAS/indexer
 * - Optionally merges offline works from job queue
 * - Deduplicates by ID and clientWorkId
 * - Optionally filters by time range
 * - Sorts by creation time (newest first)
 *
 * @param options - Configuration options
 * @returns Query result with user's works
 *
 * @example
 * ```tsx
 * // Fetch online works only
 * const { data: works } = useMyWorks();
 *
 * // Include offline works
 * const { data: allWorks } = useMyWorks({ includeOffline: true });
 *
 * // Filter by time
 * const { data: recentWorks } = useMyWorks({ timeFilter: "week" });
 * ```
 */
export function useMyWorks(options: UseMyWorksOptions = {}) {
  const { includeOffline = false, timeFilter, limit = 50, chainId = DEFAULT_CHAIN_ID } = options;
  const { user } = useUser();
  const activeAddress = user?.id;
  const queryClient = useQueryClient();
  const completions = useLiveQuery(
    activeAddress ? `${chainId}:${activeAddress.toLowerCase()}` : null,
    () => jobQueueDB.observeWorkCompletions(activeAddress!, chainId)
  );
  const queryKey = worksKeys.mine(activeAddress, chainId, false, timeFilter, limit);

  const isOnline = useOnlineStatus();
  const sendingJobs = useSendingWorkIds(activeAddress, chainId);
  const online = useQuery({
    queryKey,
    queryFn: async () => {
      if (!activeAddress) return [];
      const rows = await getWorksByGardener(activeAddress, chainId);
      return deduplicateById(rows).map((work) => ({ ...work, status: "pending" as const }));
    },
    enabled: !!activeAddress,
    networkMode: "online",
    staleTime: includeOffline ? 10_000 : 30_000,
  });
  const localKey = worksKeys.offline("mine", chainId, activeAddress);
  useEffect(() => {
    if (!activeAddress || !online.data?.length) return;
    void retireWorkCompletionSnapshots(
      jobQueueDB,
      activeAddress,
      chainId,
      online.data.map((work) => work.id)
    ).catch((error) => logger.error("Could not retire indexed work snapshots", { error }));
  }, [activeAddress, chainId, online.data]);
  const local = useQuery({
    queryKey: localKey,
    queryFn: () =>
      activeAddress
        ? fetchOfflineWorks(activeAddress, undefined, chainId, { includeMedia: false })
        : Promise.resolve([]),
    enabled: includeOffline && !!activeAddress,
    networkMode: "always",
    staleTime: 10_000,
  });
  useJobQueueEvents(
    ["job:added", "job:completed", "job:failed", "queue:sync-completed"],
    (event) => {
      if (!includeOffline) return;
      void queryClient.invalidateQueries({ queryKey: localKey });
      if (event === "job:completed") void queryClient.invalidateQueries({ queryKey });
    }
  );
  const queuedPreviews = useQueuedWorkPreviews(includeOffline ? (local.data ?? []) : []);
  // Own work opens offline from any garden list already downloaded, whether a
  // garden screen or background preparation fetched it; the personal dashboard
  // does not need to have been opened first.
  const cache = queryClient.getQueryCache();
  const gardenReads = useSyncExternalStore(
    (notify) =>
      cache.subscribe((event) => {
        if (
          event.query.queryKey[1] === "works" &&
          ["online", "merged"].includes(String(event.query.queryKey[2]))
        )
          notify();
      }),
    () =>
      cache
        .findAll({ queryKey: worksKeys.all })
        .filter((query) => ["online", "merged"].includes(String(query.queryKey[2])))
        .map((query) => `${query.queryHash}:${query.state.dataUpdateCount}`)
        .join("|"),
    () => ""
  );
  const downloaded = useMemo(() => {
    if (!gardenReads || !activeAddress) {
      return { rows: [] as Work[], updatedAt: undefined };
    }
    const queries = cache
      .findAll({ queryKey: worksKeys.all })
      .filter(
        (query) =>
          ["online", "merged"].includes(String(query.queryKey[2])) &&
          query.queryKey[4] === chainId &&
          query.state.data !== undefined
      );
    const gardens = new Set(queries.map((query) => String(query.queryKey[3] ?? "")));
    const rows = [...gardens].flatMap((gardenId) => {
      const saved = queryClient.getQueryData<Work[]>(worksKeys.merged(gardenId, chainId));
      return resolveGardenWorkRows({
        remote: queryClient.getQueryData<EASWorkListRow[]>(worksKeys.online(gardenId, chainId)),
        saved,
        overlay: saved,
      }).rows.filter((work) => work.gardenerAddress.toLowerCase() === activeAddress.toLowerCase());
    });
    const updated = queries.map((query) => query.state.dataUpdatedAt).filter(Boolean);
    return { rows, updatedAt: updated.length ? Math.min(...updated) : undefined };
  }, [cache, gardenReads, activeAddress, chainId, queryClient]);
  const remoteRows = useMemo(() => {
    // `gardenReads` is the cache revision that makes legacy merged-status
    // lookups reactive even though they are synchronous QueryClient reads.
    void gardenReads;
    // The garden cache holds receipt-confirmed work before the personal indexer
    // read catches up. Prefer that read once it returns the same attestation.
    const confirmed = (completions.data ?? []).flatMap((row) =>
      row.chainId === chainId && row.userAddress === activeAddress?.toLowerCase() && row.work
        ? [row.work]
        : []
    );
    return deduplicateById([...(online.data ?? []), ...downloaded.rows, ...confirmed]).map(
      (work) => {
        if (work.status === "approved" || work.status === "rejected") return work;
        const legacy = (
          queryClient.getQueryData<Work[]>(worksKeys.merged(work.gardenAddress, chainId)) ?? []
        ).find((candidate) => candidate.id === work.id);
        return legacy?.status === "approved" || legacy?.status === "rejected"
          ? { ...work, status: legacy.status }
          : work;
      }
    );
  }, [
    activeAddress,
    chainId,
    completions.data,
    downloaded.rows,
    gardenReads,
    online.data,
    queryClient,
  ]);
  const metadataByWork = useQueries({
    queries: remoteRows.map((work) => ({
      queryKey: worksKeys.metadata(work.metadata.trim()),
      enabled: false,
    })),
    combine: (results) => results.map((result) => result.data),
  });
  const works = useMemo(() => {
    const metadataByKey = new Map(
      remoteRows.map((work, index) => [work.metadata.trim(), metadataByWork[index]])
    );
    const remote = deduplicateById(remoteRows as Work[])
      .filter(
        (work) =>
          !["syncing", "sync_failed", "offline", "uploading"].includes(work.status) &&
          !work.id.startsWith("0xoffline_")
      )
      .map((work) => {
        const metadata = metadataByKey.get(work.metadata.trim());
        return metadata ? { ...work, metadata: JSON.stringify(metadata) } : work;
      });
    const localRows = (local.data ?? []).map((record) => {
      const work = queuedPreviews.has(record.id)
        ? { ...record, media: queuedPreviews.get(record.id)! }
        : record;
      return isOnline && sendingJobs.has(work.id) && work.status === "offline"
        ? {
            ...work,
            status: "uploading" as const,
            metadata: JSON.stringify({ ...JSON.parse(work.metadata), submissionState: "sending" }),
          }
        : work;
    });
    let rows: Work[] = includeOffline ? mergeAndDeduplicateByClientId(remote, localRows) : remote;
    if (timeFilter) rows = filterByTimeRange(rows, timeFilter);
    return sortByCreatedAt(rows).slice(0, limit);
  }, [
    remoteRows,
    queuedPreviews,
    local.data,
    includeOffline,
    timeFilter,
    limit,
    metadataByWork,
    sendingJobs,
    isOnline,
  ]);
  const hasRows = works.length > 0;
  return {
    ...online,
    data: works,
    isSuccess: online.isSuccess || hasRows,
    isError: online.isError && !hasRows,
    isLoading: isOnline && online.isLoading && !hasRows,
    isFetching: isOnline && online.isFetching,
    isPaused: !isOnline || online.isPaused,
    availability:
      online.data !== undefined
        ? hasRows
          ? "available"
          : "empty"
        : hasRows
          ? "partial"
          : "unavailable",
    lastSuccessfulRefresh: online.dataUpdatedAt || downloaded.updatedAt,
    refreshWarning: online.isError && hasRows,
    refetch: async () => {
      if (includeOffline) await local.refetch();
      return isOnline ? online.refetch() : online;
    },
  };
}

/**
 * Hook for fetching only online works (no offline merging)
 *
 * Convenience wrapper around useMyWorks with includeOffline=false.
 */
export function useMyOnlineWorks(options: Omit<UseMyWorksOptions, "includeOffline"> = {}) {
  return useMyWorks({ ...options, includeOffline: false });
}
