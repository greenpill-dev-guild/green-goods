import { readControl } from "./controls";
import type { OperationRecord } from "./operations";
import type { ReportingCore } from "./runtime";

/**
 * Execution attempts. A reservation is a compare-and-swap on the operation's attempt version and
 * requires the publication switch to be open; the returned permit version is what the sender
 * acknowledges before it prompts a wallet or signs. Every attempt keeps its references and typed
 * outcome forever: an unknown outcome is never evidence that nothing was sent.
 */
export type AttemptState =
  | "reserved"
  | "wallet_pending"
  | "signed"
  | "broadcast"
  | "uncertain"
  | "rejected_before_send"
  | "preparation_failed"
  | "released"
  | "confirmed"
  | "reverted";

export const UNRESOLVED_ATTEMPT_STATES: readonly AttemptState[] = [
  "reserved",
  "wallet_pending",
  "signed",
  "broadcast",
  "uncertain",
];

export interface AttemptRecord {
  id: string;
  operationId: string;
  attemptNumber: number;
  mode: "owner" | "delegated";
  grantId: string | null;
  payloadDigest: string;
  identityEpoch: number;
  expectedAccount: string;
  fromBlock: number | null;
  state: AttemptState;
  userOperationHash: string | null;
  transactionHash: string | null;
  reasonCode: string | null;
  gasReserved: number;
}

interface AttemptRow {
  id: string;
  operation_id: string;
  attempt_number: number;
  authorization_mode: "owner" | "delegated";
  execution_grant_id: string | null;
  payload_digest: string;
  identity_epoch: number;
  expected_account: string;
  from_block: number | null;
  state: AttemptState;
  user_operation_hash: string | null;
  transaction_hash: string | null;
  reason_code: string | null;
  gas_reserved: number;
}

function toAttempt(row: AttemptRow | null): AttemptRecord | null {
  return row
    ? {
        id: row.id,
        operationId: row.operation_id,
        attemptNumber: row.attempt_number,
        mode: row.authorization_mode,
        grantId: row.execution_grant_id,
        payloadDigest: row.payload_digest,
        identityEpoch: row.identity_epoch,
        expectedAccount: row.expected_account,
        fromBlock: row.from_block,
        state: row.state,
        userOperationHash: row.user_operation_hash,
        transactionHash: row.transaction_hash,
        reasonCode: row.reason_code,
        gasReserved: row.gas_reserved,
      }
    : null;
}

export function attemptById(core: ReportingCore, id: string): AttemptRecord | null {
  return toAttempt(
    core.db
      .query("SELECT * FROM execution_attempts WHERE id = $id")
      .get({ id }) as AttemptRow | null
  );
}

export function latestAttempt(core: ReportingCore, operationId: string): AttemptRecord | null {
  return toAttempt(
    core.db
      .query(
        "SELECT * FROM execution_attempts WHERE operation_id = $id ORDER BY attempt_number DESC LIMIT 1"
      )
      .get({ id: operationId }) as AttemptRow | null
  );
}

export type ReservationRefusal = "conflict" | "paused" | "stale_revision";

/** Call inside a transaction. Moves the operation to `sending` and records the new attempt. */
export function reserveAttempt(
  core: ReportingCore,
  input: {
    operation: OperationRecord;
    expectedAttemptVersion: number;
    payloadDigest: string;
    mode: "owner" | "delegated";
    grantId?: string | null;
    policyDigest?: string | null;
    identityEpoch: number;
    expectedAccount: string;
    fromBlock: number | null;
    gasReserved?: number;
  }
): { attempt: AttemptRecord; permitVersion: number } | ReservationRefusal {
  const publication = readControl(core, "publication");
  if (!publication.enabled) return "paused";
  const op = input.operation;
  if (op.payloadDigest !== input.payloadDigest) return "stale_revision";
  const now = core.clock.now();
  const moved = core.db
    .query(
      `UPDATE execution_operations SET attempt_version = attempt_version + 1, state = 'sending', version = version + 1,
         from_block = COALESCE(from_block, $from), updated_at = $now
       WHERE id = $id AND attempt_version = $expected AND state = 'prepared' AND payload_digest = $digest`
    )
    .run({
      id: op.id,
      expected: input.expectedAttemptVersion,
      digest: input.payloadDigest,
      from: input.fromBlock,
      now,
    });
  if (moved.changes !== 1) return "conflict";
  const id = core.ids.id();
  try {
    core.db
      .query(
        `INSERT INTO execution_attempts
           (id, operation_id, attempt_number, authorization_mode, execution_grant_id, policy_digest, payload_digest,
            identity_epoch, expected_account, from_block, gas_reserved, state, created_at, updated_at)
         VALUES ($id, $operation, $number, $mode, $grant, $policy, $digest, $epoch, $account, $from, $gas, $state, $now, $now)`
      )
      .run({
        id,
        operation: op.id,
        number: input.expectedAttemptVersion + 1,
        mode: input.mode,
        grant: input.grantId ?? null,
        policy: input.policyDigest ?? null,
        digest: input.payloadDigest,
        epoch: input.identityEpoch,
        account: input.expectedAccount.toLowerCase(),
        from: input.fromBlock,
        gas: input.gasReserved ?? 0,
        state: input.mode === "owner" ? "wallet_pending" : "reserved",
        now,
      });
  } catch (error) {
    if ((error as { code?: string }).code?.startsWith("SQLITE_CONSTRAINT")) return "conflict";
    throw error;
  }
  return { attempt: attemptById(core, id) as AttemptRecord, permitVersion: publication.version };
}

