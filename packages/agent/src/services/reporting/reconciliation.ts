import type { PublicationEnvelope } from "@green-goods/shared/modules/agent-reporting";
import { type Hex, pad, zeroHash } from "viem";
import { latestAttempt, updateAttempt } from "./attempts";
import {
  ATTESTED_TOPIC,
  type Addr,
  type ReportingChain,
  type TransactionReceiptView,
} from "./chain";
import { invalidateConfirmation } from "./confirmations";
import { commitLifecycle } from "./coordinator/draft-commit";
import { askConfirmation } from "./coordinator/prompting";
import { inTransaction } from "./database";
import { loadDraft } from "./drafts";
import { enqueueJob, type ClaimedJob } from "./jobs";
import { participantWriter } from "./notify";
import { type OperationRecord, operationById, setOperationState } from "./operations";
import { audit } from "./participants";
import type { ReportingCore } from "./runtime";
import type { JobOutcome } from "./worker";

/**
 * Independent receipt verification. Success means a matching attestation in the canonical chain:
 * the EAS contract emitted `Attested` for the garden, the human account attested (a bundler or
 * EntryPoint sender does not count) and the attestation carries exactly the frozen payload. A
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

async function matchesEnvelope(
  chain: ReportingChain,
  envelope: PublicationEnvelope,
  uid: Hex
): Promise<boolean> {
  const attestation = await chain.attestation(envelope.chainId, uid);
  return (
    attestation !== null &&
    attestation.schema.toLowerCase() === envelope.schemaUID.toLowerCase() &&
    attestation.recipient.toLowerCase() === envelope.gardenAddress.toLowerCase() &&
    attestation.attester.toLowerCase() === envelope.accountAddress.toLowerCase() &&
    attestation.expirationTime === 0n &&
    !attestation.revocable &&
    attestation.refUID === zeroHash &&
    attestation.data.toLowerCase() === envelope.encodedData.toLowerCase()
  );
}

async function verifyReceipt(
  chain: ReportingChain,
  envelope: PublicationEnvelope,
  receipt: TransactionReceiptView
): Promise<Verified | null> {
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
    if (await matchesEnvelope(chain, envelope, uid)) {
      return {
        uid,
        transactionHash: receipt.transactionHash,
        blockHash: receipt.blockHash,
        logIndex: log.logIndex,
      };
    }
  }
  return null;
}

type Resolution =
  | { kind: "verified"; verified: Verified }
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
  let hash = (attempt?.transactionHash as Hex | null) ?? null;
  if (!hash && attempt?.userOperationHash)
    hash = await chain.userOperationTransaction(envelope.chainId, attempt.userOperationHash as Hex);
  if (hash) {
    const receipt = await chain.transactionReceipt(envelope.chainId, hash);
    if (receipt?.status === "reverted") return { kind: "reverted" };
    if (receipt) {
      const verified = await verifyReceipt(chain, envelope, receipt);
      if (verified) return { kind: "verified", verified };
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
  for (const event of events) {
    if (await matchesEnvelope(chain, envelope, event.uid)) {
      matches.push({
        uid: event.uid,
        transactionHash: event.transactionHash,
        blockHash: event.blockHash,
        logIndex: event.logIndex,
      });
    }
  }
  if (matches.length === 1) return { kind: "verified", verified: matches[0] as Verified };
  if (matches.length > 1) return { kind: "conflict", reason: "multiple_matches" };
  return hash ? { kind: "conflict", reason: "receipt_mismatch" } : { kind: "pending" };
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
  if (attempt)
    updateAttempt(core, attempt.id, {
      state: "confirmed",
      transactionHash: verified.transactionHash,
      observedBlockHash: verified.blockHash,
      logIndex: verified.logIndex,
    });
  const draft = operation.draftId ? loadDraft(core, operation.draftId) : null;
  if (operation.kind !== "work" || !draft || envelope.kind !== "work") return;
  core.db
    .query(
      `INSERT OR IGNORE INTO work_records
         (chain_id, work_uid, draft_id, garden_address, action_uid, attester, transaction_hash, published_revision, observed_at)
       VALUES ($chain, $uid, $draft, $garden, $action, $attester, $tx, $revision, $now)`
    )
    .run({
      chain: envelope.chainId,
      uid: verified.uid,
      draft: draft.id,
      garden: envelope.gardenAddress,
      action: envelope.fields.actionUID,
      attester: envelope.accountAddress,
      tx: verified.transactionHash,
      revision: envelope.revision,
      now: core.clock.now(),
    });
  commitLifecycle(core, draft, [{ type: "RECEIPT_VERIFIED" }], { participantAction: false });
  participantWriter(core, {
    participantId: draft.participantId,
    conversationId: draft.conversationId,
    dedupePrefix: `published:${operation.id}`,
  })?.say("publish.published", { uid: verified.uid, tx: verified.transactionHash });
  enqueueJob(core, {
    kind: "purge_private_content",
    subjectId: draft.id,
    dedupeKey: `purge:published:${draft.id}`,
    payload: { scope: "draft" },
  });
}

function revert(deps: ReconciliationDeps, operation: OperationRecord): void {
  const { core } = deps;
  const attempt = latestAttempt(core, operation.id);
  if (attempt)
    updateAttempt(core, attempt.id, { state: "reverted", reasonCode: "definitive_revert" });
  setOperationState(core, operation.id, "failed", { failureCode: "reverted" });
  const draft = operation.draftId ? loadDraft(core, operation.draftId) : null;
  if (!draft) return;
  const { draft: reviewed } = commitLifecycle(core, draft, [{ type: "DEFINITIVE_FAILURE" }], {
    participantAction: false,
  });
  invalidateConfirmation(core, { draftId: draft.id });
  const writer = participantWriter(core, {
    participantId: draft.participantId,
    conversationId: draft.conversationId,
    dedupePrefix: `reverted:${operation.id}`,
  });
  if (writer) {
    writer.say("publish.reverted");
    askConfirmation(writer, reviewed, operation.envelope?.accountAddress ?? null);
  }
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
