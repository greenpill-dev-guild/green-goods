import { connectivityStore } from "../../stores/connectivity";
import { useEffect, useRef } from "react";
import { useIntl } from "react-intl";
import { createQueueToasts } from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { trackContractError } from "../../modules/app/error-tracking";
import { logger } from "../../modules/app/logger";
import { jobQueueEventBus } from "../../modules/job-queue/event-bus";
import type { JobQueueHandle } from "../../modules/job-queue/ports";
import { isTerminallyFailedJob } from "../../modules/job-queue/queue-policy";
import type { TransactionSender } from "../../modules/transactions/types";
import { retainedWorkBroadcast } from "../../modules/work/work-confirmation";
import type { Address } from "../../types/domain";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import { parseContractError } from "../../utils/errors/contract-errors";
import { syncQueuedWorkBatch } from "./useBatchWorkSync";

const CONFIRMATION_POLL_MS = 30_000;

interface WalletQueueSyncOptions {
  queue: JobQueueHandle;
  sender: TransactionSender | null;
  authMode: "wallet" | "passkey" | "embedded" | null;
  walletConnected: boolean;
  userAddress: Address | null;
  refreshStats: () => Promise<void>;
}

function hasKnownBroadcast(job: Job): boolean {
  return Boolean(
    (job.payload as WorkJobPayload).uploadCheckpoint?.transactionHash ||
      (job.payload as WorkJobPayload).uploadCheckpoint?.broadcast ||
      (job.payload as WorkJobPayload).uploadCheckpoint?.broadcastPending ||
      retainedWorkBroadcast(job.id)
  );
}

/**
 * Keeps queued work moving for wallet users without ever sending it twice.
 *
 * Two passes share one lock so they never race each other for a job claim.
 * The confirmation pass rechecks every job that already carries a broadcast;
 * it runs on mount, every 30 seconds, on queue events and on reconnect. The
 * send pass batches every unsent job into one wallet signature, which is the
 * user's one tap, and runs only when connectivity returns, on mount while
 * online, and on a background sync request. A reconnect that arrives while a
 * pass is running is remembered and served once that pass ends.
 */
export function useWalletQueueSync({
  queue,
  sender,
  authMode,
  walletConnected,
  userAddress,
  refreshStats,
}: WalletQueueSyncOptions) {
  const intl = useIntl();
  const toastsRef = useRef(createQueueToasts(intl.formatMessage));
  toastsRef.current = createQueueToasts(intl.formatMessage);

  useEffect(() => {
    if (!userAddress || typeof window === "undefined") return;
    let stopped = false;
    let running = false;
    let sendRequested = false;

    const confirmKnownBroadcasts = async (jobs: Job[]) => {
      if (!sender) return;
      for (const job of jobs) {
        if (stopped) return;
        if (
          (job.chainId ?? DEFAULT_CHAIN_ID) === DEFAULT_CHAIN_ID &&
          hasKnownBroadcast(job) &&
          !job.meta?.workTransactionReverted
        )
          await queue.processJob(job.id, {
            transactionSender: sender,
            assertOwnership: () => {
              if (stopped) throw new Error("submission-ownership-changed");
            },
          });
      }
    };

    const sendUnsentWork = async (jobs: Job[]) => {
      if (authMode !== "wallet" || !walletConnected) return;
      const unsent = jobs.filter(
        (job) =>
          (job.chainId ?? DEFAULT_CHAIN_ID) === DEFAULT_CHAIN_ID &&
          !hasKnownBroadcast(job) &&
          !job.meta?.workTransactionReverted &&
          !isTerminallyFailedJob(job)
      );
      let sent = 0;
      try {
        if (unsent.length > 0) {
          const result = await syncQueuedWorkBatch(userAddress, DEFAULT_CHAIN_ID, () => {
            if (stopped) throw new Error("submission-ownership-changed");
          });
          sent = result.count;
          if (!stopped && sent > 0) toastsRef.current.syncSuccess(sent);
        }
      } catch (error) {
        if (stopped) return;
        logger.warn("[useWalletQueueSync] Queued work is still waiting on the wallet", { error });
        if (parseContractError(error).name !== "UserRejected") {
          trackContractError(error, {
            source: "useWalletQueueSync",
            userAction: "sending queued work after reconnect",
            metadata: { authMode },
          });
          toastsRef.current.walletSendFailed();
        }
      } finally {
        // A successful batch reports completion itself; an empty or failed
        // attempt still ends the reconnect sync that useOffline is showing.
        if (!stopped && sent === 0) {
          jobQueueEventBus.emit("queue:sync-completed", {
            result: { processed: 0, failed: unsent.length, skipped: 0 },
          });
        }
      }
    };

    const pass = async (send: boolean) => {
      if (!connectivityStore.getSnapshot()) return;
      const jobs = await queue.getJobs(userAddress, { kind: "work", synced: false });
      if (stopped) return;
      await confirmKnownBroadcasts(jobs);
      if (stopped) return;
      if (send) {
        // The confirmation pass may have completed or retired jobs; read again
        // so a job it just finished cannot enter the batch.
        const fresh = await queue.getJobs(userAddress, { kind: "work", synced: false });
        if (stopped) return;
        await sendUnsentWork(fresh);
      }
      if (!stopped) await refreshStats();
    };

    const run = async (wantsSend: boolean) => {
      if (stopped) return;
      if (running) {
        sendRequested = sendRequested || wantsSend;
        return;
      }
      running = true;
      let send = wantsSend;
      try {
        do {
          sendRequested = false;
          try {
            await pass(send);
          } catch (error) {
            logger.warn("[useWalletQueueSync] Could not check queued work", { error });
          }
          send = sendRequested;
        } while (send && !stopped);
      } finally {
        running = false;
      }
    };
    const check = () => {
      void run(false);
    };
    const reconnect = () => {
      void run(true);
    };

    reconnect();
    const timer = setInterval(check, CONFIRMATION_POLL_MS);
    const unsubscribeConnectivity = connectivityStore.subscribe(() => {
      if (connectivityStore.getSnapshot()) reconnect();
    });
    const unsubscribeEvents = queue.subscribe(check);
    const unsubscribeBackgroundSync = queue.onBackgroundSyncRequested(reconnect);
    return () => {
      stopped = true;
      clearInterval(timer);
      unsubscribeConnectivity();
      unsubscribeEvents();
      unsubscribeBackgroundSync();
    };
  }, [queue, sender, authMode, walletConnected, userAddress, refreshStats]);
}
