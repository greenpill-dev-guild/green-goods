import { CONTROL_NAMES, readControl } from "./controls";
import type { ReportingCore } from "./runtime";

/**
 * Operator view of the reporting queues: counts and states only, never message content, subjects
 * or account addresses. It shows what is waiting, what is quarantined, what needs investigation
 * (failed jobs, reconciliation conflicts, uncertain attempts) and the operating switches.
 */
export interface OperatorSnapshot {
  controls: Record<string, { enabled: boolean; version: number }>;
  inbox: Record<string, number>;
  jobs: Record<string, number>;
  failedJobs: Array<{ id: string; kind: string; errorCode: string | null; attempts: number }>;
  outbox: Record<string, number>;
  operations: Record<string, number>;
  uncertainAttempts: number;
  reconciliationConflicts: number;
}

function countBy(core: ReportingCore, sql: string): Record<string, number> {
  const rows = core.db.query(sql).all() as Array<{ key: string; n: number }>;
  return Object.fromEntries(rows.map((row) => [row.key, row.n]));
}

export function operatorSnapshot(core: ReportingCore): OperatorSnapshot {
  const controls = Object.fromEntries(CONTROL_NAMES.map((name) => [name, readControl(core, name)]));
  return {
    controls,
    inbox: countBy(core, "SELECT state AS key, count(*) AS n FROM inbox_events GROUP BY state"),
    jobs: countBy(
      core,
      "SELECT kind || ':' || state AS key, count(*) AS n FROM processing_jobs GROUP BY kind, state"
    ),
    failedJobs: (
      core.db
        .query(
          `SELECT id, kind, last_error_code, attempts FROM processing_jobs
           WHERE state = 'failed' ORDER BY updated_at DESC LIMIT 50`
        )
        .all() as Array<{
        id: string;
        kind: string;
        last_error_code: string | null;
        attempts: number;
      }>
    ).map((row) => ({
      id: row.id,
      kind: row.kind,
      errorCode: row.last_error_code,
      attempts: row.attempts,
    })),
    outbox: countBy(core, "SELECT state AS key, count(*) AS n FROM delivery_outbox GROUP BY state"),
    operations: countBy(
      core,
      "SELECT kind || ':' || state AS key, count(*) AS n FROM execution_operations GROUP BY kind, state"
    ),
    uncertainAttempts: (
      core.db
        .query("SELECT count(*) AS n FROM execution_attempts WHERE state = 'uncertain'")
        .get() as { n: number }
    ).n,
    reconciliationConflicts: (
      core.db
        .query(
          `SELECT count(*) AS n FROM execution_operations
           WHERE state = 'reconciling' AND failure_code IN ('receipt_mismatch','multiple_matches')`
        )
        .get() as { n: number }
    ).n,
  };
}
