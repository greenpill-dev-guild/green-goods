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
import { inTransaction } from "./database";
import type { ClaimedJob } from "./jobs";
import { participantWriter } from "./notify";
import { operationSubject } from "./operation-subjects";
import { type OperationRecord, operationById, setOperationState } from "./operations";
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

export async function reconcileOperation(
  deps: ReconciliationDeps,
  job: ClaimedJob
): Promise<JobOutcome> {
  const { core } = deps;
  const operation = operationById(core, job.subjectId);
  const envelope = operation?.envelope;
  if (!operation || !envelope || operation.state !== "reconciling") return { status: "done" };
  let resolution: Resolution;
  try {
    resolution = await resolve(deps, operation, envelope);
  } catch {
    return { status: "retry", errorCode: "dependency_unavailable", delayMs: 30_000 };
  }
  return inTransaction(core.db, (): JobOutcome => {
    const current = operationById(core, operation.id);
    if (!current || current.state !== "reconciling") return { status: "done" };
    switch (resolution.kind) {
      case "verified":
        publish(deps, current, envelope, resolution.verified);
        return { status: "done" };
      case "confirmed":
        announceConfirmed(core, current, envelope, resolution.transactionHash);
        return { status: "retry", errorCode: "attestation_pending", delayMs: 30_000 };
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
        return { status: "retry", errorCode: resolution.reason, delayMs: 5 * 60_000 };
      case "pending":
        return { status: "retry", errorCode: "receipt_pending", delayMs: 30_000 };
    }
  });
}
