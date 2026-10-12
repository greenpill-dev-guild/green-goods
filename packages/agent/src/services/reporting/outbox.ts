import { readControl } from "./controls";
import { inTransaction } from "./database";
import { decryptConversationChat } from "./identity-store";
import type { ReportingCore } from "./runtime";
import type { OutboundMessage, OutboundTransport } from "./transport";

/**
 * Durable reply outbox. Reply intents commit with the domain transition that produced them, and
 * only this dispatcher sends. Replies in one conversation go out in commit order; a newer prompt
 * suppresses unsent older prompts. A private notification rechecks the recipient's live binding
 * and identity epoch at send time, so relinking silences the old channel.
 */
export interface ReplyIntent {
  conversationId: string;
  subjectId: string;
  participantId: string | null;
  bindingId: string | null;
  identityEpoch: number | null;
  operationId?: string | null;
  promptId?: string | null;
  dedupeKey: string;
  replyKind: string;
  audience: "conversation" | "bound_participant";
  message: OutboundMessage;
}

function payloadContext(outboxId: string): string {
  return `delivery_outbox.payload:${outboxId}`;
}

/** Call inside the committing transaction. A repeated dedupe key returns null and sends nothing. */
export function enqueueReply(core: ReportingCore, intent: ReplyIntent): string | null {
  const id = core.ids.id();
  const now = core.clock.now();
  const inserted = core.db
    .query(
      `INSERT OR IGNORE INTO delivery_outbox
         (id, conversation_id, participant_id, channel_subject_id, channel_binding_id, identity_epoch,
          operation_id, prompt_id, provider_realm, dedupe_key, reply_kind, audience, payload_ciphertext,
          state, next_attempt_at, dispatch_seq, created_at, updated_at)
       SELECT $id, $conversation, $participant, $subject, $binding, $epoch, $operation, $prompt,
              c.provider_realm, $dedupe, $kind, $audience, $payload, 'pending', $now,
              (SELECT COALESCE(MAX(dispatch_seq), 0) + 1 FROM delivery_outbox), $now, $now
       FROM conversations c WHERE c.id = $conversation`
    )
    .run({
      id,
      conversation: intent.conversationId,
      participant: intent.participantId,
      subject: intent.subjectId,
      binding: intent.bindingId,
      epoch: intent.identityEpoch,
      operation: intent.operationId ?? null,
      prompt: intent.promptId ?? null,
      dedupe: intent.dedupeKey,
      kind: intent.replyKind,
      audience: intent.audience,
      payload: core.keyring.seal(JSON.stringify(intent.message), payloadContext(id)),
      now,
    });
  if (inserted.changes !== 1) return null;
  if (intent.promptId) {
    core.db
      .query(
        `UPDATE delivery_outbox SET state = 'suppressed', updated_at = $now
         WHERE conversation_id = $conversation AND prompt_id IS NOT NULL AND prompt_id <> $prompt
           AND state IN ('pending','retry_wait')`
      )
      .run({ conversation: intent.conversationId, prompt: intent.promptId, now });
  }
  return id;
}

export function retryDelayMs(attempt: number): number {
  return Math.min(10 * 60 * 1000, 5_000 * 2 ** Math.max(0, attempt - 1)) + ((attempt * 137) % 1000);
}

/**
 * Replies allowed without live processing consent: the notice itself, answers to consent
 * decisions, help, and outcome notices for publications already sent. Everything else waiting for
 * a participant who withdrew is suppressed at the dispatch boundary.
 */
const CONSENT_EXEMPT = new Set([
  "prompt:processing_consent",
  "consent.declined",
  "consent.stopped",
  "consent.deleted",
  "help",
  "publish.confirmed",
  "publish.published",
  "publish.unknown",
  "publish.uncertain",
  "publish.reverted",
  "review.recorded",
]);

interface OutboxRow {
  id: string;
  conversation_id: string;
  channel_subject_id: string;
  reply_kind: string;
  channel_binding_id: string | null;
  identity_epoch: number | null;
  audience: "conversation" | "bound_participant";
  payload_ciphertext: string | null;
  attempts: number;
}

function claimNext(
  core: ReportingCore,
  conversationId: string
): { row: OutboxRow; attemptId: string } | null {
  return inTransaction(core.db, () => {
    const row = core.db
      .query(
        `SELECT id, conversation_id, channel_subject_id, reply_kind, channel_binding_id, identity_epoch, audience,
                payload_ciphertext, attempts, state, next_attempt_at
         FROM delivery_outbox WHERE conversation_id = $conversation
           AND state IN ('pending','retry_wait','dispatching') ORDER BY dispatch_seq LIMIT 1`
      )
      .get({ conversation: conversationId }) as
      | (OutboxRow & { state: string; next_attempt_at: number })
      | null;
    if (!row || row.state === "dispatching" || row.next_attempt_at > core.clock.now()) return null;
    const now = core.clock.now();
    const consented = core.db
      .query(
        `SELECT 1 AS ok FROM consent_records WHERE channel_subject_id = $subject
         AND purpose = 'processing' AND withdrawn_at IS NULL`
      )
      .get({ subject: row.channel_subject_id });
    if (!consented && !CONSENT_EXEMPT.has(row.reply_kind)) {
      core.db
        .query(
          `UPDATE delivery_outbox SET state = 'suppressed', last_error_code = 'consent_withdrawn',
             updated_at = $now WHERE id = $id`
        )
        .run({ id: row.id, now });
      return claimNext(core, conversationId);
    }
    if (row.audience === "bound_participant") {
      const live = core.db
        .query(
          `SELECT 1 AS ok FROM channel_bindings b JOIN participants p ON p.id = b.participant_id
           WHERE b.id = $binding AND b.status = 'active' AND p.identity_epoch = $epoch`
        )
        .get({ binding: row.channel_binding_id, epoch: row.identity_epoch });
      if (!live) {
        core.db
          .query(
            "UPDATE delivery_outbox SET state = 'suppressed', updated_at = $now WHERE id = $id"
          )
          .run({ id: row.id, now });
        return null;
      }
    }
    const attemptId = core.ids.id();
    core.db
      .query(
        "UPDATE delivery_outbox SET state = 'dispatching', attempts = attempts + 1, updated_at = $now WHERE id = $id"
      )
      .run({ id: row.id, now });
    core.db
      .query(
        `INSERT INTO delivery_attempts (id, outbox_id, attempt_number, provider_realm, state, created_at, updated_at)
         SELECT $attempt, id, attempts, provider_realm, 'dispatching', $now, $now FROM delivery_outbox WHERE id = $id`
      )
      .run({ attempt: attemptId, id: row.id, now });
    return { row: { ...row, attempts: row.attempts + 1 }, attemptId };
  });
}

