import { BundleIncompleteError } from "../transactions/batch-types";
import type { TransactionSender, TransactionSendOptions } from "../transactions/types";
import {
  acquireWorkJobs,
  retainedWorkBroadcast,
  WorkTransactionReverted,
} from "../work/work-confirmation";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import {
  WALLET_RECONNECT_REQUIRED,
  WalletReconnectRequiredError,
} from "../../utils/errors/unsent-failures";
import { JobMaintenance } from "./job-maintenance";
import type {
  JobQueueAnalytics,
  JobQueueClock,
  JobQueueConfig,
  JobQueueConnectivity,
  JobQueueEvents,
  JobExecutorRegistry,
  JobQueueLogger,
  JobQueueStore,
  JobSendPhase,
  ProcessJobContext,
  ProcessJobResult,
} from "./ports";
import {
  createOfflineTxHash,
  hasRecordedSend,
  isWaitingReprobeThrottled,
  sendsOnReopen,
} from "./queue-policy";
import { findTakeUpOf, TAKE_UP_PENDING } from "./take-up-hold";
import { holdWorkClaims } from "./work-claims";

interface ProcessJobDependencies {
  store: JobQueueStore;
  events: JobQueueEvents;
  executors: JobExecutorRegistry;
  analytics: JobQueueAnalytics;
  connectivity: JobQueueConnectivity;
  clock: JobQueueClock;
  config: JobQueueConfig;
  logger: JobQueueLogger;
  maintenance: JobMaintenance;
}

function calculateBackoffDelay(attempts: number): number {
  return Math.min(1000 * 2 ** attempts, 60_000);
}

function isWithinBackoffWindow(job: Job, now: number): boolean {
  if (isWaitingReprobeThrottled(job, now)) return true;
  if (!job.lastAttemptAt || job.attempts === 0) return false;
  return now - job.lastAttemptAt < calculateBackoffDelay(job.attempts);
}

async function completeJob(
  jobId: string,
  job: Job,
  txHash: string | undefined,
  startedAt: number,
  deps: ProcessJobDependencies
): Promise<ProcessJobResult> {
  const completedTxHash =
    txHash ??
    (typeof job.meta?.submittedTxHash === "string"
      ? job.meta.submittedTxHash
      : createOfflineTxHash(jobId));

  const clientWorkId =
    job.kind === "work"
      ? ((job.payload as WorkJobPayload).clientWorkId ?? job.meta?.clientWorkId)
      : undefined;
  if (job.kind === "work" && typeof clientWorkId === "string") {
    await deps.store.storeClientWorkIdMapping(clientWorkId, completedTxHash, jobId);
  }
  await deps.store.markJobSynced(jobId, completedTxHash);

  try {
    await deps.store.deleteJob(jobId);
  } catch (error) {
    deps.logger.warn("[JobQueue] Failed to delete synced job", { jobId, error });
    await deps.maintenance.trackFailedDelete(jobId);
  }

  const completedJob: Job = {
    ...job,
    synced: true,
    meta: { ...(job.meta || {}), txHash: completedTxHash },
  };
  deps.events.emit("job:completed", { jobId, job: completedJob, txHash: completedTxHash });
  deps.analytics.jobProcessed(job.kind, deps.clock.now() - startedAt, job.attempts + 1);
  return { success: true, txHash: completedTxHash };
}

/**
 * The send options with the context's phase reports added, when it asked for
 * them. The executor's own callbacks run first and keep their say: a checkpoint
 * that fails to save still stops the send. The report runs after and can never
 * stop it. Without `onPhase` the options pass through untouched.
 */
