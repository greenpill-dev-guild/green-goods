import type { Job, WorkJobPayload } from "../../types/job-queue";
import type { WorkUploadCheckpoint } from "../../types/domain";
import type { TransactionSender } from "../transactions/types";
import { logger } from "../app/logger";
import { jobQueueDB } from "../job-queue/db";
import { holdWorkClaims } from "../job-queue/work-claims";
import { holdingSend } from "../job-queue/send-guards";
import { hasRecordedSend, MAX_RETRIES } from "../job-queue/queue-policy";
import { jobQueueEventBus } from "../job-queue/event-bus";
import { trackJobPermanentlyFailed, trackJobProcessed } from "../job-queue/job-analytics";
import { convertQueuedHeicMedia } from "../job-queue/job-media-conversion";
import { findTakeUpOf } from "../job-queue/take-up-hold";
import { ConnectionNeededError } from "../../utils/errors/unsent-failures";
import { isHeicFile, PendingHeicConversionError } from "./work-attachments";
import {
  type QueuedWorkSubmission,
  type ResolvedSubmitWorkCommand,
  type SubmitWorkOutcome,
  type SubmitWorkPorts,
} from "./submit-work-command";
import {
  isNetworkError,
  acquireWorkJobs,
  rememberWorkBroadcast,
  forgetWorkBroadcast,
  AwaitingWorkConfirmation,
  WorkTransactionReverted,
} from "./work-confirmation";
import { classifySendFailure, WorkSendCancelledError } from "./send-outcome";
import { draftContentOf, holdDraftForSubmit, noteQueuedDraftContent } from "./draft-lifecycle";

export function queuedOutcome(
  queued: QueuedWorkSubmission,
  sender: TransactionSender | null,
  reason?: "connection-unconfirmed"
): SubmitWorkOutcome {
  return {
    kind: "queued",
    txHash: queued.txHash,
    sponsored: sender?.supportsSponsorship ?? false,
    jobId: queued.jobId,
    clientWorkId: queued.clientWorkId,
    ...(reason ? { reason } : {}),
  };
}

/** A send already on record that could not be checked now: it is still awaiting confirmation. */
export function uncheckedOutcome(
  queued: QueuedWorkSubmission,
  sender: TransactionSender | null
): SubmitWorkOutcome {
  return {
    ...queuedOutcome(queued, sender, "connection-unconfirmed"),
    kind: "awaiting-confirmation",
  } as SubmitWorkOutcome;
}

/**
 * Without the offline queue a send that cannot go out now fails, and says nothing was
 * sent, unless a send is already on record: that one only waits for its check.
 */
async function refuseForConnection(
  queued: QueuedWorkSubmission,
  ports: SubmitWorkPorts
): Promise<SubmitWorkOutcome> {
  const job = await jobQueueDB.getJob(queued.jobId);
  if (job && hasRecordedSend(job)) return uncheckedOutcome(queued, ports.sender);
  throw new ConnectionNeededError();
}

function rejectTerminalWork(job: Job | undefined, onTerminalUnsentFailure?: () => void) {
  if (!job) return;
  const checkpoint = (job.payload as WorkJobPayload).uploadCheckpoint;
  if (checkpoint?.transactionReverted || job.meta?.workTransactionReverted)
    throw new WorkTransactionReverted(
      checkpoint?.broadcast?.hash ?? checkpoint?.transactionHash ?? "0x"
    );
  if (
    job.attempts >= MAX_RETRIES &&
    !checkpoint?.broadcast &&
    !checkpoint?.transactionHash &&
    !checkpoint?.broadcastPending
  ) {
    onTerminalUnsentFailure?.();
    throw new Error(job.lastError ?? "submission-requires-retry");
  }
}

/** Another holder has the work, another window's Upload all for one; it stays queued for them. */
function heldElsewhere(queued: QueuedWorkSubmission, ports: SubmitWorkPorts): SubmitWorkOutcome {
  logger.warn("[submitWork] Another holder has this work; it stays queued", {
    jobId: queued.jobId,
  });
  return queuedOutcome(queued, ports.sender);
}

