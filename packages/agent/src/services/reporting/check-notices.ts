import type { PublicationEnvelope } from "@green-goods/shared/modules/agent-reporting";
import type { Hex } from "viem";
import { type AttemptRecord, latestAttempt } from "./attempts";
import type { ReportingCopyKey } from "./copy";
import type { ClaimedJob } from "./jobs";
import { participantWriter } from "./notify";
import { operationSubject } from "./operation-subjects";
import { type OperationRecord, operationById, operationForSubject } from "./operations";
import { audit } from "./participants";
import { publicationRecords } from "./publication-records";
import type { ReportingCore } from "./runtime";

/**
 * What the chat hears about a chain check while it runs and when it ends: the transaction is
 * confirmed, the send is still confirming, or the check stopped, and what replies say afterwards.
 * The check itself, which reads the chain and decides, lives in reconciliation.ts.
 */

/**
 * Says once that the transaction is confirmed while its attestation is still being read. The
 * dedupe key belongs to the operation, so every later pass through this state stays silent, and
 * the verified result follows without anything more from its author.
 */
export function announceConfirmed(
  core: ReportingCore,
  operation: OperationRecord,
  envelope: PublicationEnvelope,
  transactionHash: Hex
): void {
  const subject = operationSubject(core, operation);
  if (!subject) return;
  const out = participantWriter(core, {
    participantId: subject.participantId,
    conversationId: subject.conversationId,
    dedupePrefix: `confirmed:${operation.id}`,
  });
  out?.sayWithRecords(
    "publish.confirmed",
    publicationRecords((key) => out.text(key), {
      chainId: envelope.chainId,
      transactionHash,
      attestationUid: null,
    })
  );
}

/** The audit record of a chain check that ended without finding what it looked for. */
const CHECK_STOPPED = "reconciliation_stopped";
/** The audit record of chain evidence a later check found for an attempt whose check had stopped. */
const FOUND_AFTER_STOP = "reconciliation_found_after_stop";
/** The reason a check stops with the attempt's transaction mined and its attestation unread. */
export const ATTESTATION_PENDING = "attestation_pending";
/** The audit record of the attempt's transaction seen mined, which a later empty read can't undo. */
const TRANSACTION_MINED = "reconciliation_transaction_mined";

/** The attempt's transaction a pass has seen mined, if any. */
function minedTransaction(core: ReportingCore, operation: OperationRecord): Hex | null {
  const row = core.db
    .query(
      `SELECT json_extract(detail_json, '$.transactionHash') AS hash FROM audit_events
       WHERE subject_kind = 'operation' AND subject_id = $id AND kind = $mined
         AND json_extract(detail_json, '$.attemptVersion') = $attemptVersion
       ORDER BY created_at, rowid LIMIT 1`
    )
    .get({
      id: operation.id,
      mined: TRANSACTION_MINED,
      attemptVersion: operation.attemptVersion,
    }) as { hash: Hex | null } | null;
  return row?.hash ?? null;
}

/**
 * Records once per attempt that a pass saw its transaction mined. The chat has said so by then, so
 * however a later pass reads the chain, the check never ends by saying it can't find the report.
 */
export function recordMined(
  core: ReportingCore,
  operation: OperationRecord,
  transactionHash: Hex
): void {
  if (minedTransaction(core, operation)) return;
  const { attemptVersion } = operation;
  audit(
    core,
    TRANSACTION_MINED,
    { kind: "operation", id: operation.id },
    { transactionHash, attemptVersion }
  );
}

/**
 * What the chat says about a stopped check: that the report or decision was not found, or that its
 * transaction is mined while its attestation stayed unread. The second must never read as "not
 * found": the person already has the transaction's link.
 */
const STOP_REPLY = {
  draft: { notFound: "publish.unconfirmed", unread: "publish.attestationUnread" },
  review: { notFound: "review.unconfirmed", unread: "review.attestationUnread" },
} as const satisfies Record<"draft" | "review", Record<"notFound" | "unread", ReportingCopyKey>>;

/** The reason the latest record for the operation's current attempt gives for stopping, if any. */
function attemptStopReason(core: ReportingCore, operation: OperationRecord): string | null {
  const latest = core.db
    .query(
      `SELECT kind, json_extract(detail_json, '$.reason') AS reason FROM audit_events
       WHERE subject_kind = 'operation' AND subject_id = $id AND kind IN ($stopped, $found)
         AND json_extract(detail_json, '$.attemptVersion') = $attemptVersion
       ORDER BY created_at DESC, rowid DESC LIMIT 1`
    )
    .get({
      id: operation.id,
      stopped: CHECK_STOPPED,
      found: FOUND_AFTER_STOP,
      attemptVersion: operation.attemptVersion,
    }) as { kind: string; reason: string | null } | null;
  return latest?.kind === CHECK_STOPPED ? (latest.reason ?? "") : null;
}

function stopReply(kind: "draft" | "review", reason: string): ReportingCopyKey {
  return STOP_REPLY[kind][reason === ATTESTATION_PENDING ? "unread" : "notFound"];
}

/**
 * The check's last attempt found nothing it can stand behind. Nothing is sent again and the
 * reservation stays, so an operator replay can still find a late publication; what changes is that
 * the person hears it ended, once, instead of waiting on a promise that nothing will keep. It runs
 * as the worker parks the job. The record and the notice belong to the operation's current
 * attempt: an operation is reused for its next attempt, which gets a check and a notice of its own.
 * Once any pass saw the transaction mined, the check stops as one whose attestation stayed unread,
 * with the transaction's link, whatever its last pass read.
 */
