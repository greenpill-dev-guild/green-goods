import type { PublicationEnvelope } from "@green-goods/shared/modules/agent-reporting";
import { decodeAbiParameters, type Hex, pad, parseAbiParameters, zeroHash } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import { latestAttempt, updateAttempt } from "./attempts";
import {
  ATTESTED_TOPIC,
  type Addr,
  type ReportingChain,
  type TransactionReceiptView,
  USER_OPERATION_EVENT_TOPIC,
} from "./chain";
import type { ReportingCopyKey } from "./copy";
import { inTransaction } from "./database";
import type { ClaimedJob } from "./jobs";
import { participantWriter } from "./notify";
import { operationSubject } from "./operation-subjects";
import {
  type OperationRecord,
  operationById,
  operationForSubject,
  setOperationState,
} from "./operations";
import { audit } from "./participants";
import { publicationRecords } from "./publication-records";
import type { ReportingCore } from "./runtime";
import type { JobOutcome } from "./worker";

/**
 * Independent receipt verification for reports and steward decisions. Success means a matching
 * attestation in the canonical chain: the EAS contract emitted `Attested` for the garden, the human
 * account attested (a bundler or EntryPoint sender does not count) and the attestation carries
 * exactly the frozen payload. A
 * browser hint never proves publication, and nothing here ever sends again.
 */
export interface ReconciliationDeps {
  core: ReportingCore;
  chain: ReportingChain;
  scanWindowBlocks: bigint;
}

interface Verified {
  uid: Hex;
  transactionHash: Hex;
  blockHash: Hex;
  logIndex: number;
}

/** `unread`: a log names the attestation, but the chain does not return its record yet. */
type EnvelopeMatch = "matches" | "differs" | "unread";

async function compareEnvelope(
  chain: ReportingChain,
  envelope: PublicationEnvelope,
  uid: Hex
): Promise<EnvelopeMatch> {
  const attestation = await chain.attestation(envelope.chainId, uid);
  if (attestation === null) return "unread";
  return attestation.schema.toLowerCase() === envelope.schemaUID.toLowerCase() &&
    attestation.recipient.toLowerCase() === envelope.gardenAddress.toLowerCase() &&
    attestation.attester.toLowerCase() === envelope.accountAddress.toLowerCase() &&
    attestation.expirationTime === 0n &&
    !attestation.revocable &&
    attestation.refUID === zeroHash &&
    attestation.data.toLowerCase() === envelope.encodedData.toLowerCase()
    ? "matches"
    : "differs";
}

/** `unread` when the receipt carries this account's attestation and its record is not readable. */
async function verifyReceipt(
  chain: ReportingChain,
  envelope: PublicationEnvelope,
  receipt: TransactionReceiptView
): Promise<Verified | "unread" | null> {
  let unread = false;
  for (const log of receipt.logs) {
    const [topic, recipient, attester, schema] = log.topics;
    if (
      log.address.toLowerCase() !== envelope.easAddress.toLowerCase() ||
      topic !== ATTESTED_TOPIC ||
      recipient?.toLowerCase() !== pad(envelope.gardenAddress as Addr).toLowerCase() ||
      attester?.toLowerCase() !== pad(envelope.accountAddress as Addr).toLowerCase() ||
      schema?.toLowerCase() !== envelope.schemaUID.toLowerCase()
    ) {
      continue;
    }
    const uid = log.data.slice(0, 66) as Hex;
    const match = await compareEnvelope(chain, envelope, uid);
    if (match === "matches") {
      return {
        uid,
        transactionHash: receipt.transactionHash,
        blockHash: receipt.blockHash,
        logIndex: log.logIndex,
      };
    }
    if (match === "unread") unread = true;
  }
  return unread ? "unread" : null;
}

const USER_OPERATION_EVENT_DATA = parseAbiParameters(
  "uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed"
);

/**
 * The transaction, among these, that executed the attempt's UserOperation. A UserOperation hash
 * names no transaction, and the account may have other attestations in the same range, so only
 * the EntryPoint's own event for that hash, marked successful, ties one of them to the attempt.
 */