/**
 * Admits the work durably, then sends it while the connection holds. Admission
 * wakes background preparation, which would otherwise claim the work first and
 * leave it for Upload all, so preparation is held back until this Submit has
 * sent the work or left it queued; it then prepares whatever is left. The
 * draft is held the same way: whatever the send does here, it is left to the
 * composer, which retires it once the queue holds the work.
 */
export async function submitAdmittedWork(
  input: ResolvedSubmitWorkCommand,
  ports: SubmitWorkPorts
): Promise<SubmitWorkOutcome> {
  const resumePreparation = await ports.suspendPreparation();
  const releaseDraft = holdDraftForSubmit(input.clientWorkId);
  try {
    return await admitAndSend(input, ports);
  } finally {
    releaseDraft();
    resumePreparation();
  }
}

async function admitAndSend(
  input: ResolvedSubmitWorkCommand,
  ports: SubmitWorkPorts
): Promise<SubmitWorkOutcome> {
  // What the draft held when the queue copied the work is kept on the queued work,
  // so a draft the person changes afterwards is never mistaken for what was sent.
  const drafted = await draftContentOf(input);
  const queued = await ports.queue.admit!(input);
  input.onAdmitted?.();
  if (queued.newlyAdmitted && drafted !== undefined)
    await noteQueuedDraftContent(queued.jobId, drafted);
  const completed = await jobQueueDB.getWorkCompletion(
    input.userAddress,
    input.chainId,
    input.clientWorkId
  );
  if (completed)
    return {
      kind: "direct",
      jobId: completed.jobId,
      sponsored: false,
      clientWorkId: input.clientWorkId,
      txHash: completed.transactionHash as `0x${string}`,
    };
  if (queued.newlyAdmitted === false) {
    const existing = await jobQueueDB.getJob(queued.jobId);
    rejectTerminalWork(existing, input.onTerminalUnsentFailure);
    const checkpoint = (existing?.payload as WorkJobPayload | undefined)?.uploadCheckpoint;
    const awaiting = Boolean(
      checkpoint?.broadcast || checkpoint?.transactionHash || checkpoint?.broadcastPending
    );
    // Submitting again after declining the prompt is the person asking to send it.
    // A retained send is checked again: a wallet's by its transaction, any other
    // session's by the queue, which settles a recorded send rather than sending a second copy.
    const canCheckRetainedSend =
      input.retainSubmission &&
      (input.authMode !== "wallet" || Boolean(checkpoint?.transactionHash));
    if ((awaiting && !canCheckRetainedSend) || (!awaiting && !existing?.meta?.requiresExplicitSend))
      return {
        ...queuedOutcome(queued, ports.sender),
        kind: awaiting ? "awaiting-confirmation" : "queued",
      } as SubmitWorkOutcome;
  }
  // Admission is durable; on an unconfirmed connection the work waits in the queue.
  if (!(await ports.connectivity.confirm())) {
    if (!input.allowOfflineQueue) return refuseForConnection(queued, ports);
    return queuedOutcome(
      queued,
      ports.sender,
      ports.connectivity.isOnline() ? "connection-unconfirmed" : undefined
    );
  }
  if (input.authMode !== "wallet") {
    await input.assertOwnership?.();
    if (!ports.sender) return queuedOutcome(queued, ports.sender);
    const result = await ports.queue.process(queued.jobId, ports.sender, input.assertOwnership);
    // The work stays queued; the person is told they cancelled, not that it failed.
    if (result.error === "send-cancelled") throw new WorkSendCancelledError();
    if (!result.success) {
      rejectTerminalWork(await jobQueueDB.getJob(queued.jobId), input.onTerminalUnsentFailure);
      if (result.error?.includes("work-transaction-reverted"))
        throw new WorkTransactionReverted("0x");
      if (
        result.error?.startsWith("unavailable:") ||
        result.error === "submission-ownership-changed"
      )
        throw new Error(result.error);
      if (result.error === "already-processing") return heldElsewhere(queued, ports);
      if (!input.allowOfflineQueue && result.error !== "awaiting-confirmation") {
        // Without the offline queue no later pass sends it, so this Submit fails
        // and the work waits for the next one. The explicit send lifted its hold
        // for the queue's retries; it is held again.
        await jobQueueDB.amendJob(queued.jobId, (job) => {
          job.meta = { ...job.meta, requiresExplicitSend: true };
        });
        if (result.error === "offline" || result.error === "connection-unconfirmed")
          return refuseForConnection(queued, ports);
        throw new Error(result.error ?? "submission-failed");
      }
    }
    return result.success && result.txHash
      ? ({
          ...queuedOutcome(queued, ports.sender),
          kind: "processed",
          txHash: result.txHash as `0x${string}`,
        } as SubmitWorkOutcome)
      : ({
          ...queuedOutcome(queued, ports.sender),
          kind: result.error === "awaiting-confirmation" ? "awaiting-confirmation" : "queued",
        } as SubmitWorkOutcome);
  }
  const claim = await acquireWorkJobs([queued.jobId]);
  if (!claim) return heldElsewhere(queued, ports);
  const stopHolding = holdWorkClaims([claim]);
  try {
    const job = await jobQueueDB.getJob(queued.jobId);
    if (!job || job.synced) {
      const completion = await jobQueueDB.getWorkCompletion(
        input.userAddress,
        input.chainId,
        input.clientWorkId
      );
      return completion
        ? {
            kind: "direct",
            jobId: completion.jobId,
            sponsored: false,
            clientWorkId: input.clientWorkId,
            txHash: completion.transactionHash as `0x${string}`,
          }
        : queuedOutcome(queued, ports.sender);
    }
    const payload = job.payload as WorkJobPayload;
    input.draft.uploadCheckpoint = payload.uploadCheckpoint;
    const assertOwnership = async () => {
      await claim.assertOwned();
      await input.assertOwnership?.();
    };
    await assertOwnership();
    const checkpoint = payload.uploadCheckpoint;
    rejectTerminalWork(job, input.onTerminalUnsentFailure);
    if (
      job.meta?.legacyConfirmation ||
      checkpoint?.broadcast?.kind === "user-operation" ||
      (checkpoint?.broadcastPending && !checkpoint.transactionHash)
    )
      return {
        ...queuedOutcome(queued, ports.sender),
        kind: "awaiting-confirmation",
      } as SubmitWorkOutcome;
    // Work for a promise this account is still taking up waits, queued, for the take-up.
    if (!checkpoint?.transactionHash && (await findTakeUpOf(job, jobQueueDB)))
      return queuedOutcome(queued, ports.sender);
    // A photo picked before the decoder could load converts in storage first, and
    // the send reads the stored JPEG. Until it can convert, the work waits queued.
    let images = input.images;
    if (images.some(isHeicFile)) {
      if ((await convertQueuedHeicMedia(job)).status !== "ready")
        return queuedOutcome(queued, ports.sender);
      images = (await jobQueueDB.getImagesForJob(job.id))
        .map((image) => image.file)
        .filter((file) => !file.type.startsWith("audio/"));
    }
    const persist = async (value: WorkUploadCheckpoint) => {
      await claim.assertOwned();
      payload.uploadCheckpoint = value;
      input.draft.uploadCheckpoint = value;
      await jobQueueDB.updateJob(job);
      // A draft is cleanup state after admission. Its write may fail without losing the durable job checkpoint.
      await input.onCheckpoint?.(value).catch(() => undefined);
    };
    const startedAt = Date.now();
    try {
      const txHash = await holdingSend(job.id, () =>
        ports.direct.submitWork(
          {
            ...input,
            images,
            assertOwnership,
            onCheckpoint: persist,
            onBroadcast: async (hash) => {
              rememberWorkBroadcast(job.id, hash);
              await persist({
                submittedAt: new Date().toISOString(),
                files: {},
                ...payload.uploadCheckpoint,
                transactionHash: hash,
                broadcast: { kind: "transaction", hash },
                broadcastPending: false,
              });
              await input.onBroadcast?.(hash).catch(() => undefined);
            },
          },
          ports.onWalletStage
        )
      );
      const { readConfirmedWork } = await import("./work-confirmation");
      const confirmedWork = await readConfirmedWork(
        job as Job<WorkJobPayload>,
        txHash as `0x${string}`,
        input.chainId
      );
      if (confirmedWork) {
        payload.confirmedWork = confirmedWork;
        await jobQueueDB.updateJob(job);
      }
      await jobQueueDB.storeClientWorkIdMapping(input.clientWorkId, txHash, job.id);
      await jobQueueDB.markJobSynced(job.id, txHash);
      forgetWorkBroadcast(job.id);
      await jobQueueDB.deleteJob(job.id).catch(() => undefined);
      jobQueueEventBus.emit("job:completed", { jobId: job.id, job, txHash });
      trackJobProcessed(job.kind, Date.now() - startedAt, job.attempts + 1);
      return {
        kind: "direct",
        txHash,
        sponsored: false,
        clientWorkId: input.clientWorkId,
        jobId: job.id,
      };
    } catch (error) {
      if (error instanceof WorkTransactionReverted) {
        job.meta = { ...job.meta, workTransactionReverted: true };
        if (payload.uploadCheckpoint) payload.uploadCheckpoint.transactionReverted = true;
        await jobQueueDB.updateJob(job);
        await jobQueueDB.markJobTerminalFailed(job.id, "work-transaction-reverted");
        trackJobPermanentlyFailed({ ...job, lastError: "work-transaction-reverted" });
        throw error;
      }
      const cause = error instanceof Error && error.cause ? error.cause : error;
      if (cause instanceof Error && cause.message === "submission-ownership-changed") throw error;
      // The wallet approves and broadcasts in one step; the intent was recorded
      // before it asked. A refusal proves nothing was sent.
      const checkpoint = payload.uploadCheckpoint;
      const failure = classifySendFailure(error, {
        intentRecorded: Boolean(checkpoint?.broadcastPending),
        broadcastKnown: Boolean(checkpoint?.transactionHash || checkpoint?.broadcast),
      });
      if (failure.kind === "not-sent" && checkpoint?.broadcastPending) {
        // Nothing was sent: the intent goes, with the chain's head kept for it.
        delete checkpoint.broadcastPending;
        delete checkpoint.broadcastPendingAt;
        delete checkpoint.intentBlock;
        delete checkpoint.intentChainTime;
        await jobQueueDB.updateJob(job);
      }
      if (failure.kind === "not-sent" && failure.cancelled) {
        job.meta = { ...job.meta, requiresExplicitSend: true };
        await jobQueueDB.updateJob(job);
        throw error;
      }
      if (
        payload.uploadCheckpoint?.broadcastPending ||
        payload.uploadCheckpoint?.transactionHash ||
        error instanceof AwaitingWorkConfirmation
      )
        return {
          ...queuedOutcome(queued, ports.sender),
          kind: "awaiting-confirmation",
        } as SubmitWorkOutcome;
      if (isNetworkError(error) || error instanceof PendingHeicConversionError) {
        if (!input.allowOfflineQueue) throw error;
        return queuedOutcome(queued, ports.sender);
      }
      const lastError = error instanceof Error ? error.message : "submission-failed";
      await jobQueueDB.markJobTerminalFailed(job.id, lastError);
      trackJobPermanentlyFailed({ ...job, lastError });
      if (failure.kind === "not-sent") input.onTerminalUnsentFailure?.();
      throw error;
    }
  } finally {
    stopHolding();
    await claim.release();
  }
}
