import { inTransaction } from "./database";
import { endOrRetry, retryDelayMs } from "./outbox";
import type { ReportingCore } from "./runtime";
import type { InboundStatusEvent } from "./transport";

const STATUS_RANK: Record<string, number> = {
  dispatching: 0,
  accepted: 1,
  sent: 2,
  delivered: 3,
  read: 4,
};

/**
 * Applies a provider status to the attempt that produced it. Delivery evidence is monotonic, and a
 * late status for an earlier attempt never overwrites the outcome of a later one.
 */
export function applyDeliveryStatus(
  core: ReportingCore,
  event: InboundStatusEvent
): "applied" | "stale" | "unknown" {
  return inTransaction(core.db, () => {
    const attempt = core.db
      .query(
        `SELECT a.id, a.state, a.attempt_number, a.outbox_id, o.attempts, o.state AS outbox_state
         FROM delivery_attempts a JOIN delivery_outbox o ON o.id = a.outbox_id
         WHERE a.provider_realm = $realm AND a.provider_message_id = $message`
      )
      .get({ realm: event.providerRealm, message: event.providerMessageId }) as {
      id: string;
      state: string;
      attempt_number: number;
      outbox_id: string;
      attempts: number;
      outbox_state: string;
    } | null;
    if (!attempt) return "unknown";
    const now = core.clock.now();
    const latest = attempt.attempt_number === attempt.attempts;
    if (event.status === "failed") {
      if ((STATUS_RANK[attempt.state] ?? -1) >= STATUS_RANK.delivered) return "stale";
      core.db
        .query(
          "UPDATE delivery_attempts SET state = 'failed', error_code = $code, updated_at = $now WHERE id = $id"
        )
        .run({ id: attempt.id, code: event.errorCode ?? "provider_failed", now });
      if (!latest) return "stale";
      endOrRetry(core, attempt.outbox_id, {
        terminal: attempt.attempts >= core.settings.maxOutboxAttempts,
        code: event.errorCode ?? "provider_failed",
        next: now + retryDelayMs(attempt.attempts),
        now,
      });
      return "applied";
    }
    if ((STATUS_RANK[event.status] ?? 0) <= (STATUS_RANK[attempt.state] ?? 0)) return "stale";
    core.db
      .query("UPDATE delivery_attempts SET state = $state, updated_at = $now WHERE id = $id")
      .run({ id: attempt.id, state: event.status, now });
    if (latest && (STATUS_RANK[event.status] ?? 0) > (STATUS_RANK[attempt.outbox_state] ?? 0)) {
      core.db
        .query("UPDATE delivery_outbox SET state = $state, updated_at = $now WHERE id = $id")
        .run({ id: attempt.outbox_id, state: event.status, now });
    }
    return latest ? "applied" : "stale";
  });
}
