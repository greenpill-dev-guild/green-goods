import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { createQueueToasts, toastService } from "../components/toast";
import { DEFAULT_CHAIN_ID } from "../config/default-chain";
import { queryClient } from "../config/react-query";
import { useAuth } from "../hooks/auth/useAuth";
import { usePrimaryAddress } from "../hooks/auth/usePrimaryAddress";
import { useTransactionSender } from "../hooks/blockchain/useTransactionSender";
import { queryInvalidation } from "../config/query-keys/invalidation";
import { queueKeys } from "../config/query-keys/misc";
import { approvalsKeys, workApprovalsKeys, worksKeys } from "../config/query-keys/work";
import { useQueueConfirmationSync } from "../hooks/work/useQueueConfirmationSync";
import { useWorkUploadPreparation } from "../hooks/work/useWorkUploadPreparation";
import { COMMITMENT_JOB_KINDS } from "../modules/commitment-pooling/job-types";
import { jobQueue } from "../modules/job-queue/default-instance";
import type { JobQueueHandle } from "../modules/job-queue/ports";
import { logger } from "../modules/app/logger";
import { scheduleUploadPreparation } from "../modules/work/upload-preparation";
import { connectivityStore } from "../stores/connectivity";
import { useUIStore } from "../stores/useUIStore";
import type {
  ApprovalJobPayload,
  QueueEvent,
  QueueStats,
  WorkJobPayload,
} from "../types/job-queue";
import { requestPersistentStorageOnce, trackStorageQuota } from "../utils/storage/quota";

interface JobQueueContextValue {
  stats: QueueStats;
  isProcessing: boolean;
  lastEvent: QueueEvent | null;
  /** Give one job another run and send only that job, as the person's own tap. */
  retryAndSend: (jobId: string) => Promise<void>;
  hasPendingJobs: () => Promise<boolean>;
  getPendingCount: () => Promise<number>;
}

const JobQueueContext = createContext<JobQueueContextValue | undefined>(undefined);

function signInToSync() {
  toastService.error({
    id: "job-queue-flush",
    title: "Cannot sync",
    message: "Please sign in to sync your queue.",
    context: "job queue",
  });
}

function stillQueuedReason(hasSender: boolean) {
  if (!connectivityStore.getSnapshot()) return "Reconnect to the internet to finish syncing.";
  if (!hasSender) return "Sign in to continue syncing.";
  return "We'll retry shortly.";
}

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

