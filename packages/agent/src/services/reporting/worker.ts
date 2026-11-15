import { createLogger } from "../logger";
import { captureAgentException } from "../sentry";
import { type CoordinatorDeps, processConversation } from "./coordinator/turn";
import { inTransaction } from "./database";
import { conversationsWithWork, consumeInboxEvent, readInboxPayload } from "./inbox";
import { type ClaimedJob, claimJob, completeJob, type JobKind, retryJob } from "./jobs";
import { applyDeliveryStatus } from "./delivery-status";
import { dispatchOutbox, recoverStalledDispatches } from "./outbox";
import type { InboundStatusEvent, OutboundTransport } from "./transport";

const log = createLogger("reporting");

/**
 * One pass over every durable queue: provider statuses, conversation turns, background jobs and
 * the outbox. Tests call `drain` for deterministic schedules; the process runtime calls `tick`
 * on an interval. Statuses, outcomes and reconciliation run under every operating pause.
 *
 * Once `stopping` is aborted, a pass finishes the turn, job or send in hand and claims nothing
 * else, so a shutdown waits for one unit instead of a whole pass. Work left unclaimed stays
 * pending and the next process takes it up; nothing is interrupted part way.
 */
export type JobOutcome =
  | { status: "done" }
  | { status: "retry"; errorCode: string; delayMs: number };
export type JobHandler = (job: ClaimedJob) => Promise<JobOutcome>;

export interface ReportingWorkerDeps extends CoordinatorDeps {
  transport: OutboundTransport;
  jobs: Partial<Record<JobKind, JobHandler>>;
  workerId: string;
}

export interface TickSummary {
  statuses: number;
  turns: number;
  jobs: number;
  sent: number;
}

function applyPendingStatuses(deps: ReportingWorkerDeps): number {
  const { core } = deps;
  const rows = core.db
    .query(
      `SELECT id, payload_ciphertext FROM inbox_events
       WHERE kind = 'delivery_status' AND state = 'pending' ORDER BY arrival_seq LIMIT 100`
    )
    .all() as Array<{ id: string; payload_ciphertext: string | null }>;
  for (const row of rows) {
    const status = readInboxPayload<InboundStatusEvent>(core, row);
    inTransaction(core.db, () => {
      if (status) applyDeliveryStatus(core, status);
      consumeInboxEvent(core, row.id);
    });
  }
  return rows.length;
}

async function runJobs(deps: ReportingWorkerDeps, limit: number): Promise<number> {
  const kinds = Object.keys(deps.jobs) as JobKind[];
  let ran = 0;
  while (ran < limit && !deps.stopping?.aborted) {
    const job = claimJob(deps.core, deps.workerId, kinds);
    if (!job) break;
    ran += 1;
    const handler = deps.jobs[job.kind];
    let outcome: JobOutcome;
    try {
      outcome = handler
        ? await handler(job)
        : { status: "retry", errorCode: "no_handler", delayMs: 60_000 };
    } catch (error) {
      outcome = {
        status: "retry",
        errorCode: error instanceof Error ? error.name : "job_failed",
        delayMs: 30_000,
      };
    }
    if (outcome.status === "done") {
      inTransaction(deps.core.db, () => completeJob(deps.core, job));
    } else {
      const { errorCode, delayMs } = outcome;
      const result = inTransaction(deps.core.db, () =>
        retryJob(deps.core, job, errorCode, delayMs)
      );
      recordRetry(job, errorCode, delayMs, result);
    }
  }
  return ran;
}

/**
 * Every retry leaves a warning, and a job that spends its last attempt leaves an error and an
 * error event, so no job uses up its attempts without a trace. Only the kind, the error code and
 * the attempt count are recorded: a handler's error message can carry addresses, hashes or links.
 * A fenced result belongs to the worker that took the job over, which records its own.
 */
function recordRetry(
  job: ClaimedJob,
  errorCode: string,
  delayMs: number,
  result: ReturnType<typeof retryJob>
): void {
  const fields = {
    kind: job.kind,
    errorCode,
    attempt: job.attempts,
    maxAttempts: job.maxAttempts,
  };
  if (result === "retrying") {
    log.warn({ ...fields, retryInMs: delayMs }, "Reporting job will try again");
  } else if (result === "failed") {
    log.error(fields, "Reporting job ran out of attempts");
    captureAgentException(new Error("Reporting job ran out of attempts"), {
      source: "reporting.worker",
      surface: "reporting",
      metadata: fields,
    });
  }
}

/** An unreachable indexer must not stop the queues: turns keep using the last garden list. */
async function refreshGardens(core: ReportingWorkerDeps["core"]): Promise<void> {
  try {
    await core.gardens.refresh(core.clock.now());
  } catch (err) {
    log.warn({ err }, "Could not refresh the garden list; keeping the last one");
  }
}

export async function tick(deps: ReportingWorkerDeps): Promise<TickSummary> {
  const summary: TickSummary = { statuses: 0, turns: 0, jobs: 0, sent: 0 };
  // Checked before every phase, since a stop can arrive during any await before it.
  const stopped = () => deps.stopping?.aborted === true;
  if (stopped()) return summary;
  await refreshGardens(deps.core);
  if (stopped()) return summary;
  summary.statuses = applyPendingStatuses(deps);
  for (const conversationId of conversationsWithWork(deps.core)) {
    if (stopped()) return summary;
    summary.turns += await processConversation(deps, conversationId, deps.workerId);
  }
  summary.jobs = await runJobs(deps, 25);
  if (stopped()) return summary;
  inTransaction(deps.core.db, () => recoverStalledDispatches(deps.core, 5 * 60 * 1000));
  summary.sent = (await dispatchOutbox(deps.core, deps.transport, 50, deps.stopping)).sent;
  return summary;
}

/** Runs ticks until a full pass does no work, bounded so a livelock fails loudly in tests. */
export async function drain(deps: ReportingWorkerDeps, maxPasses = 50): Promise<TickSummary> {
  const total: TickSummary = { statuses: 0, turns: 0, jobs: 0, sent: 0 };
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const summary = await tick(deps);
    total.statuses += summary.statuses;
    total.turns += summary.turns;
    total.jobs += summary.jobs;
    total.sent += summary.sent;
    if (summary.statuses + summary.turns + summary.jobs + summary.sent === 0) return total;
  }
  throw new Error("Reporting queues did not settle");
}
