import { useEffect } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { logger } from "../../modules/app/logger";
import type { JobQueueHandle } from "../../modules/job-queue/ports";
import { hasRecordedSend } from "../../modules/job-queue/queue-policy";
import type { TransactionSender } from "../../modules/transactions/types";
import { isUploadJob } from "../../modules/work/upload-state";
import { retainedWorkBroadcast } from "../../modules/work/work-confirmation";
import { connectivityStore } from "../../stores/connectivity";
import type { Address } from "../../types/domain";
import type { Job } from "../../types/job-queue";

const CONFIRMATION_POLL_MS = 30_000;

interface QueueConfirmationSyncOptions {
  queue: JobQueueHandle;
  sender: TransactionSender | null;
  userAddress: Address | null;
  refreshStats: () => Promise<void>;
}

function awaitsConfirmation(job: Job): boolean {
  return (
    isUploadJob(job) &&
    (job.chainId ?? DEFAULT_CHAIN_ID) === DEFAULT_CHAIN_ID &&
    (hasRecordedSend(job) || Boolean(retainedWorkBroadcast(job.id))) &&
    !job.meta?.workTransactionReverted
  );
}

/**
 * Confirms queued work and decisions that were already sent, and never sends.
 *
 * Upload all sends; this pass settles what a send left behind: a receipt that
 * had not arrived, a UserOperation to reconcile, or an answer that was lost.
 * It runs on mount, every 30 seconds, on queue events, when connectivity
 * returns, when an unstable connection recovers, and on a background sync
 * request. A trigger that arrives while a pass runs is left to the next one.
 */
export function useQueueConfirmationSync({
  queue,
  sender,
  userAddress,
  refreshStats,
}: QueueConfirmationSyncOptions) {
  useEffect(() => {
    if (!userAddress || !sender || typeof window === "undefined") return;
    let stopped = false;
    let running = false;

    const pass = async () => {
      if (!connectivityStore.getSnapshot()) return;
      const jobs = await queue.getJobs(userAddress, { synced: false });
      for (const job of jobs) {
        if (stopped) return;
        if (!awaitsConfirmation(job)) continue;
        await queue.processJob(job.id, {
          transactionSender: sender,
          assertOwnership: () => {
            if (stopped) throw new Error("submission-ownership-changed");
          },
        });
      }
      if (!stopped) await refreshStats();
    };

    const check = () => {
      if (stopped || running) return;
      running = true;
      void pass()
        .catch((error: unknown) => {
          logger.warn("[useQueueConfirmationSync] Could not check sent work", { error });
        })
        .finally(() => {
          running = false;
        });
    };

    check();
    const timer = setInterval(check, CONFIRMATION_POLL_MS);
    const unsubscribeConnectivity = connectivityStore.subscribe(() => {
      if (connectivityStore.getSnapshot()) check();
    });
    // Unstable to online does not change onlineManager's value, so only the
    // status channel reports that recovery. Every probe answer arrives there
    // too, so only a recovery starts a pass.
    let lastState = connectivityStore.getStatusSnapshot().state;
    const unsubscribeStatus = connectivityStore.subscribeStatus(() => {
      const { state } = connectivityStore.getStatusSnapshot();
      const recovered = lastState === "degraded" && state === "online";
      lastState = state;
      if (recovered) check();
    });
    const unsubscribeEvents = queue.subscribe(check);
    const unsubscribeBackgroundSync = queue.onBackgroundSyncRequested(check);
    return () => {
      stopped = true;
      clearInterval(timer);
      unsubscribeConnectivity();
      unsubscribeStatus();
      unsubscribeEvents();
      unsubscribeBackgroundSync();
    };
  }, [queue, sender, userAddress, refreshStats]);
}
