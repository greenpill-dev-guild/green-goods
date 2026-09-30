/**
 * Sending a set's creations
 *
 * Every copy of a set is its own `commitment` job, and the queue stays its
 * record: a copy that doesn't send waits there to be finished from the pool
 * tab, and one whose answer was lost is read back from the chain before it is
 * ever sent again. What this adds is how many times the wallet asks:
 *
 * - a wallet that runs several calls as one transaction is asked once per
 *   bundle of up to ten copies, all or nothing (PRD-1022 D7);
 * - any other wallet is asked once per copy, and declining one skips only
 *   that one;
 * - passkey and embedded accounts send nothing from here: their copies wait in
 *   the queue, as any queued act does, for the pool tab's Send Now (or a
 *   background flush, where the app runs one; the admin runs none).
 *
 * Each copy runs through `processJob` either way, so its claim, its metadata
 * publishing, its recovery read and its failure record behave exactly as they
 * do for a single commitment. A creation's first pass only submits; a second
 * reads the new commitment back from the chain and completes the job.
 *
 * When nothing of a set can be on chain (declined, or refused before or on the
 * chain), its jobs are cleared: the dialog keeps the answers, which the steward
 * may still change. Otherwise its unsent copies stay queued.
 *
 * @module modules/commitment-pooling/creation-send
 */

import type { Address } from "../../types/domain";
import { classifyTxError } from "../../utils/errors/tx-error-classifier";
import { logger } from "../app/logger";
import type { JobQueueHandle, JobSendPhase, ProcessJobResult } from "../job-queue/ports";
import { isTerminallyFailedJob } from "../job-queue/queue-policy";
import { type BundleOutcome, createBundlingSender } from "../transactions/bundling-sender";
import type { TransactionSender } from "../transactions/types";
import type { CommitmentCreationPayload } from "./job-types";
import {
  chunkCopies,
  type SeedCopyMiss,
  type SeedCopyProgress,
  seedSetLeftNothing,
} from "./seed-sets";

/** How the wallet is asked: once per bundle, once per copy, or not from here at all. */
export type CreationSendMode = "bundle" | "one-by-one" | "background";

export interface CreationCopy {
  clientCommitmentId: string;
  /** The set it belongs to, so a set that left nothing is cleared as one. */
  setId: string;
  /** Built once, at the set's first Create; never rebuilt for a retry. */
  payload: Omit<CommitmentCreationPayload, "creationRequestKey">;
}

export type CreationQueue = Pick<
  JobQueueHandle,
  "addJob" | "processJob" | "discardJob" | "retryJob" | "getJobs"
>;

export interface CreationSendInput {
  copies: readonly CreationCopy[];
  queue: CreationQueue;
  sender: TransactionSender | null;
  owner: Address;
  chainId: number;
  /** Told each time a copy moves. Report-only: a throw here never reaches a send. */
  onCopy?: (progress: SeedCopyProgress) => void;
}

/** Asking the wallet what it can do never prompts anyone. */
export async function creationSendMode(
  sender: TransactionSender | null,
  chainId: number
): Promise<CreationSendMode> {
  if (sender?.authMode !== "wallet") return "background";
  if (!sender.sendAtomicBatch || !sender.canSendAtomicBatch) return "one-by-one";
  const able = await sender.canSendAtomicBatch(chainId).catch(() => false);
  return able ? "bundle" : "one-by-one";
}

/** Why a copy's own send failed, when its error is all there is to go on. */
function missOf(error: unknown): SeedCopyMiss {
  const { kind } = classifyTxError(error);
  if (kind === "cancelled") return "declined";
  if (kind === "reverted") return "refused";
  return "failed";
}

function missOfBundle(outcome: BundleOutcome, error: unknown): SeedCopyMiss {
  if (outcome.status === "declined") return "declined";
  if (outcome.status === "refused") return "refused";
  if (outcome.status === "failed") return "failed";
  return missOf(error);
}

/** A creation's first pass submitted it; the second reads it back. */
function submitted(result: ProcessJobResult): boolean {
  return !result.success && Boolean(result.skipped) && Boolean(result.txHash);
}

function clientIdOf(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as { clientCommitmentId?: unknown }).clientCommitmentId;
  return typeof value === "string" ? value : null;
}

