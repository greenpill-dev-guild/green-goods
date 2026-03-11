import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { queueToasts, toastService } from "../components/toast";
import { DEFAULT_CHAIN_ID } from "../config/blockchain";
import { queryClient } from "../config/react-query";
import { useAuth } from "../hooks/auth/useAuth";
import { usePrimaryAddress } from "../hooks/auth/usePrimaryAddress";
import { useTransactionSender } from "../hooks/blockchain/useTransactionSender";
import { queryInvalidation, queryKeys } from "../hooks/query-keys";
import { jobQueue, jobQueueEventBus } from "../modules/job-queue";
import { useUIStore } from "../stores/useUIStore";
import type {
  ApprovalJobPayload,
  QueueEvent,
  QueueStats,
  WorkJobPayload,
} from "../types/job-queue";
import { trackStorageQuota } from "../utils/storage/quota";

interface JobQueueContextValue {
  stats: QueueStats;
  isProcessing: boolean;
  lastEvent: QueueEvent | null;
  flush: () => Promise<void>;
  hasPendingJobs: () => Promise<boolean>;
  getPendingCount: () => Promise<number>;
}

const JobQueueContext = createContext<JobQueueContextValue | undefined>(undefined);

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

// Work type for cache updates
interface Work {
  id: string;
  status: string;
  [key: string]: unknown;
}