export function stopChecking(core: ReportingCore, operationId: string, reason: string): void {
  const operation = operationById(core, operationId);
  if (operation?.state !== "reconciling") return;
  // A late wallet report starts a second check beside the first: the last one to run out speaks.
  const stillChecking = core.db
    .query(
      `SELECT 1 FROM processing_jobs WHERE kind = 'reconcile_operation' AND subject_id = $id
         AND state IN ('pending', 'leased') LIMIT 1`
    )
    .get({ id: operation.id });
  if (stillChecking) return;
  const { attemptVersion } = operation;
  const mined = minedTransaction(core, operation);
  const stopped = mined ? ATTESTATION_PENDING : reason;
  audit(
    core,
    CHECK_STOPPED,
    { kind: "operation", id: operation.id },
    { reason: stopped, lastError: reason, attemptVersion }
  );
  const subject = operationSubject(core, operation);
  if (!subject) return;
  const out = participantWriter(core, {
    participantId: subject.participantId,
    conversationId: subject.conversationId,
    dedupePrefix: `${mined ? "unread" : "unconfirmed"}:${operation.id}:${attemptVersion}`,
  });
  if (!out) return;
  const key = stopReply(subject.kind, stopped);
  if (!mined) return out.say(key);
  out.sayWithRecords(
    key,
    publicationRecords((copyKey) => out.text(copyKey), {
      chainId: operation.chainId,
      transactionHash: mined,
      attestationUid: null,
    })
  );
}

/**
 * How long a check of a send waits before the chat says the send is still confirming. A mined
 * report is usually found on the first or second pass; past this, the person hears that the check
 * is still going and that they can leave. The figure is the one PRD-1495 proposes for network waits.
 */
const STILL_CONFIRMING_AFTER_MS = 120_000;

/**
 * Whether the chat has said nothing about this attempt since it went out: one the browser reported
 * as sent, or one the Agent sent under a permission, whether or not the bundler accepted it. A
 * bundler that refuses an operation does not prove it never reached the chain, so the check runs
 * either way. A browser that reported an uncertain send, or never reported at all, has already
 * heard that the chain is being checked and that it will hear back.
 */
function sentSilently(attempt: AttemptRecord | null): boolean {
  // A late hash moves a callback-missing attempt to broadcast and keeps its reason.
  if (!attempt || attempt.reasonCode === "callback_missing") return false;
  if (attempt.state === "broadcast") return true;
  return attempt.state === "uncertain" && attempt.mode === "delegated";
}

/**
 * Says once per attempt, two minutes into its check, that a send is still confirming, if the chat
 * has said nothing about it since it went out. It never says the send failed: nothing here knows
 * that while the check is running.
 */
export function announceStillConfirming(
  core: ReportingCore,
  operation: OperationRecord,
  job: ClaimedJob
): void {
  // On the check's last pass the stop speaks instead; both at once would contradict each other.
  if (job.attempts >= job.maxAttempts) return;
  if (!sentSilently(latestAttempt(core, operation.id))) return;
  // Once the chat has said the transaction is confirmed, "still being confirmed" would undercut it.
  if (minedTransaction(core, operation)) return;
  const started = core.db
    .query("SELECT created_at FROM processing_jobs WHERE id = $id")
    .get({ id: job.id }) as { created_at: number } | null;
  if (!started || core.clock.now() - started.created_at < STILL_CONFIRMING_AFTER_MS) return;
  const subject = operationSubject(core, operation);
  if (!subject) return;
  participantWriter(core, {
    participantId: subject.participantId,
    conversationId: subject.conversationId,
    dedupePrefix: `confirming:${operation.id}:${operation.attemptVersion}`,
  })?.say(subject.kind === "review" ? "review.stillConfirming" : "publish.stillConfirming");
}

/**
 * Two attestations match the frozen payload, so the report or decision is on chain, and an
 * operator settles which one stands. The chat hears that once per operation, in place of the
 * link it would otherwise get, so its author is not left waiting on a check that stays parked.
 */
export function announcePublishedChecking(core: ReportingCore, operation: OperationRecord): void {
  const subject = operationSubject(core, operation);
  if (!subject) return;
  participantWriter(core, {
    participantId: subject.participantId,
    conversationId: subject.conversationId,
    dedupePrefix: `matches:${operation.id}`,
  })?.say(subject.kind === "review" ? "review.recordedChecking" : "publish.publishedChecking");
}

/**
 * A replayed check that finds the transaction mined, or matching attestations, overrides the
 * attempt's earlier stop, so replies agree with what the chat has just said about it.
 */
export function foundAfterStop(
  core: ReportingCore,
  operation: OperationRecord,
  evidence: string
): void {
  if (attemptStopReason(core, operation) === null) return;
  const { attemptVersion } = operation;
  audit(
    core,
    FOUND_AFTER_STOP,
    { kind: "operation", id: operation.id },
    { evidence, attemptVersion }
  );
}

/**
 * What to answer once the chain check for the current attempt at a report or a decision has
 * stopped, or found it twice and waits on an operator, so replies say that rather than that it is
 * being published or recorded; null while the check runs or after it found its answer.
 */
export function chainCheckStopped(
  core: ReportingCore,
  subject: { draftId: string } | { reviewIntentId: string }
): ReportingCopyKey | null {
  const operation = operationForSubject(core, subject);
  if (operation?.state !== "reconciling") return null;
  // Two matching attestations: it is on chain, and the check waits on an operator, not the chain.
  if (operation.failureCode === "multiple_matches")
    return "draftId" in subject ? "publish.publishedChecking" : "review.recordedChecking";
  const reason = attemptStopReason(core, operation);
  return reason === null ? null : stopReply("draftId" in subject ? "draft" : "review", reason);
}