/** Sends due replies in commit order, one conversation at a time. Holds while messages are paused. */
export async function dispatchOutbox(
  core: ReportingCore,
  transport: OutboundTransport,
  limit = 50
): Promise<{ sent: number; held: boolean }> {
  if (!readControl(core, "outbound_messages").enabled) return { sent: 0, held: true };
  const conversations = core.db
    .query(
      `SELECT DISTINCT conversation_id FROM delivery_outbox
       WHERE state IN ('pending','retry_wait') AND next_attempt_at <= $now LIMIT $limit`
    )
    .all({ now: core.clock.now(), limit }) as Array<{ conversation_id: string }>;
  let sent = 0;
  for (const { conversation_id: conversationId } of conversations) {
    for (;;) {
      const claim = claimNext(core, conversationId);
      if (!claim) break;
      const chat = decryptConversationChat(core, conversationId);
      const message = claim.row.payload_ciphertext
        ? (JSON.parse(
            core.keyring.open(claim.row.payload_ciphertext, payloadContext(claim.row.id))
          ) as OutboundMessage)
        : null;
      const result =
        chat && message
          ? await transport
              .send({
                providerRealm: chat.providerRealm,
                externalChatId: chat.chatId,
                ...(chat.threadId ? { threadId: chat.threadId } : {}),
                message,
                idempotencyKey: claim.row.id,
              })
              .catch((error: unknown) => ({
                status: "uncertain" as const,
                errorCode: errorCodeOf(error),
              }))
          : ({ status: "terminal" as const, errorCode: "recipient_unavailable" } as const);
      recordSendResult(core, claim.row, claim.attemptId, result);
      if (result.status !== "accepted") break;
      sent += 1;
    }
  }
  return { sent, held: false };
}

function errorCodeOf(error: unknown): string {
  return error instanceof Error && error.name ? error.name.slice(0, 64) : "send_failed";
}

function recordSendResult(
  core: ReportingCore,
  row: OutboxRow,
  attemptId: string,
  result: Awaited<ReturnType<OutboundTransport["send"]>>
): void {
  inTransaction(core.db, () => {
    const now = core.clock.now();
    if (result.status === "accepted") {
      core.db
        .query(
          "UPDATE delivery_attempts SET state = 'accepted', provider_message_id = $message, updated_at = $now WHERE id = $id"
        )
        .run({ id: attemptId, message: result.providerMessageId, now });
      core.db
        .query(
          "UPDATE delivery_outbox SET state = 'accepted', last_error_code = NULL, updated_at = $now WHERE id = $id"
        )
        .run({ id: row.id, now });
      return;
    }
    const exhausted = row.attempts >= core.settings.maxOutboxAttempts;
    const terminal = result.status === "terminal" || exhausted;
    core.db
      .query(
        "UPDATE delivery_attempts SET state = $state, error_code = $code, updated_at = $now WHERE id = $id"
      )
      .run({
        id: attemptId,
        state: result.status === "uncertain" ? "uncertain" : "failed",
        code: result.errorCode,
        now,
      });
    const delay =
      result.status === "retryable" && result.retryAfterMs
        ? result.retryAfterMs
        : retryDelayMs(row.attempts);
    endOrRetry(core, row.id, { terminal, code: result.errorCode, next: now + delay, now });
  });
}

/** A failed delivery waits for its next attempt, or ends once it is terminal or exhausted. */
export function endOrRetry(
  core: ReportingCore,
  outboxId: string,
  input: { terminal: boolean; code: string; next: number; now: number }
): void {
  core.db
    .query(
      `UPDATE delivery_outbox SET state = $state, last_error_code = $code, next_attempt_at = $next, updated_at = $now
       WHERE id = $id`
    )
    .run({
      id: outboxId,
      state: input.terminal ? "terminal_failed" : "retry_wait",
      code: input.code,
      next: input.next,
      now: input.now,
    });
}

/** A crash between claim and result leaves `dispatching`; treat it as uncertain and retry later. */
export function recoverStalledDispatches(core: ReportingCore, olderThanMs: number): number {
  const cutoff = core.clock.now() - olderThanMs;
  return core.db
    .query(
      `UPDATE delivery_outbox SET state = 'retry_wait', last_error_code = 'dispatch_interrupted', next_attempt_at = $now
       WHERE state = 'dispatching' AND updated_at < $cutoff`
    )
    .run({ cutoff, now: core.clock.now() }).changes;
}