export async function sendCreationCopies(input: CreationSendInput): Promise<SeedCopyProgress[]> {
  const { copies, queue, sender, owner, chainId } = input;
  const progress = new Map<string, SeedCopyProgress>(
    copies.map((copy) => [
      copy.clientCommitmentId,
      { clientCommitmentId: copy.clientCommitmentId, status: "waiting", txHash: null, jobId: null },
    ])
  );
  const tell = (id: string, patch: Partial<SeedCopyProgress>) => {
    const next = { ...(progress.get(id) as SeedCopyProgress), ...patch };
    progress.set(id, next);
    try {
      input.onCopy?.(next);
    } catch (error) {
      logger.warn("[creation-send] a progress report threw", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const ended = (id: string, result: ProcessJobResult, miss: () => SeedCopyMiss) => {
    if (result.success) tell(id, { status: "created", txHash: result.txHash ?? null });
    else if (result.skipped) tell(id, { status: "later", txHash: result.txHash ?? null });
    else tell(id, { status: "not-sent", miss: miss() });
  };

  // A copy tried before keeps its job, and the retry is that same job: a second
  // admission would be refused once the first has published its words.
  const live = new Map<string, string>();
  for (const job of await queue.getJobs(owner, { kind: "commitment", synced: false })) {
    const id = clientIdOf(job.payload);
    if (id && !isTerminallyFailedJob(job)) live.set(id, job.id);
  }
  const admitted: Array<{ id: string; jobId: string }> = [];
  for (const copy of copies) {
    const id = copy.clientCommitmentId;
    try {
      const existing = live.get(id);
      if (existing) await queue.retryJob(existing);
      const jobId =
        existing ??
        (await queue.addJob("commitment", copy.payload as CommitmentCreationPayload, owner, {
          chainId,
        }));
      tell(id, { jobId });
      admitted.push({ id, jobId });
    } catch (error) {
      logger.error("[creation-send] a copy could not be queued", {
        clientCommitmentId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      tell(id, { status: "not-sent", miss: "failed" });
    }
  }

  const mode = await creationSendMode(sender, chainId);
  if (mode === "background" || !sender) {
    for (const { id } of admitted) tell(id, { status: "later" });
  } else if (mode === "bundle") {
    for (const chunk of chunkCopies(admitted)) {
      const bundle = createBundlingSender(
        sender,
        chunk.map(({ jobId }) => jobId),
        {
          onAsking: () => chunk.forEach(({ id }) => tell(id, { status: "wallet" })),
          onAccepted: () => chunk.forEach(({ id }) => tell(id, { status: "confirming" })),
        }
      );
      for (const { id } of chunk) tell(id, { status: "preparing" });
      const firsts = await Promise.all(
        chunk.map(({ jobId }) =>
          queue
            .processJob(jobId, { transactionSender: bundle.senderFor(jobId), explicit: true })
            .finally(() => bundle.finished(jobId))
        )
      );
      const outcome = await bundle.outcome;
      for (const [index, { id, jobId }] of chunk.entries()) {
        const first = firsts[index] as ProcessJobResult;
        if (submitted(first)) {
          tell(id, { status: "confirming", txHash: first.txHash ?? null });
          const second = await queue.processJob(jobId, {
            transactionSender: sender,
            explicit: true,
          });
          ended(id, { ...second, txHash: second.txHash ?? first.txHash }, () => "failed");
        } else {
          ended(id, first, () =>
            bundle.sentBy(jobId) ? missOfBundle(outcome, first.error) : missOf(first.error)
          );
        }
      }
    }
  } else {
    for (const { id, jobId } of admitted) {
      tell(id, { status: "preparing" });
      const context = {
        transactionSender: sender,
        explicit: true,
        onPhase: (phase: JobSendPhase) =>
          tell(
            id,
            phase.stage === "wallet"
              ? { status: "wallet" }
              : { status: "confirming", txHash: phase.txHash }
          ),
      };
      const first = await queue.processJob(jobId, context);
      const result = submitted(first) ? await queue.processJob(jobId, context) : first;
      ended(id, { ...result, txHash: result.txHash ?? first.txHash }, () => missOf(result.error));
    }
  }

  await clearSetsThatLeftNothing(copies, progress, queue, tell);
  return copies.map((copy) => progress.get(copy.clientCommitmentId) as SeedCopyProgress);
}

/**
 * A set none of whose copies can be on chain goes back to being the steward's
 * answers: its jobs are discarded, so the queue and the pool tab hold nothing
 * of it. A job the queue won't let go of may have been sent after all; that
 * copy is kept, and so is the rest of its set.
 */
async function clearSetsThatLeftNothing(
  copies: readonly CreationCopy[],
  progress: Map<string, SeedCopyProgress>,
  queue: CreationQueue,
  tell: (id: string, patch: Partial<SeedCopyProgress>) => void
): Promise<void> {
  const sets = new Map<string, string[]>();
  for (const copy of copies) {
    sets.set(copy.setId, [...(sets.get(copy.setId) ?? []), copy.clientCommitmentId]);
  }
  for (const ids of sets.values()) {
    const rows = ids.map((id) => progress.get(id) as SeedCopyProgress);
    if (!seedSetLeftNothing(rows)) continue;
    for (const row of rows) {
      if (row.status !== "not-sent" || !row.jobId) continue;
      const discarded = await queue.discardJob(row.jobId).catch(() => false);
      tell(row.clientCommitmentId, discarded ? { jobId: null } : { miss: "failed" });
    }
  }
}
