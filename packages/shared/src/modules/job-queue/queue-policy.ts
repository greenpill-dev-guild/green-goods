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

export function commitmentJobIdentity(kind: string, payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  switch (kind) {
    case "commitmentSeries":
      return typeof value.clientSeriesId === "string" ? `${kind}:${value.clientSeriesId}` : null;
    case "commitment":
      return typeof value.clientCommitmentId === "string"
        ? `${kind}:${value.clientCommitmentId}`
        : null;
    case "workLink":
      return typeof value.operationKey === "string" ? `${kind}:${value.operationKey}` : null;
    case "claim":
      return `${kind}:${String(value.commitmentId)}:${String(value.kind)}:${String(value.gardenContext).toLowerCase()}`;
    case "evidence":
      return `${kind}:${String(value.commitmentId)}:${String(value.cid)}`;
    case "confirmation":
      return `${kind}:${String(value.action)}:${String(value.commitmentId)}`;
    default:
      return null;
  }
}

export function canonicalJobPayload(payload: unknown): string {
  return JSON.stringify(payload, (_key, value) =>
    typeof value === "bigint" ? { __bigint: value.toString() } : value
  );
}
