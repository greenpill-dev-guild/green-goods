import { inTransaction } from "./database";
import type { ReportingCore } from "./runtime";

/**
 * Durable background jobs: media processing, authority checks, preparation, delegated execution,
 * reconciliation and cleanup. External work runs from these leased records, never from side
 * effects during rehydration. A dedupe key makes enqueueing idempotent; a fence stops a worker
 * whose lease expired from recording a result after another worker reclaimed the job.
 */
export type JobKind =
  | "process_media"
  | "resolve_authority"
  | "prepare_operation"
  | "execute_delegated"
  | "watch_owner_attempt"
  | "review_list"
  | "review_open"
  | "review_authority"
  | "reconcile_operation"
  | "reconcile_grant"
  | "purge_private_content"
  | "retention_sweep";

export interface ClaimedJob {
  id: string;
  kind: JobKind;
  subjectId: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  fence: number;
  holder: string;
}

const JOB_LEASE_MS = 60_000;

export function enqueueJob(
  core: ReportingCore,
  input: {
    kind: JobKind;
    subjectId: string;
    dedupeKey: string;
    payload?: Record<string, unknown>;
    runAfter?: number;
    maxAttempts?: number;
  }
): string | null {
  const id = core.ids.id();
  const now = core.clock.now();
  const result = core.db
    .query(
      `INSERT OR IGNORE INTO processing_jobs
         (id, kind, subject_id, dedupe_key, state, max_attempts, run_after, payload_json, created_at, updated_at)
       VALUES ($id, $kind, $subject, $dedupe, 'pending', $max, $runAfter, $payload, $now, $now)`
    )
    .run({
      id,
      kind: input.kind,
      subject: input.subjectId,
      dedupe: input.dedupeKey,
      max: input.maxAttempts ?? 5,
      runAfter: input.runAfter ?? now,
      payload: JSON.stringify(input.payload ?? {}),
      now,
    });
  return result.changes === 1 ? id : null;
}

export function claimJob(
  core: ReportingCore,
  holder: string,
  kinds?: readonly JobKind[]
): ClaimedJob | null {
  return inTransaction(core.db, () => {
    const now = core.clock.now();
    const kindFilter = kinds ? `AND kind IN (${kinds.map((kind) => `'${kind}'`).join(",")})` : "";
    const row = core.db
      .query(
        `SELECT id FROM processing_jobs
         WHERE ((state = 'pending' AND run_after <= $now) OR (state = 'leased' AND lease_expires_at <= $now))
         ${kindFilter}
         ORDER BY run_after, created_at LIMIT 1`
      )
      .get({ now }) as { id: string } | null;
    if (!row) return null;
    const claimed = core.db
      .query(
        `UPDATE processing_jobs
         SET state = 'leased', lease_holder = $holder, lease_expires_at = $expires, fence = fence + 1,
             attempts = attempts + 1, updated_at = $now
         WHERE id = $id
         RETURNING id, kind, subject_id, payload_json, attempts, max_attempts, fence`
      )
      .get({ id: row.id, holder, expires: now + JOB_LEASE_MS, now }) as {
      id: string;
      kind: JobKind;
      subject_id: string;
      payload_json: string;
      attempts: number;
      max_attempts: number;
      fence: number;
    };
    return {
      id: claimed.id,
      kind: claimed.kind,
      subjectId: claimed.subject_id,
      payload: JSON.parse(claimed.payload_json) as Record<string, unknown>,
      attempts: claimed.attempts,
      maxAttempts: claimed.max_attempts,
      fence: claimed.fence,
      holder,
    };
  });
}

/** True when the caller still owns the job; use inside any transaction that records its effect. */
export function completeJob(core: ReportingCore, job: ClaimedJob): boolean {
  return (
    core.db
      .query(
        `UPDATE processing_jobs SET state = 'succeeded', lease_holder = NULL, updated_at = $now
         WHERE id = $id AND lease_holder = $holder AND fence = $fence`
      )
      .run({ id: job.id, holder: job.holder, fence: job.fence, now: core.clock.now() }).changes ===
    1
  );
}

/** Schedules another attempt, or parks the job as failed once its budget is spent. */
export function retryJob(
  core: ReportingCore,
  job: ClaimedJob,
  errorCode: string,
  delayMs: number
): "retrying" | "failed" {
  const failed = job.attempts >= job.maxAttempts;
  core.db
    .query(
      `UPDATE processing_jobs
       SET state = $state, lease_holder = NULL, run_after = $runAfter, last_error_code = $code, updated_at = $now
       WHERE id = $id AND lease_holder = $holder AND fence = $fence`
    )
    .run({
      id: job.id,
      holder: job.holder,
      fence: job.fence,
      state: failed ? "failed" : "pending",
      runAfter: core.clock.now() + delayMs,
      code: errorCode,
      now: core.clock.now(),
    });
  return failed ? "failed" : "retrying";
}

/** Operator replay of a failed job; it keeps its dedupe identity and history. */
export function replayFailedJob(core: ReportingCore, jobId: string): boolean {
  return (
    core.db
      .query(
        `UPDATE processing_jobs SET state = 'pending', run_after = $now, max_attempts = attempts + 1, updated_at = $now
         WHERE id = $id AND state = 'failed'`
      )
      .run({ id: jobId, now: core.clock.now() }).changes === 1
  );
}