export function updateAttempt(
  core: ReportingCore,
  attemptId: string,
  patch: {
    state: AttemptState;
    transactionHash?: string | null;
    userOperationHash?: string | null;
    reasonCode?: string | null;
    signedOperation?: string | null;
    observedBlockHash?: string | null;
    logIndex?: number | null;
  }
): void {
  const now = core.clock.now();
  const resolved = [
    "confirmed",
    "reverted",
    "rejected_before_send",
    "preparation_failed",
    "released",
  ].includes(patch.state);
  core.db
    .query(
      `UPDATE execution_attempts
       SET state = $state, transaction_hash = COALESCE($tx, transaction_hash),
           user_operation_hash = COALESCE($userOp, user_operation_hash), reason_code = COALESCE($reason, reason_code),
           signed_operation_ciphertext = COALESCE($signed, signed_operation_ciphertext),
           observed_block_hash = COALESCE($block, observed_block_hash), attested_log_index = COALESCE($log, attested_log_index),
           submitted_at = CASE WHEN $state IN ('broadcast','uncertain') AND submitted_at IS NULL THEN $now ELSE submitted_at END,
           resolved_at = CASE WHEN $resolved = 1 THEN $now ELSE resolved_at END, updated_at = $now
       WHERE id = $id`
    )
    .run({
      id: attemptId,
      state: patch.state,
      tx: patch.transactionHash ?? null,
      userOp: patch.userOperationHash ?? null,
      reason: patch.reasonCode ?? null,
      signed: patch.signedOperation ?? null,
      block: patch.observedBlockHash ?? null,
      log: patch.logIndex ?? null,
      resolved: resolved ? 1 : 0,
      now,
    });
}

/** Replays an outcome already recorded under this idempotency key, or reports a conflict. */
export function recordedOutcome(
  core: ReportingCore,
  attemptId: string,
  idempotencyKey: string,
  requestDigest: string
): { status: "replay"; response: Record<string, unknown> } | { status: "conflict" } | null {
  const row = core.db
    .query(
      "SELECT request_digest, response_json FROM attempt_outcomes WHERE attempt_id = $attempt AND idempotency_key = $key"
    )
    .get({ attempt: attemptId, key: idempotencyKey }) as {
    request_digest: string;
    response_json: string;
  } | null;
  if (!row) return null;
  return row.request_digest === requestDigest
    ? { status: "replay", response: JSON.parse(row.response_json) as Record<string, unknown> }
    : { status: "conflict" };
}

export function storeOutcome(
  core: ReportingCore,
  input: {
    attemptId: string;
    idempotencyKey: string;
    requestDigest: string;
    outcomeKind: string;
    response: Record<string, unknown>;
  }
): void {
  core.db
    .query(
      `INSERT INTO attempt_outcomes (attempt_id, idempotency_key, request_digest, outcome_kind, response_json, created_at)
       VALUES ($attempt, $key, $digest, $kind, $response, $now)`
    )
    .run({
      attempt: input.attemptId,
      key: input.idempotencyKey,
      digest: input.requestDigest,
      kind: input.outcomeKind,
      response: JSON.stringify(input.response),
      now: core.clock.now(),
    });
}