async function userOperationTransaction(
  chain: ReportingChain,
  chainId: number,
  userOperationHash: string,
  transactionHashes: ReadonlySet<Hex>
): Promise<Hex | null> {
  for (const transactionHash of transactionHashes) {
    const receipt = await chain.transactionReceipt(chainId, transactionHash);
    const executed = receipt?.logs.some(
      (log) =>
        log.address.toLowerCase() === entryPoint07Address.toLowerCase() &&
        log.topics[0] === USER_OPERATION_EVENT_TOPIC &&
        log.topics[1]?.toLowerCase() === userOperationHash.toLowerCase() &&
        decodeAbiParameters(USER_OPERATION_EVENT_DATA, log.data)[1]
    );
    if (executed) return transactionHash;
  }
  return null;
}

type Resolution =
  | { kind: "verified"; verified: Verified }
  /** The attempt's own transaction is mined; the attestation it carries is not readable yet. */
  | { kind: "confirmed"; transactionHash: Hex }
  | { kind: "reverted" }
  | { kind: "pending" }
  | { kind: "conflict"; reason: string };

async function resolve(
  deps: ReconciliationDeps,
  operation: OperationRecord,
  envelope: PublicationEnvelope
): Promise<Resolution> {
  const { chain } = deps;
  const attempt = latestAttempt(deps.core, operation.id);
  // A UserOperation hash alone names no transaction; the range search below finds its attestation.
  const hash = (attempt?.transactionHash as Hex | null) ?? null;
  // Only a mined receipt that lacks this envelope is a conflict; a hash without a receipt may
  // still be waiting in the mempool, or replaced by a transaction the range search finds.
  let receiptMismatch = false;
  // A receipt can name an attestation that the next read does not return yet, for example when
  // the two reads reach nodes at different heights. That is a wait, not a conflict. It is
  // announced only for a transaction tied to this attempt: by its reported hash here, or below
  // by having executed its UserOperation.
  let confirmed: Hex | null = null;
  if (hash) {
    const receipt = await chain.transactionReceipt(envelope.chainId, hash);
    if (receipt?.status === "reverted") return { kind: "reverted" };
    if (receipt) {
      const verified = await verifyReceipt(chain, envelope, receipt);
      if (verified === "unread") confirmed = receipt.transactionHash;
      else if (verified) return { kind: "verified", verified };
      else receiptMismatch = true;
    }
  }
  // No usable hash, or the reported one does not carry this envelope: search the bounded range.
  const fromBlock = BigInt(operation.fromBlock ?? attempt?.fromBlock ?? 0);
  const latest = await chain.blockNumber(envelope.chainId);
  const toBlock =
    latest < fromBlock + deps.scanWindowBlocks ? latest : fromBlock + deps.scanWindowBlocks;
  const events = await chain.attestedEvents(envelope.chainId, {
    eas: envelope.easAddress as Addr,
    schemaUID: envelope.schemaUID,
    recipient: envelope.gardenAddress as Addr,
    attester: envelope.accountAddress as Addr,
    fromBlock,
    toBlock,
  });
  const matches: Verified[] = [];
  const unread = new Set<Hex>();
  for (const event of events) {
    const match = await compareEnvelope(chain, envelope, event.uid);
    if (match === "matches") {
      matches.push({
        uid: event.uid,
        transactionHash: event.transactionHash,
        blockHash: event.blockHash,
        logIndex: event.logIndex,
      });
    } else if (match === "unread") unread.add(event.transactionHash);
  }
  if (matches.length === 1) return { kind: "verified", verified: matches[0] as Verified };
  if (matches.length > 1) return { kind: "conflict", reason: "multiple_matches" };
  if (!confirmed && attempt?.userOperationHash) {
    confirmed = await userOperationTransaction(
      chain,
      envelope.chainId,
      attempt.userOperationHash,
      unread
    );
  }
  if (confirmed) return { kind: "confirmed", transactionHash: confirmed };
  return receiptMismatch ? { kind: "conflict", reason: "receipt_mismatch" } : { kind: "pending" };
}

/**
 * A delegated attempt that reached the chain spent its reservation, whether it was included or
 * reverted: budgets move from reserved to consumed and are never given back by a retry.
 */
