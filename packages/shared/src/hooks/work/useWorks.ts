import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { getWorkApprovals, getWorks } from "../../modules/data/eas";
import { jobQueue, jobQueueDB } from "../../modules/job-queue";
import { jobQueueEventBus, useJobQueueEvents } from "../../modules/job-queue/event-bus";
import { useMerged } from "../app/useMerged";
import { useUser } from "../auth/useUser";
import { queryKeys } from "../query-keys";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import type { Work, WorkCard } from "../../types/domain";

/** Options for the useWorks hook */
export interface UseWorksOptions {
  /**
   * Enable offline job queue integration.
   * When true, merges online works with pending offline jobs.
   * @default false
   */
  offline?: boolean;
}

// Helper function to convert job payload to Work model
export function jobToWork(job: Job<WorkJobPayload>): Work {
  return {
    id: job.id, // Use job ID as temporary work ID
    title: job.payload.title || `Action ${job.payload.actionUID}`,
    actionUID: job.payload.actionUID,
    gardenerAddress: "pending", // Will be resolved when online
    gardenAddress: job.payload.gardenAddress,
    feedback: job.payload.feedback,
    metadata: JSON.stringify({
      plantCount: job.payload.plantCount,
      plantSelection: job.payload.plantSelection,
    }),
    media: [], // Media will be loaded separately for offline jobs
    createdAt: job.createdAt,
    status: job.synced
      ? "pending" // Synced but awaiting approval
      : job.lastError
        ? "rejected" // Failed to sync
        : "pending", // Waiting to sync
  };
}

/**
 * Helper to compute work status from approvals
 */
async function computeWorksWithStatus(
  works: WorkCard[],
  chainId: number,
  queryClient: ReturnType<typeof useQueryClient>,
  gardenId: string
): Promise<Work[]> {
  // Fetch work approvals to compute proper status (approved/rejected/pending)
  let approvals: Awaited<ReturnType<typeof getWorkApprovals>> = [];
  try {
    approvals = await getWorkApprovals(undefined, chainId);
  } catch (error) {
    console.warn("[useWorks] Failed to fetch approvals, status may be stale:", error);
  }
  const approvalMap = new Map(approvals.map((approval) => [approval.workUID, approval]));

  // Get cached status map to preserve optimistic updates
  const cachedWorks = queryClient.getQueryData<Work[]>(queryKeys.works.merged(gardenId, chainId));
  const cachedStatusMap = new Map((cachedWorks ?? []).map((w) => [w.id, w.status]));

  return works.map((work) => {
    const approval = approvalMap.get(work.id);
    const computedStatus = approval
      ? approval.approved
        ? ("approved" as const)
        : ("rejected" as const)
      : ("pending" as const);

    const status = cachedStatusMap.get(work.id) ?? computedStatus;
    return { ...work, status };
  });
}

/**
 * Hook for fetching works with optional offline support.
 *
 * @param gardenId - The garden address to fetch works for
 * @param options - Configuration options
 * @param options.offline - Enable offline job queue integration (default: false)
 *
 * @example
 * // Admin dashboard (online only)
 * const { works, isLoading } = useWorks(gardenId);
 *
 * @example
 * // Client PWA (with offline support)
 * const { works, isLoading, offlineCount } = useWorks(gardenId, { offline: true });
 */
