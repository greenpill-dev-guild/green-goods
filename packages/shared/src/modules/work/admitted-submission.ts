import type { Job, WorkJobPayload } from "../../types/job-queue";
import type { WorkUploadCheckpoint } from "../../types/domain";
import type { TransactionSender } from "../transactions/types";
import { jobQueueDB } from "../job-queue/db";
import { MAX_RETRIES } from "../job-queue/queue-policy";
import { jobQueueEventBus } from "../job-queue/event-bus";
import { convertQueuedHeicMedia } from "../job-queue/job-media-conversion";
import { isHeicFile, PendingHeicConversionError } from "./work-attachments";
import type {
  QueuedWorkSubmission,
  ResolvedSubmitWorkCommand,
  SubmitWorkOutcome,
  SubmitWorkPorts,
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

export function queuedOutcome(
  queued: QueuedWorkSubmission,
  sender: TransactionSender | null
): SubmitWorkOutcome {
  return {
    kind: "queued",
    txHash: queued.txHash,
    sponsored: sender?.supportsSponsorship ?? false,
    jobId: queued.jobId,
    clientWorkId: queued.clientWorkId,
  };
}

function rejectTerminalWork(job: Job | undefined) {
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
  )
    throw new Error(job.lastError ?? "submission-requires-retry");
}

export async function submitAdmittedWork(
  input: ResolvedSubmitWorkCommand,
  ports: SubmitWorkPorts
): Promise<SubmitWorkOutcome> {
  const queued = await ports.queue.admit!(input);
  const completed = await jobQueueDB.getWorkCompletion(
    input.userAddress,
    input.chainId,
    input.clientWorkId
  );
  if (completed)
    return {
      kind: "direct",
      sponsored: false,
      clientWorkId: input.clientWorkId,
      txHash: completed.transactionHash as `0x${string}`,
    };
  if (queued.newlyAdmitted === false) {
    const existing = await jobQueueDB.getJob(queued.jobId);
    rejectTerminalWork(existing);
    const checkpoint = (existing?.payload as WorkJobPayload | undefined)?.uploadCheckpoint;
    const awaiting = Boolean(
      checkpoint?.broadcast || checkpoint?.transactionHash || checkpoint?.broadcastPending
    );
    // Submitting again after declining the prompt is the person asking to send it.
    if (awaiting || !existing?.meta?.requiresExplicitSend)
      return {
        ...queuedOutcome(queued, ports.sender),
        kind: awaiting ? "awaiting-confirmation" : "queued",
      } as SubmitWorkOutcome;
  }
  if (!ports.connectivity.isOnline()) return queuedOutcome(queued, ports.sender);
  if (input.authMode !== "wallet") {
    await input.assertOwnership?.();
    if (!ports.sender) return queuedOutcome(queued, ports.sender);
    const result = await ports.queue.process(queued.jobId, ports.sender, input.assertOwnership);
    // The work stays queued; the person is told they cancelled, not that it failed.
    if (result.error === "send-cancelled") throw new WorkSendCancelledError();
    if (!result.success) {
      rejectTerminalWork(await jobQueueDB.getJob(queued.jobId));
      if (result.error?.includes("work-transaction-reverted"))
        throw new WorkTransactionReverted("0x");
      if (
        result.error?.startsWith("unavailable:") ||
        result.error === "submission-ownership-changed"
      )
        throw new Error(result.error);
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
  if (!claim) return queuedOutcome(queued, ports.sender);
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
    rejectTerminalWork(job);
    if (
      job.meta?.legacyConfirmation ||
      checkpoint?.broadcast?.kind === "user-operation" ||
      (checkpoint?.broadcastPending && !checkpoint.transactionHash)
    )
      return {
        ...queuedOutcome(queued, ports.sender),
        kind: "awaiting-confirmation",
      } as SubmitWorkOutcome;
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
    try {
      const txHash = await ports.direct.submitWork(
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
      );
      await jobQueueDB.storeClientWorkIdMapping(input.clientWorkId, txHash, job.id);
      await jobQueueDB.markJobSynced(job.id, txHash);
      forgetWorkBroadcast(job.id);
      await jobQueueDB.deleteJob(job.id).catch(() => undefined);
      jobQueueEventBus.emit("job:completed", { jobId: job.id, job, txHash });
      return { kind: "direct", txHash, sponsored: false, clientWorkId: input.clientWorkId };
    } catch (error) {
      if (error instanceof WorkTransactionReverted) {
        job.meta = { ...job.meta, workTransactionReverted: true };
        if (payload.uploadCheckpoint) payload.uploadCheckpoint.transactionReverted = true;
        await jobQueueDB.updateJob(job);
        await jobQueueDB.markJobTerminalFailed(job.id, "work-transaction-reverted");
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
        delete checkpoint.broadcastPending;
        delete checkpoint.broadcastPendingAt;
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
      if (isNetworkError(error) || error instanceof PendingHeicConversionError)
        return queuedOutcome(queued, ports.sender);
      await jobQueueDB.markJobTerminalFailed(
        job.id,
        error instanceof Error ? error.message : "submission-failed"
      );
      throw error;
    }
  } finally {
    await claim.release();
  }
}
