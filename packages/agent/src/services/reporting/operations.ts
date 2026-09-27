import type { PublicationEnvelope } from "@green-goods/shared/modules/agent-reporting";
import type { ReportingCore } from "./runtime";

/**
 * One logical publication or decision per draft (or review) and author account. Attempts and
 * replacements belong to it. A new revision may replace an operation that has never had an
 * unresolved attempt, but it can never start a second publication while an earlier broadcast is
 * unresolved. The frozen envelope is sealed; its payload digest is public.
 */
export type OperationState =
  | "created"
  | "preparing"
  | "preparation_failed"
  | "prepared"
  | "sending"
  | "reconciling"
  | "published"
  | "failed"
  | "cancelled";

export interface OperationRecord {
  id: string;
  kind: "work" | "review";
  draftId: string | null;
  reviewIntentId: string | null;
  authorAccountId: string;
  resourceRevision: number;
  confirmationId: string;
  chainId: number;
  gardenAddress: string;
  authorizationMode: "owner" | "delegated" | null;
  payloadDigest: string | null;
  envelope: PublicationEnvelope | null;
  attemptVersion: number;
  version: number;
  state: OperationState;
  failureCode: string | null;
  transactionHash: string | null;
  attestationUid: string | null;
  fromBlock: number | null;
}

interface OperationRow {
  id: string;
  kind: "work" | "review";
  draft_id: string | null;
  review_intent_id: string | null;
  author_account_id: string;
  resource_revision: number;
  confirmation_id: string;
  chain_id: number;
  garden_address: string;
  authorization_mode: "owner" | "delegated" | null;
  payload_digest: string | null;
  prepared_envelope_ciphertext: string | null;
  attempt_version: number;
  version: number;
  state: OperationState;
  failure_code: string | null;
  transaction_hash: string | null;
  attestation_uid: string | null;
  from_block: number | null;
}

function envelopeContext(operationId: string): string {
  return `execution_operations.envelope:${operationId}`;
}

function toRecord(core: ReportingCore, row: OperationRow | null): OperationRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    draftId: row.draft_id,
    reviewIntentId: row.review_intent_id,
    authorAccountId: row.author_account_id,
    resourceRevision: row.resource_revision,
    confirmationId: row.confirmation_id,
    chainId: row.chain_id,
    gardenAddress: row.garden_address,
    authorizationMode: row.authorization_mode,
    payloadDigest: row.payload_digest,
    envelope: row.prepared_envelope_ciphertext
      ? (JSON.parse(
          core.keyring.open(row.prepared_envelope_ciphertext, envelopeContext(row.id))
        ) as PublicationEnvelope)
      : null,
    attemptVersion: row.attempt_version,
    version: row.version,
    state: row.state,
    failureCode: row.failure_code,
    transactionHash: row.transaction_hash,
    attestationUid: row.attestation_uid,
    fromBlock: row.from_block,
  };
}

export function operationById(core: ReportingCore, id: string): OperationRecord | null {
  return toRecord(
    core,
    core.db
      .query("SELECT * FROM execution_operations WHERE id = $id")
      .get({ id }) as OperationRow | null
  );
}

export function operationForSubject(
  core: ReportingCore,
  subject: { draftId: string } | { reviewIntentId: string }
): OperationRecord | null {
  const [column, id] =
    "draftId" in subject
      ? ["draft_id", subject.draftId]
      : ["review_intent_id", subject.reviewIntentId];
  return toRecord(
    core,
    core.db
      .query(
        `SELECT * FROM execution_operations WHERE ${column} = $id ORDER BY created_at DESC LIMIT 1`
      )
      .get({ id }) as OperationRow | null
  );
}

export function hasUnresolvedAttempt(core: ReportingCore, operationId: string): boolean {
  return (
    core.db
      .query(
        `SELECT 1 AS found FROM execution_attempts
         WHERE operation_id = $id AND state IN ('reserved','wallet_pending','signed','broadcast','uncertain')`
      )
      .get({ id: operationId }) !== null
  );
}

/**
 * Creates the logical operation, or re-points an unbroadcast one at a newly confirmed revision.
 * Returns "in_flight" when an earlier attempt is still unresolved.
 */
