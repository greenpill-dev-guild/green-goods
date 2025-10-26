import React, { createContext, useContext, useEffect, useState } from "react";
import { toastService } from "../toast";
import { DEFAULT_CHAIN_ID } from "../config/blockchain";
import { queryKeys } from "../hooks/query-keys";
// import { jobToWork } from "../hooks/useWorks";
import { jobQueue } from "../modules/job-queue";
// import { jobQueueEventBus } from "../modules/job-queue/event-bus";
import { queryClient } from "../config/react-query";
import { useUser } from "../hooks/auth/useUser";
import { useAuth } from "../hooks/auth/useAuth";

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
  const { authMode } = useAuth();
  const [stats, setStats] = useState<QueueStats>({ total: 0, pending: 0, failed: 0, synced: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastEvent, setLastEvent] = useState<QueueEvent | null>(null);

  const refreshStats = React.useCallback(
    async (signal?: AbortSignal) => {
      try {
        const newStats = await jobQueue.getStats();
        if (signal?.aborted) return;
        setStats(newStats);
      } catch {
        if (signal?.aborted) return;
      }
    },
    []
  );

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

    const handleQueueEvent = (event: QueueEvent) => {
      setLastEvent(event);

      switch (event.type) {
        case "job_processing":
          setIsProcessing(true);
          // Toast: show uploading/submitting depending on kind
          if (event.job) {
            const baseId = `job-${event.job.id}-processing`;
            if (event.job.kind === "work") {
              toastService.loading({
                id: baseId,
                title: "Uploading work",
                message: "We're sending your work submission.",
                context: "work upload",
                suppressLogging: true,
              });
            } else if (event.job.kind === "approval") {
              toastService.loading({
                id: baseId,
                title: "Submitting approval",
                message: "We're finalizing your decision.",
                context: "approval submission",
                suppressLogging: true,
              });
            }
          }
          break;
        case "job_completed":
          setIsProcessing(false);
          void refreshStats(abortController.signal);

          // Handle optimistic updates for completed jobs
          if (event.job && event.txHash) {
            if (event.job.kind === "work") {
              // Toast success for work upload
              toastService.success({
                id: `job-${event.job.id}-processing`,
                title: "Work uploaded",
                message: "Submission confirmed.",
                context: "work upload",
                suppressLogging: true,
              });
              const workPayload = event.job.payload as WorkJobPayload;
              const gardenId = workPayload.gardenAddress;
              const chainId = (event.job.chainId as number) || DEFAULT_CHAIN_ID;

              // Invalidate specific garden queries using centralized keys
              invalidateOnJobCompletedWork(gardenId, chainId);
            } else if (event.job.kind === "approval") {
              // Toast success for approval submission
              toastService.success({
                id: `job-${event.job.id}-processing`,
                title: "Approval sent",
                message: "Status updated.",
                context: "approval submission",
                suppressLogging: true,
              });
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
          void refreshStats(abortController.signal);

          // Handle failed jobs
          if (event.job) {
            // Toast error for failure
            const isWork = event.job.kind === "work";
            toastService.error({
              id: `job-${event.job.id}-processing`,
              title: isWork ? "Work upload failed" : "Approval failed",
              message: isWork
                ? "We'll retry the upload shortly."
                : "We'll retry the submission shortly.",
              context: isWork ? "work upload" : "approval submission",
              description: "You can leave this page; the queue will keep trying.",
              error: event.error ?? event.job.lastError,
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
          void refreshStats(abortController.signal);

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
        default:
          break;
      }
    };

    // Initial stats load
    void refreshStats(abortController.signal);

    // Subscribe to events
    const unsubscribe = jobQueue.subscribe(handleQueueEvent);

    return () => {
      abortController.abort(); // Cancel any pending async operations
      unsubscribe();
    };
  }, [smartAccountAddress, refreshStats]);

  useEffect(() => {
    if (!smartAccountClient) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    const abortController = new AbortController();

    const attemptFlush = async () => {
      try {
        await jobQueue.flush({ smartAccountClient });
        await refreshStats(abortController.signal);
      } catch {
        if (abortController.signal.aborted) {
          return;
        }
      }
    };

    // Only auto-flush on mount if online and passkey user
    if (navigator.onLine && authMode === "passkey") {
      void attemptFlush();
    }

    const handleOnline = () => {
      // Only auto-flush for passkey users
      if (authMode === "passkey") {
        void attemptFlush();
      }
    };

    window.addEventListener("online", handleOnline);

    return () => {
      abortController.abort();
      window.removeEventListener("online", handleOnline);
    };
  }, [smartAccountClient, refreshStats, authMode]);

  // Removed queue-level sync toasts; provider now handles processing inline

  const contextValue: JobQueueContextValue = {
    stats,
    isProcessing,
    lastEvent,
    flush: async () => {
      try {
        const result = await jobQueue.flush({ smartAccountClient: smartAccountClient ?? null });
        await refreshStats();

        if (result.processed > 0) {
          toastService.success({
            id: "job-queue-flush",
            title: "Offline jobs synced",
            message: `Processed ${result.processed} item${result.processed === 1 ? "" : "s"}.`,
            context: "job queue",
            suppressLogging: true,
          });
        } else if (result.failed > 0) {
          toastService.error({
            id: "job-queue-flush",
            title: "Some jobs failed to sync",
            message: "We'll retry automatically in the background.",
            context: "job queue",
          });
        } else if (result.skipped > 0) {
          const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
          const reason = !isOnline
            ? "Reconnect to the internet to finish syncing."
            : !smartAccountClient
              ? "Unlock your passkey session to continue syncing."
              : "We'll retry shortly.";
          toastService.info({
            id: "job-queue-flush",
            title: "Still queued",
            message: reason,
            context: "job queue",
            suppressLogging: true,
          });
        } else {
          toastService.info({
            id: "job-queue-flush",
            title: "Queue is clear",
            message: "No pending jobs to sync.",
            context: "job queue",
            suppressLogging: true,
          });
        }
      } catch (error) {
        toastService.error({
          id: "job-queue-flush",
          title: "Queue sync failed",
          message: "Please try again.",
          context: "job queue",
          error,
        });
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