interface JobQueueProviderProps {
  children: React.ReactNode;
  queue?: JobQueueHandle;
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

const JobQueueProviderInner: React.FC<JobQueueProviderProps> = ({ children, queue = jobQueue }) => {
  const { formatMessage } = useIntl();
  // One object per intl instance: the effects below list it as a dependency, so
  // a fresh one on every render would resubscribe the queue on every render.
  const queueToasts = React.useMemo(() => createQueueToasts(formatMessage), [formatMessage]);
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
        const newStats = await queue.getStats(currentUserAddress);
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
    [currentUserAddress, queue, setOfflineBannerVisibleIfChanged]
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
            queryKey: workApprovalsKeys.byAttester(currentUserAddress, DEFAULT_CHAIN_ID),
          });
        }
        queryClient.invalidateQueries({ queryKey: approvalsKeys.all });

        // Update work status in cache if available
        const workUID = approvalPayload.workUID;
        queryClient.setQueriesData<Work[]>({ queryKey: worksKeys.all }, (oldWorks) => {
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
        queryClient.invalidateQueries({ queryKey: worksKeys.offline(gardenId) });
        queryClient.invalidateQueries({ queryKey: worksKeys.merged(gardenId, chainId) });
      } else if (event.job.kind === "approval") {
        queueToasts.jobFailed("approval", event.error);
      }
    };

    const handleJobAdded = (event: QueueEvent) => {
      // A job that went back to waiting, for any reason, is no longer being processed.
      if (event.job?.meta?.waitingReason) setIsProcessing(false);
      void refreshStats(abortController.signal);
      void requestPersistentStorageOnce("offline-job");

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
      queryClient.invalidateQueries({ queryKey: queueKeys.pendingCount() });
      queryClient.invalidateQueries({ queryKey: queueKeys.stats() });
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
    const unsubscribe = queue.subscribe(handleQueueEvent);
    const unsubscribeSyncCompleted = queue.onSyncCompleted(() => {
      setIsProcessing(false);
      void refreshStats(abortController.signal);
    });

    return () => {
      abortController.abort(); // Cancel any pending async operations
      unsubscribe();
      unsubscribeSyncCompleted();
    };
  }, [currentUserAddress, queue, queueToasts, refreshStats, setOfflineBannerVisibleIfChanged]);

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
        await queue.flush({
          transactionSender: sender,
          userAddress: currentUserAddress,
          // A passkey's work and decisions wait for Upload all; its commitment acts
          // still send on their own. An embedded wallet, which has no Upload all
          // batch, keeps sending everything.
          ...(authMode === "passkey" ? { kinds: COMMITMENT_JOB_KINDS } : {}),
        });
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

    // Auto-flush only once the origin has confirmed the connection: "online"
    // is also the boot state and the state while a probe is still pending, and
    // an unstable connection never sends.
    const autoSends = authMode === "passkey" || authMode === "embedded";
    if (autoSends && connectivityStore.isConfirmedOnline()) {
      void attemptFlush();
    }

    const handleConnectivity = () => {
      if (autoSends && connectivityStore.isConfirmedOnline()) {
        void attemptFlush();
      }
    };

    const unsubscribeConnectivity = connectivityStore.subscribeStatus(handleConnectivity);
    const unsubscribeBackgroundSync = queue.onBackgroundSyncRequested(() => {
      scheduleUploadPreparation();
      if (!autoSends) return;
      void connectivityStore.confirmOnline().then((confirmed) => {
        if (confirmed) void attemptFlush();
      });
    });

    return () => {
      abortController.abort();
      unsubscribeConnectivity();
      unsubscribeBackgroundSync();
    };
  }, [sender, authMode, currentUserAddress, queue, queueToasts, refreshStats]);

  // Sent work and decisions are confirmed here; nothing is sent from this pass.
  useQueueConfirmationSync({ queue, sender, userAddress: currentUserAddress, refreshStats });

  // Queued work and decisions are prepared in the background, so Upload all only signs.
  useWorkUploadPreparation(currentUserAddress, DEFAULT_CHAIN_ID);

  // Context value - useMemo kept here as it's passed to Provider (cross-boundary)
  const contextValue: JobQueueContextValue = React.useMemo(
    () => ({
      stats,
      isProcessing,
      lastEvent,
      retryAndSend: async (jobId: string) => {
        if (!currentUserAddress) {
          signInToSync();
          return;
        }
        try {
          await queue.retryJob(jobId);
          // The person asked for this one job, so nothing else in the queue is sent.
          const result = await queue.processJob(jobId, {
            transactionSender: sender ?? null,
            explicit: true,
          });
          await refreshStats();
          if (result.success) {
            if (result.skipped) queueToasts.queueClear();
            else queueToasts.syncSuccess(1);
          } else if (!result.skipped) {
            // Not syncError: one act, and a non-skipped failure is one the
            // queue gave up on rather than rescheduled.
            queueToasts.retryFailed();
          } else {
            queueToasts.stillQueued(stillQueuedReason(Boolean(sender)));
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
        return queue.hasPendingJobs(currentUserAddress);
      },
      getPendingCount: () => {
        if (!currentUserAddress) return Promise.resolve(0);
        return queue.getPendingCount(currentUserAddress);
      },
    }),
    [stats, isProcessing, lastEvent, currentUserAddress, sender, queue, queueToasts, refreshStats]
  );

  return <JobQueueContext.Provider value={contextValue}>{children}</JobQueueContext.Provider>;
};

export const JobQueueProvider: React.FC<JobQueueProviderProps> = ({ children, queue }) => {
  return <JobQueueProviderInner queue={queue ?? jobQueue}>{children}</JobQueueProviderInner>;
};