const JobQueueProviderInner: React.FC<JobQueueProviderProps> = ({ children }) => {
  const { authMode } = useAuth();
  const sender = useTransactionSender();

  // Use single source of truth for primary address
  const currentUserAddress = usePrimaryAddress();

  const [stats, setStats] = useState<QueueStats>({ total: 0, pending: 0, failed: 0, synced: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastEvent, setLastEvent] = useState<QueueEvent | null>(null);
  const setOfflineBannerVisible = useUIStore((state) => state.setOfflineBannerVisible);

  // useCallback needed here as refreshStats is used in multiple effects
  const refreshStats = useCallback(
    async (signal?: AbortSignal) => {
      // Only fetch stats if we have a user address to scope by
      if (!currentUserAddress) {
        setStats({ total: 0, pending: 0, failed: 0, synced: 0 });
        setOfflineBannerVisible(false);
        return;
      }

      try {
        const newStats = await jobQueue.getStats(currentUserAddress);
        if (signal?.aborted) return;
        setStats(newStats);
        setOfflineBannerVisible(newStats.pending > 0 || newStats.failed > 0);
      } catch {
        if (signal?.aborted) return;
      }
    },
    [currentUserAddress, setOfflineBannerVisible]
  );

  // Helper to invalidate multiple query keys
  const invalidateKeys = (keys: readonly (readonly unknown[])[]) => {
    keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
  };

  // Track storage quota on app start and when user changes
  useEffect(() => {
    // Only track once when user is authenticated
    if (!currentUserAddress) return;

    // Track storage quota on initial load
    void trackStorageQuota("app_start");

    // Optionally track periodically (every 30 minutes while app is open)
    const intervalId = setInterval(
      () => {
        void trackStorageQuota("periodic_check");
      },
      30 * 60 * 1000 // 30 minutes
    );

    return () => clearInterval(intervalId);
  }, [currentUserAddress]);

  // Subscribe to queue events
  useEffect(() => {
    const abortController = new AbortController();

    // Event handlers using DRY query invalidation helpers
    const handleJobProcessing = () => {
      setIsProcessing(true);
      setOfflineBannerVisible(true);
      // Suppress toasts for background processing/retries to reduce noise
    };

    const handleJobCompleted = (event: QueueEvent) => {
      setIsProcessing(false);
      void refreshStats(abortController.signal);

      if (!event.job || !event.txHash) return;
      const isBatchSync = Boolean(
        event.job.meta &&
          typeof event.job.meta === "object" &&
          "batchSync" in event.job.meta &&
          event.job.meta.batchSync
      );

      if (event.job.kind === "work") {
        if (!isBatchSync) {
          queueToasts.jobCompleted("work");
        }
        const workPayload = event.job.payload as WorkJobPayload;
        const gardenId = workPayload.gardenAddress;
        const chainId = (event.job.chainId as number) || DEFAULT_CHAIN_ID;

        // Use DRY helper instead of inline invalidation
        invalidateKeys(
          queryInvalidation.onJobCompleted(gardenId, chainId, currentUserAddress ?? undefined)
        );
      } else if (event.job.kind === "approval") {
        queueToasts.jobCompleted("approval");
        const approvalPayload = event.job.payload as ApprovalJobPayload;

        // Invalidate work approvals to show the new approval
        if (currentUserAddress) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.workApprovals.byAttester(currentUserAddress, DEFAULT_CHAIN_ID),
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

      if (event.job.kind === "work") {
        queueToasts.jobFailed("work", event.error);
        const workPayload = event.job.payload as WorkJobPayload;
        const gardenId = workPayload.gardenAddress;
        const chainId = (event.job.chainId as number) || DEFAULT_CHAIN_ID;
        queryClient.invalidateQueries({ queryKey: queryKeys.works.offline(gardenId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.works.merged(gardenId, chainId) });
      } else if (event.job.kind === "approval") {
        queueToasts.jobFailed("approval", event.error);
      }
    };

    const handleJobAdded = (event: QueueEvent) => {
      void refreshStats(abortController.signal);

      if (event.job?.kind === "work") {
        const workPayload = event.job.payload as WorkJobPayload;
        const gardenId = workPayload.gardenAddress;
        const chainId = (event.job.chainId as number) || DEFAULT_CHAIN_ID;

        // Use DRY helper instead of inline invalidation
        invalidateKeys(queryInvalidation.onJobAdded(gardenId, chainId));
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
    const unsubscribeSyncCompleted = jobQueueEventBus.on("queue:sync-completed", () => {
      setIsProcessing(false);
      void refreshStats(abortController.signal);
    });

    return () => {
      abortController.abort(); // Cancel any pending async operations
      unsubscribe();
      unsubscribeSyncCompleted();
    };
  }, [currentUserAddress, refreshStats, setOfflineBannerVisible]);

  useEffect(() => {
    if (!sender || !currentUserAddress) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    const abortController = new AbortController();
    // Track if a flush is currently in progress to prevent concurrent operations
    let isFlushInProgress = false;

    const attemptFlush = async () => {
      // Prevent concurrent flush operations - this avoids race conditions
      if (isFlushInProgress || abortController.signal.aborted) {
        return;
      }

      isFlushInProgress = true;
      try {
        await jobQueue.flush({ transactionSender: sender, userAddress: currentUserAddress });
        if (!abortController.signal.aborted) {
          await refreshStats(abortController.signal);
        }
      } catch {
        // Silently handle errors - they're logged in jobQueue.flush
      } finally {
        isFlushInProgress = false;
      }
    };

    // Auto-flush on mount if online and have a transaction sender (passkey or embedded)
    if (navigator.onLine && (authMode === "passkey" || authMode === "embedded")) {
      void attemptFlush();
    }

    const handleOnline = () => {
      // Auto-flush for passkey and embedded users (sponsored tx senders)
      if (authMode === "passkey" || authMode === "embedded") {
        void attemptFlush();
      }
    };

    window.addEventListener("online", handleOnline);
    const unsubscribeBackgroundSync = jobQueueEventBus.on("background:sync-requested", () => {
      if (authMode === "passkey" || authMode === "embedded") {
        void attemptFlush();
      }
    });

    return () => {
      abortController.abort();
      window.removeEventListener("online", handleOnline);
      unsubscribeBackgroundSync();
    };
  }, [sender, authMode, currentUserAddress, refreshStats]);

  // Context value - useMemo kept here as it's passed to Provider (cross-boundary)
  const contextValue: JobQueueContextValue = React.useMemo(
    () => ({
      stats,
      isProcessing,
      lastEvent,
      flush: async () => {
        if (!currentUserAddress) {
          toastService.error({
            id: "job-queue-flush",
            title: "Cannot sync",
            message: "Please sign in to sync your queue.",
            context: "job queue",
          });
          return;
        }

        try {
          const result = await jobQueue.flush({
            transactionSender: sender ?? null,
            userAddress: currentUserAddress,
          });
          await refreshStats();

          if (result.processed > 0) {
            queueToasts.syncSuccess(result.processed);
          } else if (result.failed > 0) {
            queueToasts.syncError();
          } else if (result.skipped > 0) {
            const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
            const reason = !isOnline
              ? "Reconnect to the internet to finish syncing."
              : !sender
                ? "Sign in to continue syncing."
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
      hasPendingJobs: () => {
        if (!currentUserAddress) return Promise.resolve(false);
        return jobQueue.hasPendingJobs(currentUserAddress);
      },
      getPendingCount: () => {
        if (!currentUserAddress) return Promise.resolve(0);
        return jobQueue.getPendingCount(currentUserAddress);
      },
    }),
    [stats, isProcessing, lastEvent, currentUserAddress, sender, refreshStats]
  );

  return <JobQueueContext.Provider value={contextValue}>{children}</JobQueueContext.Provider>;
};

export const JobQueueProvider: React.FC<JobQueueProviderProps> = ({ children }) => {
  return <JobQueueProviderInner>{children}</JobQueueProviderInner>;
};