export function upsertOperation(
  core: ReportingCore,
  input: {
    subject: { draftId: string } | { reviewIntentId: string };
    authorAccountId: string;
    revision: number;
    confirmationId: string;
    chainId: number;
    gardenAddress: string;
    mode: "owner" | "delegated";
  }
): OperationRecord | "in_flight" | "published" {
  const kind = "draftId" in input.subject ? "work" : "review";
  const subjectId =
    "draftId" in input.subject ? input.subject.draftId : input.subject.reviewIntentId;
  const key = `${kind}:${subjectId}:${input.authorAccountId}`;
  const now = core.clock.now();
  const existing = core.db
    .query("SELECT * FROM execution_operations WHERE logical_operation_key = $key")
    .get({ key }) as OperationRow | null;
  if (existing) {
    if (existing.state === "published") return "published";
    if (hasUnresolvedAttempt(core, existing.id)) return "in_flight";
    core.db
      .query(
        `UPDATE execution_operations
         SET resource_revision = $revision, confirmation_id = $confirmation, authorization_mode = $mode,
             payload_digest = NULL, prepared_envelope_ciphertext = NULL, state = 'preparing', failure_code = NULL,
             version = version + 1, updated_at = $now
         WHERE id = $id`
      )
      .run({
        id: existing.id,
        revision: input.revision,
        confirmation: input.confirmationId,
        mode: input.mode,
        now,
      });
    return operationById(core, existing.id) as OperationRecord;
  }
  const id = core.ids.id();
  core.db
    .query(
      `INSERT INTO execution_operations
         (id, logical_operation_key, kind, draft_id, review_intent_id, author_account_id, resource_revision,
          confirmation_id, chain_id, garden_address, authorization_mode, state, created_at, updated_at)
       VALUES ($id, $key, $kind, $draft, $review, $author, $revision, $confirmation, $chain, $garden, $mode,
               'preparing', $now, $now)`
    )
    .run({
      id,
      key,
      kind,
      draft: kind === "work" ? subjectId : null,
      review: kind === "review" ? subjectId : null,
      author: input.authorAccountId,
      revision: input.revision,
      confirmation: input.confirmationId,
      chain: input.chainId,
      garden: input.gardenAddress,
      mode: input.mode,
      now,
    });
  return operationById(core, id) as OperationRecord;
}

/** Freezes the exact envelope before any wallet request or delegated signature. */
export function freezeEnvelope(
  core: ReportingCore,
  operation: OperationRecord,
  envelope: PublicationEnvelope
): boolean {
  return (
    core.db
      .query(
        `UPDATE execution_operations
         SET prepared_envelope_ciphertext = $envelope, payload_digest = $digest, state = 'prepared',
             version = version + 1, updated_at = $now
         WHERE id = $id AND version = $version AND state = 'preparing'`
      )
      .run({
        id: operation.id,
        version: operation.version,
        envelope: core.keyring.seal(JSON.stringify(envelope), envelopeContext(operation.id)),
        digest: envelope.payloadDigest,
        now: core.clock.now(),
      }).changes === 1
  );
}

export function setOperationState(
  core: ReportingCore,
  operationId: string,
  state: OperationState,
  patch: {
    failureCode?: string | null;
    transactionHash?: string;
    attestationUid?: string;
    blockHash?: string;
    logIndex?: number;
    fromBlock?: number;
  } = {}
): void {
  core.db
    .query(
      `UPDATE execution_operations
       SET state = $state, failure_code = COALESCE($failure, CASE WHEN $clearFailure = 1 THEN NULL ELSE failure_code END),
           transaction_hash = COALESCE($tx, transaction_hash), attestation_uid = COALESCE($uid, attestation_uid),
           block_hash = COALESCE($block, block_hash), log_index = COALESCE($log, log_index),
           from_block = COALESCE($from, from_block), version = version + 1, updated_at = $now
       WHERE id = $id`
    )
    .run({
      id: operationId,
      state,
      failure: patch.failureCode ?? null,
      clearFailure: patch.failureCode === null ? 1 : 0,
      tx: patch.transactionHash ?? null,
      uid: patch.attestationUid ?? null,
      block: patch.blockHash ?? null,
      log: patch.logIndex ?? null,
      from: patch.fromBlock ?? null,
      now: core.clock.now(),
    });
}
