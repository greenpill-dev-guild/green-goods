import type { Job } from "../../types/job-queue";

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
