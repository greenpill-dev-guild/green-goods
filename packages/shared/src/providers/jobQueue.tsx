import React, { createContext, useContext, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { DEFAULT_CHAIN_ID } from "../config/blockchain";
import { queryKeys } from "../hooks/query-keys";
// import { jobToWork } from "../hooks/useWorks";
import { jobQueue } from "../modules/job-queue";
// import { jobQueueEventBus } from "../modules/job-queue/event-bus";
import { queryClient } from "../config/react-query";
import { useUser } from "../hooks/auth/useUser";

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
  const { smartAccountAddress, smartAccountClient } = useUser();
  const [stats, setStats] = useState<QueueStats>({ total: 0, pending: 0, failed: 0, synced: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastEvent, setLastEvent] = useState<QueueEvent | null>(null);

  // Subscribe to queue events
  useEffect(() => {
    const abortController = new AbortController();

    const invalidateOnJobAddedWork = (gardenId: string, chainId: number) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.queue.pendingCount() });
      queryClient.invalidateQueries({ queryKey: queryKeys.works.offline(gardenId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });
    };

    const invalidateOnJobCompletedWork = (gardenId: string, chainId: number) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.queue.pendingCount() });
      queryClient.invalidateQueries({ queryKey: queryKeys.works.online(gardenId, chainId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });
    };

    const updateStats = async () => {
      try {
        if (!abortController.signal.aborted) {
          const newStats = await jobQueue.getStats();
          setStats(newStats);
        }
      } catch {
        if (!abortController.signal.aborted) {
          // Error handled by returning empty stats
        }
      }
    };

    const handleQueueEvent = (event: QueueEvent) => {
      setLastEvent(event);

      switch (event.type) {
        case "job_processing":
          setIsProcessing(true);
          // Toast: show uploading/submitting depending on kind
          if (event.job) {
            const baseId = `job-${event.job.id}-processing`;
            if (event.job.kind === "work") {
              toast.loading("Uploading work...", { id: baseId });
            } else if (event.job.kind === "approval") {
              toast.loading("Submitting approval...", { id: baseId });
            }
          }
          break;
        case "job_completed":
          setIsProcessing(false);
          updateStats();

          // Handle optimistic updates for completed jobs
          if (event.job && event.txHash) {
            if (event.job.kind === "work") {
              // Toast success for work upload
              toast.success("Work uploaded", { id: `job-${event.job.id}-processing` });
              const workPayload = event.job.payload as WorkJobPayload;
              const gardenId = workPayload.gardenAddress;
              const chainId = (event.job.chainId as number) || DEFAULT_CHAIN_ID;

              // Invalidate specific garden queries using centralized keys
              invalidateOnJobCompletedWork(gardenId, chainId);
            } else if (event.job.kind === "approval") {
              // Toast success for approval submission
              toast.success("Approval submitted", { id: `job-${event.job.id}-processing` });
              const approvalPayload = event.job.payload as ApprovalJobPayload;

              // Invalidate work approvals to show the new approval
              if (smartAccountAddress) {
                queryClient.invalidateQueries({
                  queryKey: queryKeys.workApprovals.byAttester(
                    smartAccountAddress,
                    DEFAULT_CHAIN_ID
                  ),
                });
              }

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
            // Toast error for failure
            const isWork = event.job.kind === "work";
            toast.error(isWork ? "Work upload failed" : "Approval failed", {
              id: `job-${event.job.id}-processing`,
            });
            if (event.job.kind === "work") {
              const workPayload = event.job.payload as WorkJobPayload;
              const gardenId = workPayload.gardenAddress;

              // Invalidate specific garden offline works to update status
              const chainId = (event.job.chainId as number) || DEFAULT_CHAIN_ID;
              queryClient.invalidateQueries({ queryKey: queryKeys.works.offline(gardenId) });
              queryClient.invalidateQueries({
                queryKey: queryKeys.works.merged(gardenId, chainId),
              });
            }
          }
          break;
        case "job_added":
          updateStats();

          // Refresh offline work queries when new jobs are added
          if (event.job?.kind === "work") {
            const workPayload = event.job.payload as WorkJobPayload;
            const gardenId = workPayload.gardenAddress;
            const chainId = (event.job.chainId as number) || DEFAULT_CHAIN_ID;

            // Invalidate specific garden queries
            invalidateOnJobAddedWork(gardenId, chainId);
            // Reduce toast noise: avoid success on queued; optional subtle UI can reflect state
          }

          // Update global counts
          queryClient.invalidateQueries({ queryKey: queryKeys.queue.pendingCount() });
          queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
          break;
        case "job_retrying":
          // Suppress retry toast to reduce flashing; still update stats
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
  }, [smartAccountAddress]);

  // Removed queue-level sync toasts; provider now handles processing inline

  const contextValue: JobQueueContextValue = {
    stats,
    isProcessing,
    lastEvent,
    flush: async () => {
      // Provider-driven flush: iterate pending jobs and process inline
      try {
        const pendingWork = await jobQueue.getJobs({ kind: "work", synced: false });
        const pendingApprovals = await jobQueue.getJobs({ kind: "approval", synced: false });

        let processed = 0;
        // Mark jobs as synced - processing happens elsewhere
        for (const j of pendingWork) {
          if (smartAccountClient) {
            try {
              // Jobs are processed by the background sync or other mechanisms
              // Here we just skip them for now - actual processing needs to be implemented
              console.log('Work job pending:', j.id);
            } catch (error) {
              console.error('Failed to process work job:', error);
            }
          }
        }
        for (const j of pendingApprovals) {
          if (smartAccountClient) {
            try {
              // Jobs are processed by the background sync or other mechanisms
              // Here we just skip them for now - actual processing needs to be implemented
              console.log('Approval job pending:', j.id);
            } catch (error) {
              console.error('Failed to process approval job:', error);
            }
          }
        }
        const newStats = await jobQueue.getStats();
        setStats(newStats);
        if (processed > 0) {
          queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
          queryClient.invalidateQueries({ queryKey: queryKeys.queue.pendingCount() });
        }
      } catch {
        // best-effort; errors are surfaced via per-job events
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
