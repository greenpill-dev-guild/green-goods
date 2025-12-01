import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { getWorks } from "../../modules/data/eas";
import { jobQueue, jobQueueDB } from "../../modules/job-queue";
import { jobQueueEventBus, useJobQueueEvents } from "../../modules/job-queue/event-bus";
import { useMerged } from "../app/useMerged";
import { useUser } from "../auth/useUser";
import { queryKeys } from "../query-keys";

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
 * Hook for merged works (online + offline) with event-driven updates
 */
export function useWorks(gardenId: string) {
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const { smartAccountAddress } = useUser();

  const merged = useMerged<WorkCard[], Job<WorkJobPayload>[], Work[]>({
    onlineKey: queryKeys.works.online(gardenId, chainId),
    offlineKey: queryKeys.works.offline(gardenId),
    mergedKey: queryKeys.works.merged(gardenId, chainId),
    fetchOnline: () => getWorks(gardenId, chainId),
    fetchOffline: async () => {
      const jobs = await jobQueue.getJobs({ kind: "work", synced: false });
      return jobs.filter(
        (job) => (job.payload as WorkJobPayload).gardenAddress === gardenId
      ) as Job<WorkJobPayload>[];
    },
    // Use centralized stale times
    staleTimeOnline: STALE_TIMES.works,
    staleTimeMerged: STALE_TIMES.merged,
    merge: async (onlineWorks, offlineJobs) => {
      // Handle undefined data gracefully
      const safeOnlineWorks = onlineWorks ?? [];
      const safeOfflineJobs = offlineJobs ?? [];

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

      const workMap = new Map<string, Work>();
      safeOnlineWorks.forEach((work) => {
        workMap.set(work.id, { ...work, status: "pending" as const });
      });
      offlineWorks.forEach((work) => {
        const isDuplicate = safeOnlineWorks.some((onlineWork) => {
          const timeDiff = Math.abs(onlineWork.createdAt - work.createdAt);
          return onlineWork.actionUID === work.actionUID && timeDiff < 5 * 60 * 1000;
        });
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

  // Keep additional invalidations for online queries
  useJobQueueEvents(["job:completed"], (_eventType, data) => {
    if ("job" in data && data.job.kind === "work") {
      const jobGardenId = (data.job.payload as WorkJobPayload).gardenAddress;
      if (jobGardenId === gardenId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.works.online(gardenId, chainId) });
      }
    }
  });

  return {
    works: merged.merged.data || [],
    isLoading: merged.merged.isLoading,
    error: merged.merged.error,
    offlineCount: (merged.offline.data || []).length,
    onlineCount: (merged.online.data || []).length,
    refetch: () => {
      merged.online.refetch();
      merged.offline.refetch();
      merged.merged.refetch();
    },
  };
}

/**
 * Hook for getting pending work count across all gardens with event-driven updates
 */
export function usePendingWorksCount() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.queue.pendingCount(),
    queryFn: async () => {
      // Count only unsynced work jobs to align with Uploading tab
      const jobs = await jobQueue.getJobs({ kind: "work", synced: false });
      return jobs.length;
    },
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
 */
export function useQueueStatistics() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.queue.stats(),
    queryFn: () => jobQueue.getStats(),
    staleTime: STALE_TIMES.queue,
    gcTime: GC_TIMES.queue,
  });

  // Listen to events to update stats
  useJobQueueEvents(["job:added", "job:completed", "job:failed", "queue:sync-completed"], () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
  });

  return query;
}