function settleGrantBudget(core: ReportingCore, attemptId: string): void {
  const row = core.db
    .query("SELECT execution_grant_id, gas_reserved FROM execution_attempts WHERE id = $id")
    .get({ id: attemptId }) as { execution_grant_id: string | null; gas_reserved: number } | null;
  if (!row?.execution_grant_id) return;
  core.db
    .query(
      `UPDATE execution_grants SET submissions_reserved = submissions_reserved - 1, submissions_consumed = submissions_consumed + 1,
         gas_reserved = gas_reserved - $gas, gas_consumed = gas_consumed + $gas, version = version + 1
       WHERE id = $grant AND submissions_reserved > 0`
    )
    .run({ grant: row.execution_grant_id, gas: row.gas_reserved });
}

function publish(
  deps: ReconciliationDeps,
  operation: OperationRecord,
  envelope: PublicationEnvelope,
  verified: Verified
): void {
  const { core } = deps;
  const attempt = latestAttempt(core, operation.id);
  setOperationState(core, operation.id, "published", {
    failureCode: null,
    transactionHash: verified.transactionHash,
    attestationUid: verified.uid,
    blockHash: verified.blockHash,
    logIndex: verified.logIndex,
  });
  if (attempt) settleGrantBudget(core, attempt.id);
  if (attempt)
    updateAttempt(core, attempt.id, {
      state: "confirmed",
      transactionHash: verified.transactionHash,
      observedBlockHash: verified.blockHash,
      logIndex: verified.logIndex,
    });
  operationSubject(core, operation)?.recorded(verified, envelope, `published:${operation.id}`);
}

/**
 * Says once that the transaction is confirmed while its attestation is still being read. The
 * dedupe key belongs to the operation, so every later pass through this state stays silent, and
 * the verified result follows without anything more from its author.
 */