export function useWorks(gardenId: string, options: UseWorksOptions = {}) {
  const { offline = false } = options;
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const { smartAccountAddress } = useUser();

  // ─────────────────────────────────────────────────────────────────────────
  // Online-only mode: Simple query without offline job queue integration
  // ─────────────────────────────────────────────────────────────────────────
  const onlineOnlyQuery = useQuery({
    queryKey: queryKeys.works.merged(gardenId, chainId),
    queryFn: async () => {
      const onlineWorks = await getWorks(gardenId, chainId);
      return computeWorksWithStatus(onlineWorks, chainId, queryClient, gardenId);
    },
    enabled: !offline && !!gardenId,
    staleTime: STALE_TIMES.works,
    gcTime: GC_TIMES.works,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Offline mode: Merged online + offline with job queue integration
  // ─────────────────────────────────────────────────────────────────────────
  const merged = useMerged<WorkCard[], Job<WorkJobPayload>[], Work[]>({
    onlineKey: queryKeys.works.online(gardenId, chainId),
    offlineKey: queryKeys.works.offline(gardenId),
    mergedKey: queryKeys.works.merged(gardenId, chainId),
    fetchOnline: () => getWorks(gardenId, chainId),
    fetchOffline: async () => {
      if (!smartAccountAddress) return [];
      const jobs = await jobQueue.getJobs(smartAccountAddress, { kind: "work", synced: false });
      return jobs.filter(
        (job) => (job.payload as WorkJobPayload).gardenAddress === gardenId
      ) as Job<WorkJobPayload>[];
    },
    staleTimeOnline: STALE_TIMES.works,
    staleTimeMerged: STALE_TIMES.merged,
    merge: async (onlineWorks, offlineJobs) => {
      const safeOnlineWorks = onlineWorks ?? [];
      const safeOfflineJobs = offlineJobs ?? [];

      // Fetch approvals for status computation
      let approvals: Awaited<ReturnType<typeof getWorkApprovals>> = [];
      try {
        approvals = await getWorkApprovals(undefined, chainId);
      } catch (error) {
        console.warn("[useWorks] Failed to fetch approvals, status may be stale:", error);
      }
      const approvalMap = new Map(approvals.map((approval) => [approval.workUID, approval]));

      // Preserve optimistic updates from cache
      const cachedWorks = queryClient.getQueryData<Work[]>(
        queryKeys.works.merged(gardenId, chainId)
      );
      const cachedStatusMap = new Map((cachedWorks ?? []).map((w) => [w.id, w.status]));

      // Convert offline jobs to Work models
      const offlineWorks = await Promise.all(
        safeOfflineJobs.map(async (job) => {
          const work = jobToWork(job as Job<WorkJobPayload>);
          const images = await jobQueueDB.getImagesForJob(job.id);
          work.media = images.map((img) => img.url);
          if (smartAccountAddress) {
            work.gardenerAddress = smartAccountAddress;
          }
          return work;
        })
      );

      // Build work map with computed status
      const workMap = new Map<string, Work>();
      safeOnlineWorks.forEach((work) => {
        const approval = approvalMap.get(work.id);
        const computedStatus = approval
          ? approval.approved
            ? ("approved" as const)
            : ("rejected" as const)
          : ("pending" as const);
        const status = cachedStatusMap.get(work.id) ?? computedStatus;
        workMap.set(work.id, { ...work, status });
      });

      // Deduplicate offline works against online
      const onlineTimestampsByAction = new Map<number, number[]>();
      safeOnlineWorks.forEach((work) => {
        const timestamps = onlineTimestampsByAction.get(work.actionUID) ?? [];
        timestamps.push(work.createdAt);
        onlineTimestampsByAction.set(work.actionUID, timestamps);
      });

      const DUPLICATE_TIME_WINDOW_MS = 5 * 60 * 1000;

      offlineWorks.forEach((work) => {
        const onlineTimestamps = onlineTimestampsByAction.get(work.actionUID);
        const isDuplicate = onlineTimestamps?.some(
          (timestamp) => Math.abs(timestamp - work.createdAt) < DUPLICATE_TIME_WINDOW_MS
        );
        if (!isDuplicate) {
          workMap.set(work.id, work);
        }
      });

      return Array.from(workMap.values()).sort((a, b) => b.createdAt - a.createdAt);
    },
    events: [
      {
        subscribe: (listener: () => void) =>
          jobQueueEventBus.onMultiple(
            ["job:added", "job:completed", "job:failed"],
            (_type, data) => {
              if ("job" in data && data.job.kind === "work") {
                const jobGardenId = (data.job.payload as WorkJobPayload).gardenAddress;
                if (jobGardenId === gardenId) listener();
              }
            }
          ),
      },
    ],
  });

  // Job queue event subscription for offline mode
  useJobQueueEvents(["job:completed"], (_eventType, data) => {
    if (offline && "job" in data && data.job.kind === "work") {
      const jobGardenId = (data.job.payload as WorkJobPayload).gardenAddress;
      if (jobGardenId === gardenId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.works.online(gardenId, chainId) });
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Return appropriate data based on mode
  // ─────────────────────────────────────────────────────────────────────────
  if (offline) {
    return {
      works: (merged.merged.data ?? []) as Work[],
      isLoading: merged.merged.isLoading,
      isFetching: merged.online.isFetching || merged.merged.isFetching,
      isError: merged.online.isError || merged.merged.isError,
      error: merged.online.error || merged.merged.error,
      offlineCount: (merged.offline.data ?? []).length,
      onlineCount: (merged.online.data ?? []).length,
      refetch: () => {
        merged.online.refetch();
        merged.offline.refetch();
        merged.merged.refetch();
      },
    };
  }

  return {
    works: (onlineOnlyQuery.data ?? []) as Work[],
    isLoading: onlineOnlyQuery.isLoading,
    isFetching: onlineOnlyQuery.isFetching,
    isError: onlineOnlyQuery.isError,
    error: onlineOnlyQuery.error,
    offlineCount: 0,
    onlineCount: (onlineOnlyQuery.data ?? []).length,
    refetch: () => {
      onlineOnlyQuery.refetch();
    },
  };
}

/**
 * Hook for getting pending work count across all gardens with event-driven updates
 * Scoped to current user's smart account address
 */
export function usePendingWorksCount() {
  const queryClient = useQueryClient();
  const { smartAccountAddress } = useUser();

  const query = useQuery({
    queryKey: queryKeys.queue.pendingCount(),
    queryFn: async () => {
      // Only count jobs for the current user
      if (!smartAccountAddress) return 0;
      // Count only unsynced work jobs to align with Uploading tab
      const jobs = await jobQueue.getJobs(smartAccountAddress, { kind: "work", synced: false });
      return jobs.length;
    },
    enabled: !!smartAccountAddress,
    staleTime: STALE_TIMES.queue,
    gcTime: GC_TIMES.queue,
  });

  // Listen to events to update count
  useJobQueueEvents(["job:added", "job:completed", "job:failed"], () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.queue.pendingCount() });
  });

  return query;
}

/**
 * Hook for getting queue statistics with event-driven updates
 * Scoped to current user's smart account address
 */
export function useQueueStatistics() {
  const queryClient = useQueryClient();
  const { smartAccountAddress } = useUser();

  const query = useQuery({
    queryKey: queryKeys.queue.stats(),
    queryFn: async () => {
      // Only get stats for the current user
      if (!smartAccountAddress) {
        return { total: 0, pending: 0, failed: 0, synced: 0 };
      }
      return jobQueue.getStats(smartAccountAddress);
    },
    enabled: !!smartAccountAddress,
    staleTime: STALE_TIMES.queue,
    gcTime: GC_TIMES.queue,
  });

  // Listen to events to update stats
  useJobQueueEvents(["job:added", "job:completed", "job:failed", "queue:sync-completed"], () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
  });

  return query;
}
