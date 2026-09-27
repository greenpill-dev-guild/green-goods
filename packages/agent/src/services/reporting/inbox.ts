import { activeConsentId } from "./consent";
import { inTransaction } from "./database";
import { resolveChannelSubject, resolveConversation } from "./identity-store";
import type { ReportingCore } from "./runtime";
import type { InboundMessageEvent, NormalizedInboundEvent } from "./transport";

/**
 * Durable inbound intake. One IMMEDIATE transaction deduplicates on (realm, event ID), resolves
 * the stable sender and conversation, and stores the sealed event. Adapters acknowledge the
 * provider only after this returns, so a storage failure is never acknowledged as success.
 *
 * A sender without processing consent is stored quarantined: only the consent exchange reads it,
 * and it expires with the pre-consent window if consent never arrives.
 */
export type IntakeResult =
  | { status: "accepted"; inboxEventId: string; conversationId: string | null }
  | { status: "duplicate"; inboxEventId: string };

export interface InboxEventRow {
  id: string;
  provider_realm: string;
  kind: "message" | "delivery_status";
  conversation_id: string | null;
  channel_subject_id: string | null;
  payload_ciphertext: string | null;
  state: "pending" | "quarantined" | "consumed" | "dead" | "expired";
  attempts: number;
  arrival_seq: number;
  received_at: number;
}

export function payloadContext(inboxEventId: string): string {
  return `inbox_events.payload:${inboxEventId}`;
}

export function acceptInboundEvent(
  core: ReportingCore,
  event: NormalizedInboundEvent
): IntakeResult {
  return inTransaction(core.db, () => {
    const existing = core.db
      .query("SELECT id FROM inbox_events WHERE provider_realm = $realm AND event_id = $event")
      .get({ realm: event.providerRealm, event: event.eventId }) as { id: string } | null;
    if (existing) return { status: "duplicate" as const, inboxEventId: existing.id };

    const now = core.clock.now();
    const id = core.ids.id();
    let conversationId: string | null = null;
    let subjectId: string | null = null;
    let state: InboxEventRow["state"] = "pending";
    let expiresAt: number | null = null;

    if (event.kind === "message") {
      const provisionalExpiry = now + core.settings.preConsentRetentionMs;
      subjectId = resolveChannelSubject(
        core,
        event.providerRealm,
        event.sender.externalSubjectId,
        provisionalExpiry
      ).id;
      conversationId = resolveConversation(
        core,
        event.providerRealm,
        event.chat,
        provisionalExpiry
      ).id;
      if (!activeConsentId(core, subjectId, "processing")) {
        state = "quarantined";
        expiresAt = provisionalExpiry;
      }
    }

    core.db
      .query(
        `INSERT INTO inbox_events
           (id, provider_realm, event_id, kind, arrival_seq, conversation_id, channel_subject_id,
            payload_ciphertext, state, received_at, expires_at)
         VALUES ($id, $realm, $event, $kind,
           (SELECT COALESCE(MAX(arrival_seq), 0) + 1 FROM inbox_events),
           $conversation, $subject, $payload, $state, $now, $expires)`
      )
      .run({
        id,
        realm: event.providerRealm,
        event: event.eventId,
        kind: event.kind,
        conversation: conversationId,
        subject: subjectId,
        payload: core.keyring.seal(JSON.stringify(event), payloadContext(id)),
        state,
        now,
        expires: expiresAt,
      });
    return { status: "accepted" as const, inboxEventId: id, conversationId };
  });
}

export function readInboxPayload<T extends NormalizedInboundEvent = InboundMessageEvent>(
  core: ReportingCore,
  row: Pick<InboxEventRow, "id" | "payload_ciphertext">
): T | null {
  return row.payload_ciphertext
    ? (JSON.parse(core.keyring.open(row.payload_ciphertext, payloadContext(row.id))) as T)
    : null;
}

/**
 * A conversation is ordered by arrival: its earliest pending event blocks later ones until due,
 * so a deferred message is never overtaken by a later correction. Events held for consent are the
 * exception; they wait aside so the consent answer itself can be read.
 */
const CANDIDATE_EVENTS = `
  kind = 'message' AND (state = 'pending' OR (state = 'quarantined' AND next_attempt_at <= $now))`;

/** Conversations whose next event is due, oldest arrival first. */
export function conversationsWithWork(core: ReportingCore, limit = 20): string[] {
  const rows = core.db
    .query(
      `SELECT conversation_id, MIN(arrival_seq) AS first FROM inbox_events
       WHERE conversation_id IS NOT NULL AND ${CANDIDATE_EVENTS}
       GROUP BY conversation_id ORDER BY first LIMIT $limit`
    )
    .all({ now: core.clock.now(), limit: limit * 4 }) as Array<{ conversation_id: string }>;
  return rows
    .map((row) => row.conversation_id)
    .filter((conversationId) => nextConversationEvent(core, conversationId) !== null)
    .slice(0, limit);
}

/** The next event a conversation must handle, or null while its earliest event is not yet due. */
export function nextConversationEvent(
  core: ReportingCore,
  conversationId: string
): InboxEventRow | null {
  const row = core.db
    .query(
      `SELECT id, provider_realm, kind, conversation_id, channel_subject_id, payload_ciphertext, state,
              attempts, arrival_seq, received_at, next_attempt_at
       FROM inbox_events
       WHERE conversation_id = $conversation AND ${CANDIDATE_EVENTS}
       ORDER BY arrival_seq LIMIT 1`
    )
    .get({ conversation: conversationId, now: core.clock.now() }) as
    | (InboxEventRow & { next_attempt_at: number })
    | null;
  return row && row.next_attempt_at <= core.clock.now() ? row : null;
}

export function consumeInboxEvent(core: ReportingCore, inboxEventId: string): void {
  core.db
    .query(
      "UPDATE inbox_events SET state = 'consumed', consumed_at = $now, last_error_code = NULL WHERE id = $id"
    )
    .run({ id: inboxEventId, now: core.clock.now() });
}

/** Records a failed turn; after the attempt budget the event is parked for an operator, not lost. */
export function deferInboxEvent(
  core: ReportingCore,
  inboxEventId: string,
  errorCode: string,
  delayMs: number
): void {
  core.db
    .query(
      `UPDATE inbox_events
       SET attempts = attempts + 1, last_error_code = $code, next_attempt_at = $next,
           state = CASE WHEN attempts + 1 >= $max THEN 'dead' ELSE state END
       WHERE id = $id`
    )
    .run({
      id: inboxEventId,
      code: errorCode,
      next: core.clock.now() + delayMs,
      max: core.settings.maxEventAttempts,
    });
}

/** Releases a subject's quarantined events once processing consent exists. */
export function releaseQuarantine(core: ReportingCore, subjectId: string): number {
  return core.db
    .query(
      `UPDATE inbox_events SET state = 'pending', expires_at = NULL, next_attempt_at = 0
       WHERE channel_subject_id = $subject AND state = 'quarantined'`
    )
    .run({ subject: subjectId }).changes;
}
