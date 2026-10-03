import {
  type AttemptOutcome,
  canonicalJson,
  reportingDigest,
} from "@green-goods/shared/modules/agent-reporting";
import {
  attemptById,
  recordedOutcome,
  reserveAttempt,
  storeOutcome,
  updateAttempt,
} from "./attempts";
import type { ReportingChain } from "./chain";
import { confirmationById } from "./confirmations";
import { grantById } from "./grants-store";
import { inTransaction } from "./database";
import { enqueueJob } from "./jobs";
import { participantWriter } from "./notify";
import { operationSubject } from "./operation-subjects";
import { operationById, setOperationState } from "./operations";
import { audit, participantEpoch } from "./participants";
import type { ReportingCore } from "./runtime";
import type { BrowserSession } from "./sessions";
import { sessionOwnsOperation } from "./views";

/**
 * Owner-signed execution of a report or a steward decision, driven by the browser ceremony. The
 * Agent reserves exactly one attempt before any wallet prompt and owns the truth of its outcome: a
 * broadcast or uncertain result moves to reconciliation and keeps its reservation; only a proven
 * rejection before sending returns the subject for explicit reconfirmation. A forged or late hint
 * can never release a recorded send.
 */
export type ExecutionError =
  | "unavailable"
  | "forbidden"
  | "conflict"
  | "paused"
  | "stale_revision"
  | "dependency_unavailable";

/** The operation behind the session's own resource and account; anything else is unavailable. */
function scopedOperation(core: ReportingCore, operationId: string, session: BrowserSession) {
  const operation = operationById(core, operationId);
  return operation && sessionOwnsOperation(session, operation) ? operation : null;
}

export async function reserveOwnerAttempt(
  core: ReportingCore,
  chain: ReportingChain,
  input: {
    operationId: string;
    session: BrowserSession;
    expectedAttemptVersion: number;
    payloadDigest: string;
    activation?: { grantId: string; gasReserved: number };
  }
): Promise<
  | { ok: true; attemptId: string; attemptNumber: number; permitVersion: number }
  | { ok: false; errorCode: ExecutionError }
> {
  const operation = scopedOperation(core, input.operationId, input.session);
  if (!operation || operation.authorizationMode !== "owner")
    return { ok: false, errorCode: "unavailable" };
  const requiresOperator = operation.kind === "review";
  let fromBlock: bigint;
  try {
    const roles = await chain.gardenRoles(
      operation.chainId,
      operation.gardenAddress as `0x${string}`,
      input.session.account
    );
    const allowed = requiresOperator ? roles.operator : roles.gardener || roles.operator;
    if (!allowed) return { ok: false, errorCode: "forbidden" };
    fromBlock = await chain.blockNumber(operation.chainId);
  } catch {
    return { ok: false, errorCode: "dependency_unavailable" };
  }
  return inTransaction(core.db, () => {
    const subject = operationSubject(core, operation);
    const confirmation = confirmationById(core, operation.confirmationId);
    if (!subject?.awaitingOwner || subject.revision !== operation.resourceRevision) {
      return { ok: false as const, errorCode: "stale_revision" as const };
    }
    if (!confirmation || !subject.consented(confirmation.summaryDigest)) {
      return { ok: false as const, errorCode: "forbidden" as const };
    }
    const fresh = operationById(core, operation.id);
    if (!fresh) return { ok: false as const, errorCode: "unavailable" as const };
    const activationGrant = input.activation ? grantById(core, input.activation.grantId) : null;
    if (
      input.activation &&
      (!activationGrant ||
        activationGrant.state !== "owner_authorization_pending" ||
        activationGrant.accountBindingId !== input.session.accountBindingId ||
        activationGrant.identityEpoch !== input.session.identityEpoch ||
        participantEpoch(core, input.session.participantId) !== input.session.identityEpoch ||
        input.session.expiresAt <= core.clock.now() ||
        !core.db
          .query("SELECT id FROM channel_bindings WHERE id = $id AND status = 'active'")
          .get({ id: activationGrant.channelBindingId }) ||
        activationGrant.channelBindingId !== input.session.request.bindingId ||
        activationGrant.gardenAddress !== operation.gardenAddress.toLowerCase() ||
        activationGrant.purpose !== (operation.kind === "work" ? "reporting" : "review") ||
        core.clock.now() < activationGrant.validAfter ||
        core.clock.now() >= activationGrant.validUntil)
    )
      return { ok: false as const, errorCode: "forbidden" as const };
    const reserved = reserveAttempt(core, {
      operation: fresh,
      expectedAttemptVersion: input.expectedAttemptVersion,
      payloadDigest: input.payloadDigest,
      mode: activationGrant ? "activation" : "owner",
      ...(activationGrant && input.activation
        ? {
            grantId: activationGrant.id,
            policyDigest: activationGrant.policyDigest,
            gasReserved: input.activation.gasReserved,
          }
        : {}),
      identityEpoch: input.session.identityEpoch,
      expectedAccount: input.session.account,
      fromBlock: Number(fromBlock),
    });
    if (typeof reserved === "string") return { ok: false as const, errorCode: reserved };
    if (activationGrant && input.activation) {
      const budget = core.db
        .query(`UPDATE execution_grants SET submissions_reserved = submissions_reserved + 1,
        gas_reserved = gas_reserved + $gas, version = version + 1, updated_at = $now
        WHERE id = $id AND state = 'owner_authorization_pending' AND valid_after <= $now AND valid_until > $now
        AND submissions_reserved + submissions_consumed < max_submissions AND gas_reserved + gas_consumed + $gas <= gas_cap`)
        .run({ id: activationGrant.id, gas: input.activation.gasReserved, now: core.clock.now() });
      // Throw rolls the attempt and operation CAS back with the exhausted budget.
      if (budget.changes !== 1) throw new ActivationBudgetError();
    }
    subject.advance("ATTEMPT_RESERVED", true);
    enqueueJob(core, {
      kind: "watch_owner_attempt",
      subjectId: reserved.attempt.id,
      dedupeKey: `watch:${reserved.attempt.id}`,
      runAfter: core.clock.now() + core.settings.walletResponseWindowMs,
    });
    return {
      ok: true as const,
      attemptId: reserved.attempt.id,
      attemptNumber: reserved.attempt.attemptNumber,
      permitVersion: reserved.permitVersion,
    };
  });
}

