import type { Job, SendCheckpoint } from "../../types/job-queue";

export const MAX_RETRIES = 5;
export const COMMITMENT_WAITING_REPROBE_MS = 30_000;

export function createOfflineTxHash(jobId: string): `0x${string}` {
  const paddedId = jobId.replace(/-/g, "").substring(0, 56).padStart(56, "0");
  return `0xoffline_${paddedId}` as `0x${string}`;
}

export function isOfflineTxHash(txHash: string): boolean {
  return txHash.startsWith("0xoffline_");
}

export function isTerminallyFailedJob(job: Job): boolean {
  return !job.synced && job.attempts >= MAX_RETRIES;
}

export function isWaitingReprobeThrottled(job: Job, now: number = Date.now()): boolean {
  return Boolean(
    job.meta?.waitingForDependency === true &&
      job.lastAttemptAt &&
      now - job.lastAttemptAt < COMMITMENT_WAITING_REPROBE_MS
  );
}

/**
 * Where each job kind keeps its send record, inside its payload. A work's record
 * shares its field with the uploads it saved, so that field is never removed. A
 * kind that starts recording its sends adds one line here, and every reader and
 * writer below follows.
 */
const SEND_RECORDS: Record<string, { field: string; keepsOtherState?: boolean }> = {
  work: { field: "uploadCheckpoint", keepsOtherState: true },
  approval: { field: "sendCheckpoint" },
};

/** What a job recorded about reaching the network while it was sent. */
export function sendCheckpointOf(job: Pick<Job, "kind" | "payload">): SendCheckpoint | undefined {
  const record = SEND_RECORDS[job.kind];
  if (!record) return undefined;
  return (job.payload as Record<string, SendCheckpoint | undefined>)[record.field];
}

/** Whether a job's send may already be on-chain, so it is confirmed and never sent again. */
export function hasRecordedSend(job: Pick<Job, "kind" | "payload">): boolean {
  const sent = sendCheckpointOf(job);
  return Boolean(sent?.broadcast || sent?.transactionHash || sent?.broadcastPending);
}

/** Replace a job's send record, or clear it, keeping whatever else shares its field. */
export function writeSendCheckpoint(job: Job, send: SendCheckpoint | undefined): void {
  const record = SEND_RECORDS[job.kind];
  if (!record) return;
  const payload = job.payload as Record<string, unknown>;
  const {
    broadcast: _broadcast,
    broadcastPending: _pending,
    broadcastPendingAt: _pendingAt,
    transactionHash: _hash,
    ...rest
  } = (payload[record.field] ?? {}) as Record<string, unknown>;
  if (!send && (!record.keepsOtherState || payload[record.field] === undefined)) {
    delete payload[record.field];
    return;
  }
  payload[record.field] = record.keepsOtherState
    ? { submittedAt: new Date().toISOString(), files: {}, ...rest, ...send }
    : { ...rest, ...send };
}
