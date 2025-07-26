import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getWorks } from "@/modules/eas";
import { jobQueue, jobQueueDB } from "@/modules/job-queue";
import { mediaResourceManager } from "@/modules/job-queue/media-resource-manager";

import { useCurrentChain } from "@/utils/useChainConfig";

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

// Helper function to load media for offline jobs with proper cleanup
async function loadOfflineJobMedia(jobId: string): Promise<string[]> {
  try {
    const images = await jobQueueDB.getImagesForJob(jobId);
    return images.map((img: { id: string; file: File; url: string }) => img.url); // URLs are managed by MediaResourceManager
  } catch {
    // Failed to load offline job media, return empty array
    return [];
  }
}

// Hook to get merged works (online + offline) with optimized React Query
export function useWorksMerged(gardenId: string) {
  const chainId = useCurrentChain();

  // No need for manual URL cleanup - MediaResourceManager handles it

  // 1. Fetch online works from EAS with optimized caching
  const {
    data: onlineWorks = [],
    error: onlineError,
    isLoading: onlineLoading,
  } = useQuery({
    queryKey: ["works", gardenId, chainId],
    queryFn: () => getWorks(gardenId, chainId),
    enabled: !!gardenId,
    staleTime: 30000, // 30 seconds - reduce unnecessary refetches
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
    retry: 2, // Retry failed requests twice
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
  });

  // 2. Fetch offline work jobs not yet synced - event-driven with minimal polling
  const { data: pendingJobs = [], isLoading: offlineLoading } = useQuery({
    queryKey: ["offlineWorks", gardenId],
    queryFn: async () => {
      const jobs = await jobQueue.getJobs({ kind: "work", synced: false });
      // Filter jobs for this specific garden
      return jobs.filter((job) => (job.payload as WorkJobPayload).gardenAddress === gardenId);
    },
    refetchInterval: (query) => {
      // More conservative polling: slower refresh, rely on events
      const data = query.state.data as Job<WorkJobPayload>[] | undefined;
      return data && data.length > 0 ? 15000 : 60000; // 15s with jobs, 1min without
    },
    staleTime: 10000, // 10 seconds stale time
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
  });

  // 3. Convert pending jobs to Work format and load their media
  const { data: offlineWorks = [] } = useQuery({
    queryKey: ["offlineWorksWithMedia", gardenId, pendingJobs.map((j) => j.id).join(",")],
    queryFn: async () => {
      const worksWithMedia = await Promise.all(
        pendingJobs.map(async (job) => {
          const work = jobToWork(job as Job<WorkJobPayload>);
          const mediaUrls = await loadOfflineJobMedia(job.id);
          work.media = mediaUrls;
          return work;
        })
      );
      return worksWithMedia;
    },
    enabled: pendingJobs.length > 0,
    staleTime: 5000, // 5 seconds for media loading
    gcTime: 30 * 1000, // 30 seconds cache time for media
  });

  // 4. Merge and deduplicate works with stable query
  const mergedWorks = useQuery({
    queryKey: ["mergedWorks", gardenId],
    queryFn: () => {
      // Create a map to deduplicate by work ID
      const workMap = new Map<string, Work>();

      // Add online works first (they take precedence)
      onlineWorks.forEach((work) => {
        workMap.set(work.id, { ...work, status: "pending" as const });
      });

      // Add offline works that don't conflict with online works
      offlineWorks.forEach((work) => {
        // Check if this work might be a duplicate of an online work
        const isDuplicate = onlineWorks.some((onlineWork) => {
          // Simple heuristic: same garden, action, and similar timestamp
          const timeDiff = Math.abs(onlineWork.createdAt - work.createdAt);
          return onlineWork.actionUID === work.actionUID && timeDiff < 5 * 60 * 1000; // Within 5 minutes
        });

        if (!isDuplicate) {
          workMap.set(work.id, work);
        }
      });

      // Return sorted works (newest first)
      return Array.from(workMap.values()).sort((a, b) => b.createdAt - a.createdAt);
    },
    enabled: !onlineLoading && !offlineLoading,
    staleTime: 1000, // 1 second - this data changes frequently
    gcTime: 30 * 1000, // 30 seconds cache time
    // Add dependency to trigger refetch when source data changes
    meta: {
      onlineWorksLength: onlineWorks.length,
      offlineWorksLength: offlineWorks.length,
    },
  });

  return {
    works: mergedWorks.data || [],
    isLoading: onlineLoading || offlineLoading || mergedWorks.isLoading,
    error: onlineError,
    offlineCount: offlineWorks.length,
    onlineCount: onlineWorks.length,
    refetch: () => {
      // Refetch both online and offline data
      return Promise.all([
        mergedWorks.refetch(),
        // Only refetch source data if needed
        onlineLoading ? Promise.resolve() : getWorks(gardenId, chainId),
      ]);
    },
  };
}

// Hook for getting pending work count across all gardens with reduced polling
export function usePendingWorksCount() {
  return useQuery({
    queryKey: ["pendingWorksCount"],
    queryFn: () => jobQueue.getPendingCount(),
    refetchInterval: (query) => {
      // Conservative polling: rely more on events
      const data = query.state.data as number | undefined;
      return data && data > 0 ? 20000 : 60000; // 20s with pending, 1min without
    },
    staleTime: 15000, // 15 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
  });
}

// Hook for getting queue statistics with reduced polling
export function useQueueStatistics() {
  return useQuery({
    queryKey: ["queueStats"],
    queryFn: () => jobQueue.getStats(),
    refetchInterval: (query) => {
      // Conservative polling: rely more on events
      const data = query.state.data as QueueStats | undefined;
      const hasPendingOrFailed = data && (data.pending > 0 || data.failed > 0);
      return hasPendingOrFailed ? 15000 : 60000; // 15s with issues, 1min without
    },
    staleTime: 10000, // 10 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
  });
}