function withPhaseReports(
  options: TransactionSendOptions,
  jobId: string,
  context: ProcessJobContext,
  logger: JobQueueLogger
): TransactionSendOptions {
  const onPhase = context.onPhase;
  if (!onPhase) return options;
  const report = (phase: JobSendPhase) => {
    try {
      onPhase(phase);
    } catch (error) {
      logger.warn("[JobQueue] a send phase report threw", {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  return {
    ...options,
    onBeforeBroadcast: async (reference) => {
      await options.onBeforeBroadcast?.(reference);
      report({ stage: "wallet" });
    },
    onBroadcast: async (hash) => {
      await options.onBroadcast?.(hash);
      report({ stage: "confirming", txHash: hash });
    },
  };
}

export function createJobProcessor(deps: ProcessJobDependencies) {
  async function processJob(
    jobId: string,
    context: ProcessJobContext,
    reopened = false
  ): Promise<ProcessJobResult> {
    const job = await deps.store.getJob(jobId);
    if (!job) return { success: true, skipped: true };
    if (job.synced) {
      const txHash = typeof job.meta?.txHash === "string" ? job.meta.txHash : undefined;
      return { success: true, txHash, skipped: true };
    }
    // A try that started says how it ended, and a tap the queue cannot act on says why. A
    // background pass that never starts stays quiet: it comes round again (PRD-1495).
    let started = false;
    const skipped = (error: string, txHash?: string): ProcessJobResult => {
      const explicit = Boolean(context.explicit);
      if (started || explicit) deps.analytics.jobSkipped(job.kind, error, { explicit, started });
      return { success: false, error, skipped: true, ...(txHash ? { txHash } : {}) };
    };
    const sendBlocked = await deps.connectivity.canSend();
    if (sendBlocked) return skipped(sendBlocked);

    // The hold is on sending. A job whose send is already recorded is only
    // confirmed from here, so a background pass must still be able to settle it.
    const alreadySent = hasRecordedSend(job) || Boolean(retainedWorkBroadcast(jobId));
    if (job.meta?.requiresExplicitSend && !context.explicit && !alreadySent) {
      return skipped("send-requires-explicit");
    }
    // A work for a promise this account is still taking up goes after the take-up, and spends
    // nothing while it waits. One whose send is on record is only confirmed from here.
    if (job.kind === "work" && !alreadySent && (await findTakeUpOf(job, deps.store))) {
      return skipped(TAKE_UP_PENDING);
    }

    const now = deps.clock.now();
    if (!context.explicit && isWithinBackoffWindow(job, now)) {
      const remainingBackoff =
        calculateBackoffDelay(job.attempts) - (now - (job.lastAttemptAt || 0));
      return skipped(`backoff_${Math.ceil(remainingBackoff / 1000)}s`);
    }

    const checkpoint =
      job.kind === "work" ? (job.payload as WorkJobPayload).uploadCheckpoint : undefined;
    if (
      job.kind === "work" &&
      (checkpoint?.transactionReverted || job.meta?.workTransactionReverted)
    )
      return skipped("work-transaction-reverted");
    if (
      job.attempts >= deps.config.maxRetries &&
      !retainedWorkBroadcast(jobId) &&
      !(hasRecordedSend(job) && !job.meta?.workTransactionReverted)
    ) {
      const errorMessage = `Max retries (${deps.config.maxRetries}) exceeded`;
      await deps.store.markJobFailed(jobId, errorMessage);
      deps.events.emit("job:failed", { jobId, job, error: errorMessage });
      deps.analytics.jobPermanentlyFailed(job);
      return { success: false, error: errorMessage };
    }

    const sender = context.transactionSender;
    if (!sender) {
      return skipped("transaction_sender_unavailable");
    }

    if (context.explicit && job.meta?.requiresExplicitSend) {
      // The person chose to send it; later automatic retries may follow up.
      const { requiresExplicitSend: _requiresExplicitSend, ...meta } = job.meta;
      job.meta = meta;
    }
    deps.events.emit("job:processing", { jobId, job });
    // Recorded before any prompt: a page suspended while a wallet signs still leaves the try.
    deps.analytics.processingStarted(job.kind, job.attempts + 1, {
      explicit: Boolean(context.explicit),
      confirming: alreadySent,
    });
    started = true;
    const chainId = job.chainId || deps.config.defaultChainId;
    const startedAt = deps.clock.now();

    try {
      await context.assertOwnership?.();
      // A send the person started, of a job with nothing on record, asks them to
      // reconnect a wallet that has not answered (PRD-1499). A recheck asks nobody.
      const unsent = !retainedWorkBroadcast(jobId) && !hasRecordedSend(job);
      if (context.explicit && unsent) sender.assertReadyToSign?.();
      await sender.assertOwnership?.(job.userAddress, chainId);
      const guardedSender = Object.create(sender) as TransactionSender;
      guardedSender.assertOwnership = async (address, chainId) => {
        await context.assertOwnership?.();
        await sender.assertOwnership?.(address, chainId);
      };
      guardedSender.sendContractCall = (call, options = {}) =>
        sender.sendContractCall(call, {
          ...withPhaseReports(options, jobId, context, deps.logger),
          assertOwnership: async () => {
            await context.assertOwnership?.();
            await sender.assertOwnership?.(job.userAddress, chainId);
            await options.assertOwnership?.();
          },
        });
      const execution = await deps.executors.execute(jobId, job, chainId, guardedSender);
      if (execution.status === "waiting") {
        const meta = { ...(job.meta ?? {}), waitingForDependency: true };
        await deps.store.updateJob({
          ...job,
          meta: { ...meta, waitingReason: execution.reason },
          lastAttemptAt: deps.clock.now(),
        });
        deps.events.emit("job:added", {
          jobId,
          job: { ...job, meta: { ...meta, waitingReason: execution.reason } },
        });
        const waiting = skipped(execution.reason);
        // An earlier send never landed and was just cleared; where the tap said
        // Send, it sends now, as a try of its own.
        if (
          execution.reason === "send-intent-expired" &&
          context.explicit &&
          !reopened &&
          sendsOnReopen(job.kind)
        )
          return processJob(jobId, context, true);
        return waiting;
      }
      if (execution.status === "identity-conflict" || execution.status === "unavailable") {
        const prefix = execution.status === "unavailable" ? "unavailable" : "identity_conflict";
        const errorMessage = `${prefix}:${execution.reason}`;
        await deps.store.markJobTerminalFailed(jobId, errorMessage);
        deps.events.emit("job:failed", { jobId, job, error: errorMessage });
        deps.analytics.jobPermanentlyFailed({
          ...job,
          lastError: errorMessage,
          attempts: deps.config.maxRetries,
        });
        return { success: false, error: errorMessage };
      }
      if (execution.status === "submitted") {
        await deps.store.updateJob({
          ...job,
          meta: {
            ...(job.meta ?? {}),
            waitingForDependency: false,
            submittedTxHash: execution.txHash,
          },
          lastAttemptAt: deps.clock.now(),
        });
        return skipped("pending_materialization", execution.txHash);
      }
      return completeJob(jobId, job, execution.txHash, startedAt, deps);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const processingDuration = deps.clock.now() - startedAt;
      if (errorMessage === "submission-ownership-changed") return skipped(errorMessage);
      // The wallet has not answered: a job with nothing on record was not tried, and keeps
      // its attempts. A send on record still waits for its confirmation, below.
      if (
        error instanceof WalletReconnectRequiredError &&
        !retainedWorkBroadcast(jobId) &&
        !hasRecordedSend(job)
      )
        return skipped(WALLET_RECONNECT_REQUIRED);
      // Its partner in a request that goes only whole never came, so this was never tried.
      if (error instanceof BundleIncompleteError) return skipped(errorMessage);
      if (error instanceof WorkTransactionReverted) {
        await deps.store.markJobTerminalFailed(jobId, errorMessage);
        deps.events.emit("job:failed", { jobId, job, error: errorMessage });
        // The stored job's count moved, not this copy's: count the try that reverted.
        deps.analytics.jobPermanentlyFailed({
          ...job,
          lastError: errorMessage,
          attempts: job.attempts + 1,
        });
        return { success: false, error: errorMessage };
      }
      // Read again: the executor updates the checkpoint while it sends.
      if (retainedWorkBroadcast(jobId) || hasRecordedSend(job)) {
        // Failed checkpoint writes cannot turn a confirmation check into a new submission.
        deps.logger.warn("[JobQueue] Work confirmation checkpoint needs persistence", {
          jobId,
          error,
        });
        deps.events.emit("job:added", {
          jobId,
          job: {
            ...job,
            meta: {
              ...job.meta,
              waitingForDependency: true,
              waitingReason: "awaiting-confirmation",
            },
          },
        });
        return skipped("awaiting-confirmation");
      }
      await deps.store.markJobFailed(jobId, errorMessage);
      const updated = (await deps.store.getJob(jobId)) ?? job;
      deps.events.emit("job:failed", { jobId, job: updated, error: errorMessage });
      await deps.analytics.jobProcessingError(
        job,
        processingDuration,
        chainId,
        deps.config.maxRetries,
        error
      );
      return { success: false, error: errorMessage };
    }
  }
  return async (jobId: string, context: ProcessJobContext): Promise<ProcessJobResult> => {
    const claim = await acquireWorkJobs([jobId]);
    if (!claim) {
      // Another holder, such as another tab, is sending it: a tap that sends nothing says why.
      // The record is best effort, so a read that fails never changes what the tap returns.
      if (context.explicit) {
        try {
          const held = await deps.store.getJob(jobId);
          if (held)
            deps.analytics.jobSkipped(held.kind, "already-processing", {
              explicit: true,
              started: false,
            });
        } catch (error) {
          deps.logger.warn("[JobQueue] A tap on a held job could not be recorded", { error });
        }
      }
      return { success: false, skipped: true, error: "already-processing" };
    }
    // Keep the claim alive for the whole send. A wallet or passkey prompt can
    // stay open past the claim's lifetime, and a claim that lapsed there would
    // let another tab discard or resend a job whose transaction may still go out.
    const stopHolding = holdWorkClaims([claim]);
    try {
      return await processJob(jobId, {
        ...context,
        assertOwnership: async () => {
          await claim.assertOwned();
          await context.assertOwnership?.();
        },
      });
    } finally {
      stopHolding();
      await claim.release();
    }
  };
}