function announceConfirmed(
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

function revert(deps: ReconciliationDeps, operation: OperationRecord): void {
  const { core } = deps;
  const attempt = latestAttempt(core, operation.id);
  if (attempt) {
    settleGrantBudget(core, attempt.id);
    updateAttempt(core, attempt.id, { state: "reverted", reasonCode: "definitive_revert" });
  }
  setOperationState(core, operation.id, "failed", { failureCode: "reverted" });
  operationSubject(core, operation)?.reopen(
    "reverted",
    operation.envelope?.accountAddress ?? null,
    `reverted:${operation.id}`
  );
}

/** The audit record of a chain check that ended without finding what it looked for. */
const CHECK_STOPPED = "reconciliation_stopped";
/** The audit record of chain evidence a later check found for an attempt whose check had stopped. */
const FOUND_AFTER_STOP = "reconciliation_found_after_stop";
/** The reason a check stops with the attempt's transaction mined and its attestation unread. */
const ATTESTATION_PENDING = "attestation_pending";

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
 * A check that stops with the transaction mined and its attestation unread says that instead.
 */
function stopChecking(
  core: ReportingCore,
  operationId: string,
  reason: string,
  /** The mined transaction an unread attestation belongs to; its link goes with the notice. */
  mined?: { chainId: number; transactionHash: Hex }
): void {
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
  audit(core, CHECK_STOPPED, { kind: "operation", id: operation.id }, { reason, attemptVersion });
  const subject = operationSubject(core, operation);
  if (!subject) return;
  const unread = reason === ATTESTATION_PENDING;
  const out = participantWriter(core, {
    participantId: subject.participantId,
    conversationId: subject.conversationId,
    dedupePrefix: `${unread ? "unread" : "unconfirmed"}:${operation.id}:${attemptVersion}`,
  });
  if (!out) return;
  const key = stopReply(subject.kind, reason);
  if (!mined) return out.say(key);
  out.sayWithRecords(
    key,
    publicationRecords((copyKey) => out.text(copyKey), { ...mined, attestationUid: null })
  );
}

/**
 * How long a check of a send waits before the chat says the send is still confirming. A mined
 * report is usually found on the first or second pass; past this, the person hears that the check
 * is still going and that they can leave. The figure is the one PRD-1495 proposes for network waits.
 */
const STILL_CONFIRMING_AFTER_MS = 120_000;

/**
 * Says once per attempt, two minutes into its check, that a send is still confirming. Only a send
 * the chat has said nothing about since it went out gets this: one the browser reported as sent,
 * or one the Agent sent under a permission. A check that began with "I can't tell yet whether it
 * was sent" has already said it is checking and that it will report back. It never says the send
 * failed: nothing here knows that while the check is running.
 */
function announceStillConfirming(
  core: ReportingCore,
  operation: OperationRecord,
  job: ClaimedJob
): void {
  const attempt = latestAttempt(core, operation.id);
  if (attempt?.state !== "broadcast" || attempt.reasonCode === "callback_missing") return;
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
 * A replayed check that finds the transaction mined, or matching attestations, overrides the
 * attempt's earlier stop, so replies agree with what the chat has just said about it.
 */
function foundAfterStop(core: ReportingCore, operation: OperationRecord, evidence: string): void {
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
 * stopped, so replies say that rather than that it is being published or recorded; null while the
 * check runs or after it found its answer.
 */
export function chainCheckStopped(
  core: ReportingCore,
  subject: { draftId: string } | { reviewIntentId: string }
): ReportingCopyKey | null {
  const operation = operationForSubject(core, subject);
  if (operation?.state !== "reconciling") return null;
  const reason = attemptStopReason(core, operation);
  return reason === null ? null : stopReply("draftId" in subject ? "draft" : "review", reason);
}

export async function reconcileOperation(
  deps: ReconciliationDeps,
  job: ClaimedJob
): Promise<JobOutcome> {
  const { core } = deps;
  const operation = operationById(core, job.subjectId);
  const envelope = operation?.envelope;
  if (!operation || !envelope || operation.state !== "reconciling") return { status: "done" };
  // If a retry spends the job's last attempt, the worker parks it and the check stops there.
  const stopped = (reason: string) => () => stopChecking(core, operation.id, reason);
  let resolution: Resolution;
  try {
    resolution = await resolve(deps, operation, envelope);
  } catch {
    inTransaction(core.db, () => {
      const current = operationById(core, operation.id);
      if (current?.state === "reconciling") announceStillConfirming(core, current, job);
    });
    return {
      status: "retry",
      errorCode: "dependency_unavailable",
      delayMs: 30_000,
      onParked: stopped("dependency_unavailable"),
    };
  }
  return inTransaction(core.db, (): JobOutcome => {
    const current = operationById(core, operation.id);
    if (!current || current.state !== "reconciling") return { status: "done" };
    switch (resolution.kind) {
      case "verified":
        publish(deps, current, envelope, resolution.verified);
        return { status: "done" };
      case "confirmed": {
        // The person gets the transaction's link; only its attestation is still unread. If the
        // check runs out like this it says so, with the link, instead of the promise of more that
        // this pass would otherwise make just before stopping.
        const mined = { chainId: envelope.chainId, transactionHash: resolution.transactionHash };
        if (job.attempts < job.maxAttempts)
          announceConfirmed(core, current, envelope, resolution.transactionHash);
        foundAfterStop(core, current, "transaction_mined");
        return {
          status: "retry",
          errorCode: ATTESTATION_PENDING,
          delayMs: 30_000,
          onParked: () => stopChecking(core, operation.id, ATTESTATION_PENDING, mined),
        };
      }
      case "reverted":
        revert(deps, current);
        return { status: "done" };
      case "conflict":
        setOperationState(core, current.id, "reconciling", { failureCode: resolution.reason });
        audit(
          core,
          "reconciliation_conflict",
          { kind: "operation", id: current.id },
          { reason: resolution.reason }
        );
        if (resolution.reason === "multiple_matches")
          foundAfterStop(core, current, "multiple_matches");
        else announceStillConfirming(core, current, job);
        return {
          status: "retry",
          errorCode: resolution.reason,
          delayMs: 5 * 60_000,
          // Two matching attestations mean it was published; that one is for an operator to settle.
          ...(resolution.reason === "multiple_matches"
            ? {}
            : { onParked: stopped(resolution.reason) }),
        };
      case "pending":
        announceStillConfirming(core, current, job);
        return {
          status: "retry",
          errorCode: "receipt_pending",
          delayMs: 30_000,
          onParked: stopped("receipt_pending"),
        };
    }
  });
}
