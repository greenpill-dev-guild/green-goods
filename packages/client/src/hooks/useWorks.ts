import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorks } from "@/modules/eas";
import { jobQueue, jobQueueDB } from "@/modules/job-queue";
import { jobQueueEventBus, useJobQueueEvents } from "@/modules/job-queue/event-bus";
import { queryInvalidation, queryKeys } from "./query-keys";
import { useCurrentChain } from "./useChainConfig";

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
  const chainId = useCurrentChain();
  const queryClient = useQueryClient();

  // Online works query
  const onlineWorksQuery = useQuery({
    queryKey: queryKeys.works.online(gardenId, chainId),
    queryFn: () => getWorks(gardenId, chainId),
    enabled: !!gardenId,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });

  // Offline works query
  const offlineWorksQuery = useQuery({
    queryKey: queryKeys.works.offline(gardenId),
    queryFn: async () => {
      const jobs = await jobQueue.getJobs({ kind: "work", synced: false });
      return jobs.filter((job) => (job.payload as WorkJobPayload).gardenAddress === gardenId);
    },
    staleTime: 5000, // 5 seconds
    gcTime: 30000, // 30 seconds
  });

  // Merged works query that depends on both above queries
  const mergedWorksQuery = useQuery({
    queryKey: queryKeys.works.merged(gardenId, chainId),
    queryFn: async () => {
      const onlineWorks = onlineWorksQuery.data || [];
      const offlineJobs = offlineWorksQuery.data || [];

      // Convert offline jobs to works and load media
      const offlineWorks = await Promise.all(
        offlineJobs.map(async (job) => {
          const work = jobToWork(job as Job<WorkJobPayload>);
          const images = await jobQueueDB.getImagesForJob(job.id);
          work.media = images.map((img: { id: string; file: File; url: string }) => img.url);
          return work;
        })
      );

      // Merge and deduplicate
      const workMap = new Map<string, Work>();

      // Add online works first (they take precedence)
      onlineWorks.forEach((work) => {
        workMap.set(work.id, { ...work, status: "pending" as const });
      });

      // Add offline works that don't conflict
      offlineWorks.forEach((work) => {
        const isDuplicate = onlineWorks.some((onlineWork) => {
          const timeDiff = Math.abs(onlineWork.createdAt - work.createdAt);
          return onlineWork.actionUID === work.actionUID && timeDiff < 5 * 60 * 1000;
        });

        if (!isDuplicate) {
          workMap.set(work.id, work);
        }
      });

      return Array.from(workMap.values()).sort((a, b) => b.createdAt - a.createdAt);
    },
    enabled: !onlineWorksQuery.isLoading && !offlineWorksQuery.isLoading,
    staleTime: 5000, // 5 seconds
    gcTime: 30000, // 30 seconds
  });

  // Event-driven invalidation
  useJobQueueEvents(["job:added", "job:completed", "job:failed"], (eventType, data) => {
    if ("job" in data && data.job.kind === "work") {
      const jobGardenId = (data.job.payload as WorkJobPayload).gardenAddress;
      if (jobGardenId === gardenId) {
        // Invalidate specific queries for this garden
        queryInvalidation.invalidateWorksForGarden(gardenId, chainId).forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
    }
  });

  return {
    works: mergedWorksQuery.data || [],
    isLoading:
      onlineWorksQuery.isLoading || offlineWorksQuery.isLoading || mergedWorksQuery.isLoading,
    error: onlineWorksQuery.error || offlineWorksQuery.error || mergedWorksQuery.error,
    offlineCount: (offlineWorksQuery.data || []).length,
    onlineCount: (onlineWorksQuery.data || []).length,
    refetch: () => {
      onlineWorksQuery.refetch();
      offlineWorksQuery.refetch();
      mergedWorksQuery.refetch();
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
    queryFn: () => jobQueue.getPendingCount(),
    staleTime: 10000, // 10 seconds
    gcTime: 30000, // 30 seconds
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
    staleTime: 10000, // 10 seconds
    gcTime: 30000, // 30 seconds
  });

  // Listen to events to update stats
  useJobQueueEvents(["job:added", "job:completed", "job:failed", "queue:sync-completed"], () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
  });

  return query;
}