export class ActivationBudgetError extends Error {}

export interface OutcomeResponse {
  ok: true;
  operationState: string;
  attemptState: string;
}

export type OutcomeResult =
  | { ok: true; response: OutcomeResponse }
  | { ok: false; errorCode: ExecutionError };

export function recordOwnerOutcome(
  core: ReportingCore,
  input: {
    operationId: string;
    session: BrowserSession;
    attemptId: string;
    idempotencyKey: string;
    payloadDigest: string;
    outcome: AttemptOutcome;
    activationGrantId?: string;
  }
): OutcomeResult {
  const requestDigest = reportingDigest(
    "continuation-resource",
    canonicalJson({ payload: input.payloadDigest, outcome: input.outcome })
  );
  return inTransaction(core.db, (): OutcomeResult => {
    const operation = scopedOperation(core, input.operationId, input.session);
    const attempt = attemptById(core, input.attemptId);
    if (
      !operation ||
      !attempt ||
      attempt.operationId !== operation.id ||
      !(
        attempt.mode === "owner" ||
        (attempt.mode === "activation" && attempt.grantId === input.activationGrantId)
      )
    ) {
      return { ok: false, errorCode: "unavailable" };
    }
    const prior = recordedOutcome(core, attempt.id, input.idempotencyKey, requestDigest);
    if (prior?.status === "replay") {
      return { ok: true, response: prior.response as unknown as OutcomeResponse };
    }
    if (prior?.status === "conflict") return { ok: false, errorCode: "conflict" };
    if (
      attempt.payloadDigest !== input.payloadDigest ||
      operation.payloadDigest !== input.payloadDigest
    ) {
      return { ok: false, errorCode: "stale_revision" };
    }
    if (
      attempt.mode === "activation" &&
      attempt.state === "confirmed" &&
      operation.state === "published" &&
      (input.outcome.kind === "broadcast" || input.outcome.kind === "uncertain") &&
      attempt.userOperationHash &&
      input.outcome.userOperationHash?.toLowerCase() === attempt.userOperationHash.toLowerCase()
    ) {
      const response = {
        ok: true as const,
        operationState: "published",
        attemptState: "confirmed",
      };
      storeOutcome(core, {
        attemptId: attempt.id,
        idempotencyKey: input.idempotencyKey,
        requestDigest,
        outcomeKind: input.outcome.kind,
        response,
      });
      return { ok: true, response };
    }
    const lateReference = lateBroadcastReference(attempt, input.outcome);
    if (lateReference) {
      updateAttempt(core, attempt.id, { state: "broadcast", ...lateReference });
      enqueueJob(core, {
        kind: "reconcile_operation",
        subjectId: operation.id,
        dedupeKey: `reconcile:${attempt.id}:reported`,
        maxAttempts: 40,
      });
      const response = {
        ok: true as const,
        operationState: operation.state,
        attemptState: "broadcast",
      };
      storeOutcome(core, {
        attemptId: attempt.id,
        idempotencyKey: input.idempotencyKey,
        requestDigest,
        outcomeKind: "broadcast",
        response,
      });
      return { ok: true, response };
    }
    const signedActivation =
      attempt.mode === "activation" &&
      attempt.state === "uncertain" &&
      attempt.reasonCode === "grant_activation_signed" &&
      Boolean(attempt.userOperationHash);
    if (
      signedActivation &&
      (!(input.outcome.kind === "broadcast" || input.outcome.kind === "uncertain") ||
        input.outcome.userOperationHash?.toLowerCase() !== attempt.userOperationHash?.toLowerCase())
    )
      return { ok: false, errorCode: "conflict" };
    if (attempt.state !== "wallet_pending" && !signedActivation) {
      audit(
        core,
        "outcome_hint_rejected",
        { kind: "attempt", id: attempt.id },
        { hint: input.outcome.kind, state: attempt.state }
      );
      return { ok: false, errorCode: "conflict" };
    }
    const subject = operationSubject(core, operation);
    if (!subject) return { ok: false, errorCode: "unavailable" };
    const outcome = input.outcome;

    let attemptState: string;
    let operationState: string;
    if (outcome.kind === "broadcast" || outcome.kind === "uncertain") {
      attemptState = outcome.kind === "broadcast" ? "broadcast" : "uncertain";
      operationState = "reconciling";
      updateAttempt(core, attempt.id, {
        state: attemptState as "broadcast" | "uncertain",
        transactionHash: outcome.transactionHash ?? null,
        userOperationHash: outcome.userOperationHash ?? null,
        reasonCode: outcome.kind === "uncertain" ? outcome.reason : null,
      });
      setOperationState(core, operation.id, "reconciling");
      if (!signedActivation)
        subject.advance(outcome.kind === "broadcast" ? "BROADCAST" : "OUTCOME_UNCERTAIN", true);
      enqueueJob(core, {
        kind: "reconcile_operation",
        subjectId: operation.id,
        dedupeKey: `reconcile:${attempt.id}`,
        maxAttempts: 40,
      });
      if (outcome.kind === "uncertain")
        participantWriter(core, {
          participantId: subject.participantId,
          conversationId: subject.conversationId,
          dedupePrefix: `outcome:${attempt.id}`,
        })?.say("publish.uncertain");
    } else {
      attemptState = outcome.kind;
      operationState = "failed";
      updateAttempt(core, attempt.id, { state: outcome.kind, reasonCode: outcome.reason });
      setOperationState(core, operation.id, "failed", { failureCode: outcome.kind });
      if (attempt.mode === "activation" && attempt.grantId)
        core.db
          .query(`UPDATE execution_grants SET submissions_reserved = submissions_reserved - 1,
          gas_reserved = gas_reserved - $gas, version = version + 1,
          state = CASE WHEN state = 'owner_authorization_pending' THEN 'failed' ELSE state END
          WHERE id = $id AND submissions_reserved > 0 AND gas_reserved >= $gas`)
          .run({ id: attempt.grantId, gas: attempt.gasReserved });
      subject.reopen(outcome.kind, input.session.account, `outcome:${attempt.id}`);
    }
    const response = { ok: true as const, operationState, attemptState };
    storeOutcome(core, {
      attemptId: attempt.id,
      idempotencyKey: input.idempotencyKey,
      requestDigest,
      outcomeKind: outcome.kind,
      response,
    });
    return { ok: true, response };
  });
}

/** Allows a late reference only while the callback-missing attempt has no recorded hashes. */
function lateBroadcastReference(
  attempt: {
    state: string;
    reasonCode: string | null;
    transactionHash: string | null;
    userOperationHash: string | null;
  },
  outcome: AttemptOutcome
): { transactionHash: string | null; userOperationHash: string | null } | null {
  if (
    attempt.state !== "uncertain" ||
    attempt.reasonCode !== "callback_missing" ||
    attempt.transactionHash ||
    attempt.userOperationHash ||
    outcome.kind !== "broadcast" ||
    !(outcome.transactionHash || outcome.userOperationHash)
  ) {
    return null;
  }
  return {
    transactionHash: outcome.transactionHash ?? null,
    userOperationHash: outcome.userOperationHash ?? null,
  };
}
