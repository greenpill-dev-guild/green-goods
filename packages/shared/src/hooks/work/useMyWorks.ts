/**
 * useMyWorks Hook
 *
 * Fetches works submitted by the current user with optional offline merging and time filtering.
 *
 * @module hooks/work/useMyWorks
 */

import { useMemo, useSyncExternalStore } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { getWorksByGardener } from "../../modules/data/eas";
import { filterByTimeRange, sortByCreatedAt, type TimeFilter } from "../../utils/time";
import { deduplicateById, mergeAndDeduplicateByClientId } from "../../utils/work/deduplication";
import { fetchOfflineWorks } from "../../utils/work/offline";
import { useUser } from "../auth/useUser";
import { worksKeys } from "../../config/query-keys/work";
import { useJobQueueEvents } from "../../modules/job-queue/event-bus";
import { useQueuedWorkPreviews } from "./useQueuedWorkPreviews";
import { useSendingWorkIds } from "./useSendingWorkIds";
import { useOnlineStatus } from "../app/useOnlineStatus";
import type { Work } from "../../types/domain";
import type { EASWorkApproval } from "../../types/eas-responses";

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
        const source = String(event.query.queryKey[2]);
        if (event.query.queryKey[1] === "works" && (source === "online" || source === "approvals"))
          notify();
      }),
    () =>
      cache
        .findAll({ queryKey: worksKeys.all })
        .filter((query) => ["online", "approvals"].includes(String(query.queryKey[2])))
        .map((query) => `${query.queryHash}:${query.state.dataUpdateCount}`)
        .join("|"),
    () => ""
  );
  const downloaded = useMemo(() => {
    if (!gardenReads || !includeOffline || !activeAddress || online.data !== undefined) {
      return { rows: [] as Work[], updatedAt: undefined };
    }
    const approvals = queryClient.getQueryData<EASWorkApproval[]>(
      worksKeys.approvals(undefined, chainId)
    );
    const known = new Map(approvals?.map((approval) => [approval.workUID, approval]));
    const queries = cache
      .findAll({ queryKey: ["greengoods", "works", "online"] })
      .filter((query) => query.queryKey[4] === chainId && query.state.data !== undefined);
    const rows = queries.flatMap((query) =>
      ((query.state.data as Work[] | undefined) ?? [])
        .filter((work) => work.gardenerAddress.toLowerCase() === activeAddress.toLowerCase())
        .map((work) => {
          const approval = known.get(work.id);
          return {
            ...work,
            status: approval
              ? approval.approved
                ? ("approved" as const)
                : ("rejected" as const)
              : ("pending" as const),
          };
        })
    );
    const updated = queries.map((query) => query.state.dataUpdatedAt).filter(Boolean);
    return { rows, updatedAt: updated.length ? Math.min(...updated) : undefined };
  }, [cache, gardenReads, includeOffline, activeAddress, chainId, queryClient, online.data]);
  const remoteRows = online.data ?? downloaded.rows;
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
