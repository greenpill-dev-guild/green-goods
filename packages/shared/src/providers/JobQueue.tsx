import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { queueToasts, toastService } from "../components/toast";
import { DEFAULT_CHAIN_ID } from "../config/blockchain";
import { queryClient } from "../config/react-query";
import { useAuth } from "../hooks/auth/useAuth";
import { usePrimaryAddress } from "../hooks/auth/usePrimaryAddress";
import { useTransactionSender } from "../hooks/blockchain/useTransactionSender";
import { queryInvalidation, queryKeys } from "../config/query-keys";
import { jobQueue, jobQueueEventBus } from "../modules/job-queue";
import { logger } from "../modules/app/logger";
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

const EMPTY_QUEUE_STATS: QueueStats = { total: 0, pending: 0, failed: 0, synced: 0 };

const areQueueStatsEqual = (left: QueueStats, right: QueueStats) =>
  left.total === right.total &&
  left.pending === right.pending &&
  left.failed === right.failed &&
  left.synced === right.synced;

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

  const [stats, setStats] = useState<QueueStats>(EMPTY_QUEUE_STATS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastEvent, setLastEvent] = useState<QueueEvent | null>(null);
  // Shared across effect re-runs (deps include sender/authMode/currentUserAddress).
  // Without this, an auth flip mid-flush would tear down the effect and the
  // new effect's attemptFlush would see a fresh `false`, racing the in-flight
  // flush. Module-internal locking still applies, but this layer enforces
  // serialization at the provider boundary too.
  const isFlushInProgressRef = useRef(false);
  const setOfflineBannerVisible = useUIStore((state) => state.setOfflineBannerVisible);

  const setOfflineBannerVisibleIfChanged = useCallback(
    (visible: boolean) => {
      if (useUIStore.getState().isOfflineBannerVisible === visible) {
        return;
      }
      setOfflineBannerVisible(visible);
    },
    [setOfflineBannerVisible]
  );

  // useCallback needed here as refreshStats is used in multiple effects
  const refreshStats = useCallback(
    async (signal?: AbortSignal) => {
      // Only fetch stats if we have a user address to scope by
      if (!currentUserAddress) {
        setStats((previousStats) =>
          areQueueStatsEqual(previousStats, EMPTY_QUEUE_STATS) ? previousStats : EMPTY_QUEUE_STATS
        );
        setOfflineBannerVisibleIfChanged(false);
        return;
      }

      try {
        const newStats = await jobQueue.getStats(currentUserAddress);
        if (signal?.aborted) return;
        setStats((previousStats) =>
          areQueueStatsEqual(previousStats, newStats) ? previousStats : newStats
        );
        setOfflineBannerVisibleIfChanged(newStats.pending > 0 || newStats.failed > 0);
      } catch (error) {
        if (signal?.aborted) return;
        logger.warn("[JobQueueProvider] refreshStats failed", { error });
      }
    },
    [currentUserAddress, setOfflineBannerVisibleIfChanged]
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
      setOfflineBannerVisibleIfChanged(true);
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
        queryClient.setQueriesData<Work[]>({ queryKey: queryKeys.works.all }, (oldWorks) => {
          // Defensive shape check: cached values can be undefined or
          // (rarely) a non-array if a hook stuffed something unexpected
          // into the same query-key namespace. Bail without mutating.
          if (!Array.isArray(oldWorks)) return oldWorks;
          return oldWorks.map((work) =>
            work.id === workUID
              ? { ...work, status: approvalPayload.approved ? "approved" : "rejected" }
              : work
          );
        });
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
        invalidateKeys(
          queryInvalidation.onJobAdded(gardenId, chainId, currentUserAddress ?? undefined)
        );
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
  }, [currentUserAddress, refreshStats, setOfflineBannerVisibleIfChanged]);

  useEffect(() => {
    if (!sender || !currentUserAddress) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    const abortController = new AbortController();

    const attemptFlush = async () => {
      // Prevent concurrent flush operations - this avoids race conditions
      // including across effect re-runs (auth flips) thanks to the ref.
      if (isFlushInProgressRef.current || abortController.signal.aborted) {
        return;
      }

      isFlushInProgressRef.current = true;
      try {
        await jobQueue.flush({ transactionSender: sender, userAddress: currentUserAddress });
        if (!abortController.signal.aborted) {
          await refreshStats(abortController.signal);
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        setIsProcessing(false);
        setLastEvent({
          type: "job_failed",
          jobId: "queue-flush",
          error: errorMessage,
        });
        queueToasts.syncError();
        await refreshStats(abortController.signal);
      } finally {
        isFlushInProgressRef.current = false;
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
