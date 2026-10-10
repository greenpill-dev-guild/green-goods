import { createLogger } from "../logger";
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
  while (ran < limit) {
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
    inTransaction(deps.core.db, () => {
      if (outcome.status === "done") completeJob(deps.core, job);
      else retryJob(deps.core, job, outcome.errorCode, outcome.delayMs);
    });
  }
  return ran;
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
  await refreshGardens(deps.core);
  const statuses = applyPendingStatuses(deps);
  let turns = 0;
  for (const conversationId of conversationsWithWork(deps.core)) {
    turns += await processConversation(deps, conversationId, deps.workerId);
  }
  const jobs = await runJobs(deps, 25);
  inTransaction(deps.core.db, () => recoverStalledDispatches(deps.core, 5 * 60 * 1000));
  const { sent } = await dispatchOutbox(deps.core, deps.transport);
  return { statuses, turns, jobs, sent };
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
