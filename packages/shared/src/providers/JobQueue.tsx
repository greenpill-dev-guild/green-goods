import React, { createContext, useContext, useEffect, useState } from "react";
import { queueToasts, toastService } from "../components/toast";
import { DEFAULT_CHAIN_ID } from "../config/blockchain";
import { queryClient } from "../config/react-query";
import { useAuth } from "../hooks/auth/useAuth";
import { useUser } from "../hooks/auth/useUser";
import { queryKeys } from "../hooks/query-keys";
import { jobQueue } from "../modules/job-queue";

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

  const refreshStats = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const newStats = await jobQueue.getStats();
      if (signal?.aborted) return;
      setStats(newStats);
    } catch {
      if (signal?.aborted) return;
    }
  }, []);

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

    // Event handlers organized by event type
    const handleJobProcessing = () => {
      setIsProcessing(true);
      // Suppress toasts for background processing/retries to reduce noise
    };

    const handleJobCompleted = (event: QueueEvent) => {
      setIsProcessing(false);
      void refreshStats(abortController.signal);

      if (!event.job || !event.txHash) return;

      if (event.job.kind === "work") {
        queueToasts.jobCompleted("work");
        const workPayload = event.job.payload as WorkJobPayload;
        const gardenId = workPayload.gardenAddress;
        const chainId = (event.job.chainId as number) || DEFAULT_CHAIN_ID;
        invalidateOnJobCompletedWork(gardenId, chainId);
      } else if (event.job.kind === "approval") {
        queueToasts.jobCompleted("approval");
        const approvalPayload = event.job.payload as ApprovalJobPayload;

        // Invalidate work approvals to show the new approval
        if (smartAccountAddress) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.workApprovals.byAttester(smartAccountAddress, DEFAULT_CHAIN_ID),
          });
        }

        // Update work status in cache if available
        const workUID = approvalPayload.workUID;
        queryClient.setQueriesData<Work[]>({ queryKey: queryKeys.works.all }, (oldWorks = []) =>
          oldWorks.map((work) =>
            work.id === workUID
              ? { ...work, status: approvalPayload.approved ? "approved" : "rejected" }
              : work
          )
        );
      }
    };

    const handleJobFailed = (event: QueueEvent) => {
      setIsProcessing(false);
      void refreshStats(abortController.signal);

      if (!event.job) return;

      // Suppress error toasts for background retries
      // Failures are visible in Work Dashboard/status UI
      if (event.job.kind === "work") {
        const workPayload = event.job.payload as WorkJobPayload;
        const gardenId = workPayload.gardenAddress;
        const chainId = (event.job.chainId as number) || DEFAULT_CHAIN_ID;
        queryClient.invalidateQueries({ queryKey: queryKeys.works.offline(gardenId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });
      }
    };

    const handleJobAdded = (event: QueueEvent) => {
      void refreshStats(abortController.signal);

      if (event.job?.kind === "work") {
        const workPayload = event.job.payload as WorkJobPayload;
        const gardenId = workPayload.gardenAddress;
        const chainId = (event.job.chainId as number) || DEFAULT_CHAIN_ID;
        invalidateOnJobAddedWork(gardenId, chainId);
      }

      // Update global counts
      queryClient.invalidateQueries({ queryKey: queryKeys.queue.pendingCount() });
      queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
    };

    // Handler map for cleaner event routing
    const eventHandlers: Record<string, (event: QueueEvent) => void> = {
      job_processing: handleJobProcessing,
      job_completed: handleJobCompleted,
      job_failed: handleJobFailed,
      job_added: handleJobAdded,
    };

    const handleQueueEvent = (event: QueueEvent) => {
      setLastEvent(event);
      const handler = eventHandlers[event.type];
      if (handler) handler(event);
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
          queueToasts.syncSuccess(result.processed);
        } else if (result.failed > 0) {
          queueToasts.syncError();
        } else if (result.skipped > 0) {
          const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
          const reason = !isOnline
            ? "Reconnect to the internet to finish syncing."
            : !smartAccountClient
              ? "Unlock your passkey session to continue syncing."
              : "We'll retry shortly.";
          queueToasts.stillQueued(reason);
        } else {
          queueToasts.queueClear();
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
