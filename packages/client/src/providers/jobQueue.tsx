import React, { createContext, useContext, useEffect, useState } from "react";

import { jobToWork } from "@/hooks/useWorks";
import { jobQueue } from "@/modules/job-queue";
import { queryClient } from "@/modules/react-query";
import { useUser } from "./user";

interface JobQueueContextValue {
  stats: QueueStats;
  isProcessing: boolean;
  lastEvent: QueueEvent | null;
  flush: () => Promise<void>;
  hasPendingJobs: () => Promise<boolean>;
  getPendingCount: () => Promise<number>;
}

const JobQueueContext = createContext<JobQueueContextValue>({
  stats: { total: 0, pending: 0, failed: 0, synced: 0 },
  isProcessing: false,
  lastEvent: null,
  flush: async () => {},
  hasPendingJobs: async () => false,
  getPendingCount: async () => 0,
});

export const useJobQueue = () => {
  const context = useContext(JobQueueContext);
  if (!context) {
    throw new Error("useJobQueue must be used within a JobQueueProvider");
  }
  return context;
};

export const useQueueStats = () => {
  const { stats } = useJobQueue();
  return stats;
};

export const useQueueFlush = () => {
  const { flush } = useJobQueue();
  return flush;
};

interface JobQueueProviderProps {
  children: React.ReactNode;
}

const JobQueueProviderInner: React.FC<JobQueueProviderProps> = ({ children }) => {
  const { smartAccountClient } = useUser();
  const [stats, setStats] = useState<QueueStats>({ total: 0, pending: 0, failed: 0, synced: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastEvent, setLastEvent] = useState<QueueEvent | null>(null);

  // Update smart account client when it changes
  useEffect(() => {
    // Cast or adapt the Privy client to our SmartAccountClient interface
    jobQueue.setSmartAccountClient((smartAccountClient as any) || null);
  }, [smartAccountClient]);

  // Start periodic sync on mount
  useEffect(() => {
    jobQueue.startPeriodicSync();

    return () => {
      jobQueue.stopPeriodicSync();
    };
  }, []);

  // Subscribe to queue events
  useEffect(() => {
    const abortController = new AbortController();

    const updateStats = async () => {
      try {
        if (!abortController.signal.aborted) {
          const newStats = await jobQueue.getStats();
          setStats(newStats);
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error("Failed to get queue stats:", error);
        }
      }
    };

    const handleQueueEvent = (event: QueueEvent) => {
      setLastEvent(event);

      switch (event.type) {
        case "job_processing":
          setIsProcessing(true);
          break;
        case "job_completed":
          setIsProcessing(false);
          updateStats();

          // Handle optimistic updates for completed jobs
          if (event.job && event.txHash) {
            if (event.job.kind === "work") {
              const workPayload = event.job.payload as WorkJobPayload;
              const gardenId = workPayload.gardenAddress;

              // Add optimistic work to cache for specific garden
              queryClient.setQueryData<Work[]>(["works", gardenId], (oldWorks = []) => {
                const optimisticWork: Work = {
                  ...jobToWork(event.job as Job<WorkJobPayload>),
                  id: event.txHash!, // Use transaction hash as the real ID
                  status: "pending", // Work is submitted but awaiting approval
                  gardenerAddress: workPayload.gardenAddress, // Will be resolved from tx
                };

                // Check if this work is already in the list (avoid duplicates)
                const exists = oldWorks.some((w) => w.id === optimisticWork.id);
                if (!exists) {
                  return [optimisticWork, ...oldWorks];
                }
                return oldWorks;
              });

              // Invalidate specific garden queries
              queryClient.invalidateQueries({ queryKey: ["mergedWorks", gardenId] });
              queryClient.invalidateQueries({ queryKey: ["offlineWorks", gardenId] });
              queryClient.invalidateQueries({ queryKey: ["offlineWorksWithMedia", gardenId] });
            } else if (event.job.kind === "approval") {
              const approvalPayload = event.job.payload as ApprovalJobPayload;

              // Invalidate work approvals to show the new approval
              queryClient.invalidateQueries({ queryKey: ["workApprovals"] });

              // Update work status in cache if available
              const workUID = approvalPayload.workUID;
              queryClient.setQueriesData<Work[]>({ queryKey: ["works"] }, (oldWorks = []) => {
                return oldWorks.map((work) => {
                  if (work.id === workUID) {
                    return {
                      ...work,
                      status: approvalPayload.approved ? "approved" : "rejected",
                    };
                  }
                  return work;
                });
              });
            }
          }
          break;
        case "job_failed":
          setIsProcessing(false);
          updateStats();

          // Handle failed jobs
          if (event.job) {
            if (event.job.kind === "work") {
              const workPayload = event.job.payload as WorkJobPayload;
              const gardenId = workPayload.gardenAddress;

              // Remove any optimistic work entries that failed
              queryClient.setQueryData<Work[]>(["works", gardenId], (oldWorks = []) => {
                return oldWorks.filter((work) => work.id !== event.job!.id);
              });

              // Invalidate specific garden offline works to update status
              queryClient.invalidateQueries({ queryKey: ["offlineWorks", gardenId] });
              queryClient.invalidateQueries({ queryKey: ["mergedWorks", gardenId] });
              queryClient.invalidateQueries({ queryKey: ["offlineWorksWithMedia", gardenId] });
            }
          }
          break;
        case "job_added":
          updateStats();

          // Refresh offline work queries when new jobs are added
          if (event.job?.kind === "work") {
            const workPayload = event.job.payload as WorkJobPayload;
            const gardenId = workPayload.gardenAddress;

            // Invalidate specific garden queries
            queryClient.invalidateQueries({ queryKey: ["offlineWorks", gardenId] });
            queryClient.invalidateQueries({ queryKey: ["mergedWorks", gardenId] });
            queryClient.invalidateQueries({ queryKey: ["offlineWorksWithMedia", gardenId] });
          }

          // Update global counts
          queryClient.invalidateQueries({ queryKey: ["pendingWorksCount"] });
          queryClient.invalidateQueries({ queryKey: ["queueStats"] });
          break;
        case "job_retrying":
          // Update stats when retrying
          updateStats();
          break;
      }
    };

    // Initial stats load
    updateStats();

    // Subscribe to events
    const unsubscribe = jobQueue.subscribe(handleQueueEvent);

    return () => {
      abortController.abort(); // Cancel any pending async operations
      unsubscribe();
    };
  }, []);

  const contextValue: JobQueueContextValue = {
    stats,
    isProcessing,
    lastEvent,
    flush: async () => {
      const result = await jobQueue.flush();
      const newStats = await jobQueue.getStats();
      setStats(newStats);

      // Only invalidate if we actually processed something
      if (result.processed > 0) {
        // Invalidate broader queries after successful flush
        queryClient.invalidateQueries({ queryKey: ["works"] });
        queryClient.invalidateQueries({ queryKey: ["workApprovals"] });
        queryClient.invalidateQueries({ queryKey: ["mergedWorks"] });
        queryClient.invalidateQueries({ queryKey: ["offlineWorks"] });
      }
    },
    hasPendingJobs: () => jobQueue.hasPendingJobs(),
    getPendingCount: () => jobQueue.getPendingCount(),
  };

  return <JobQueueContext.Provider value={contextValue}>{children}</JobQueueContext.Provider>;
};

export const JobQueueProvider: React.FC<JobQueueProviderProps> = ({ children }) => {
  return <JobQueueProviderInner>{children}</JobQueueProviderInner>;
};
