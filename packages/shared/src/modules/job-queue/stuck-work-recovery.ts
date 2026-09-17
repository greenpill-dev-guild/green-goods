/**
 * One-time recovery of queued work earlier builds gave up on
 *
 * Earlier builds ended some queued work for reasons that no longer hold: a
 * declined prompt was final, a HEIC photo failed as an unsupported type, and a
 * send that failed five times before it reached the network retired the job.
 * Recovery gives each such job its retries back and holds it for the person's
 * own upload, so nothing is sent on its own. A recovered job is marked with
 * `meta.recoveryVersion` and is never recovered twice.
 *
 * @module modules/job-queue/stuck-work-recovery
 */

import type {
  ApprovalJobPayload,
  Job,
  SendCheckpoint,
  WorkJobPayload,
} from "../../types/job-queue";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import { jobQueueDB } from "./db";
import { MAX_RETRIES } from "./queue-policy";

const STUCK_WORK_RECOVERY_VERSION = 1;

export type StuckWorkReason = "declined" | "photo-type" | "retries" | "source-work";

const SOURCE_WORK_TERMINAL = "identity_conflict:source-work-terminal";

function recordedSend(job: Job): SendCheckpoint | undefined {
  if (job.kind === "work") return (job.payload as WorkJobPayload).uploadCheckpoint;
  if (job.kind === "approval") return (job.payload as ApprovalJobPayload).sendCheckpoint;
  return undefined;
}

/** Why an earlier build ended this job, when that reason no longer holds. */
export function stuckWorkReason(job: Job): StuckWorkReason | null {
  const error = job.lastError;
  if (!error || job.synced || job.attempts < MAX_RETRIES) return null;
  if (Number(job.meta?.recoveryVersion ?? 0) >= STUCK_WORK_RECOVERY_VERSION) return null;
  // A commitment's link waits on its work, which recovery gives back.
  if (job.kind === "workLink") return error === SOURCE_WORK_TERMINAL ? "source-work" : null;
  if (job.kind !== "work" && job.kind !== "approval") return null;
  // A send that may be on-chain is confirmed, and a reverted one is retried by hand.
  const sent = recordedSend(job);
  if (sent?.broadcast || sent?.transactionHash || sent?.broadcastPending) return null;
  if (job.meta?.workTransactionReverted) return null;

  if (error === "cancelled") return "declined";
  if (error.startsWith("unavailable:")) {
    const reason = error.slice("unavailable:".length);
    if (isCancelledTxError(new Error(reason))) return "declined";
    // Only an unsupported photo type is recovered: a HEIC photo now converts.
    const problems = reason.split(",").map((problem) => problem.trim());
    return problems.every((problem) => problem === "media-type") ? "photo-type" : null;
  }
  return error.startsWith("Max retries") ? "retries" : null;
}

/**
 * Give stuck jobs back their retries. Each write re-reads the job inside one
 * transaction, so a job that changed meanwhile is judged on what it is now.
 */
export async function recoverStuckWork(userAddress: string): Promise<string[]> {
  const candidates = (await jobQueueDB.getJobs({ userAddress, synced: false })).filter(
    (job) => stuckWorkReason(job) !== null
  );
  if (candidates.length === 0) return [];
  const db = await jobQueueDB.init();
  const recovered: string[] = [];
  await db.transaction("rw", db.jobs, async () => {
    for (const { id } of candidates) {
      // The stored record keeps its serialized payload; only its state changes.
      const stored = await db.jobs.get(id);
      const reason = stored ? stuckWorkReason(stored) : null;
      if (!stored || !reason) continue;
      const {
        waitingReason: _waitingReason,
        metadataAttempts: _metadataAttempts,
        evidenceAttempts: _evidenceAttempts,
        ...meta
      } = stored.meta ?? {};
      const { lastError: _lastError, ...job } = stored;
      await db.jobs.put({
        ...job,
        attempts: 0,
        meta: {
          ...meta,
          waitingForDependency: false,
          recoveryVersion: STUCK_WORK_RECOVERY_VERSION,
          // Work and decisions wait for the person's upload; a link follows its work.
          ...(reason === "source-work" ? {} : { requiresExplicitSend: true }),
        },
      });
      recovered.push(id);
    }
  });
  return recovered;
}
