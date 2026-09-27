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
import { activeConsentId, hasPublicationConsent } from "./consent";
import { confirmationById, invalidateConfirmation } from "./confirmations";
import { commitLifecycle, lifecycleState } from "./coordinator/draft-commit";
import { askConfirmation } from "./coordinator/prompting";
import { inTransaction } from "./database";
import { loadDraft } from "./drafts";
import { type ClaimedJob, enqueueJob } from "./jobs";
import { participantWriter } from "./notify";
import { operationById, setOperationState } from "./operations";
import { audit } from "./participants";
import type { ReportingCore } from "./runtime";
import type { BrowserSession } from "./sessions";
import type { JobOutcome } from "./worker";

/**
 * Owner-signed execution, driven by the browser ceremony. The Agent reserves exactly one attempt
 * before any wallet prompt and owns the truth of its outcome: a broadcast or uncertain result moves
 * to reconciliation and keeps its reservation; only a proven rejection before sending returns the
 * report for explicit reconfirmation. A forged or late hint can never release a recorded send.
 */
export type ExecutionError =
  | "unavailable"
  | "forbidden"
  | "conflict"
  | "paused"
  | "stale_revision"
  | "dependency_unavailable";

function scopedOperation(core: ReportingCore, operationId: string, session: BrowserSession) {
  const operation = operationById(core, operationId);
  if (
    !operation ||
    operation.kind !== "work" ||
    operation.draftId !== session.request.resourceId ||
    operation.authorAccountId !== session.accountBindingId
  ) {
    return null;
  }
  return operation;
}

export async function reserveOwnerAttempt(
  core: ReportingCore,
  chain: ReportingChain,
  input: {
    operationId: string;
    session: BrowserSession;
    expectedAttemptVersion: number;
    payloadDigest: string;
  }
): Promise<
  | { ok: true; attemptId: string; attemptNumber: number; permitVersion: number }
  | { ok: false; errorCode: ExecutionError }
> {
  const operation = scopedOperation(core, input.operationId, input.session);
  if (!operation || operation.authorizationMode !== "owner")
    return { ok: false, errorCode: "unavailable" };
  let fromBlock: bigint;
  try {
    const roles = await chain.gardenRoles(
      operation.chainId,
      operation.gardenAddress as `0x${string}`,
      input.session.account
    );
    if (!roles.gardener && !roles.operator) return { ok: false, errorCode: "forbidden" };
    fromBlock = await chain.blockNumber(operation.chainId);
  } catch {
    return { ok: false, errorCode: "dependency_unavailable" };
  }
  return inTransaction(core.db, () => {
    const draft = operation.draftId ? loadDraft(core, operation.draftId) : null;
    const confirmation = confirmationById(core, operation.confirmationId);
    if (
      !draft ||
      lifecycleState(draft) !== "awaitingWallet" ||
      draft.revision !== operation.resourceRevision
    ) {
      return { ok: false as const, errorCode: "stale_revision" as const };
    }
    const subject = participantWriter(core, {
      participantId: draft.participantId,
      conversationId: draft.conversationId,
      dedupePrefix: "reserve",
    })?.target.subjectId;
    if (
      !confirmation ||
      !subject ||
      !activeConsentId(core, subject, "processing") ||
      !hasPublicationConsent(core, draft.id, draft.revision, confirmation.summaryDigest)
    ) {
      return { ok: false as const, errorCode: "forbidden" as const };
    }
    const fresh = operationById(core, operation.id);
    if (!fresh) return { ok: false as const, errorCode: "unavailable" as const };
    const reserved = reserveAttempt(core, {
      operation: fresh,
      expectedAttemptVersion: input.expectedAttemptVersion,
      payloadDigest: input.payloadDigest,
      mode: "owner",
      identityEpoch: input.session.identityEpoch,
      expectedAccount: input.session.account,
      fromBlock: Number(fromBlock),
    });
    if (typeof reserved === "string") return { ok: false as const, errorCode: reserved };
    commitLifecycle(core, draft, [{ type: "ATTEMPT_RESERVED" }], { participantAction: true });
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
      attempt.mode !== "owner"
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
    if (attempt.state !== "wallet_pending") {
      audit(
        core,
        "outcome_hint_rejected",
        { kind: "attempt", id: attempt.id },
        { hint: input.outcome.kind, state: attempt.state }
      );
      return { ok: false, errorCode: "conflict" };
    }
    const draft = operation.draftId ? loadDraft(core, operation.draftId) : null;
    if (!draft) return { ok: false, errorCode: "unavailable" };
    const outcome = input.outcome;
    const writer = participantWriter(core, {
      participantId: draft.participantId,
      conversationId: draft.conversationId,
      dedupePrefix: `outcome:${attempt.id}`,
    });

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
      commitLifecycle(
        core,
        draft,
        [{ type: outcome.kind === "broadcast" ? "BROADCAST" : "OUTCOME_UNCERTAIN" }],
        { participantAction: true }
      );
      enqueueJob(core, {
        kind: "reconcile_operation",
        subjectId: operation.id,
        dedupeKey: `reconcile:${attempt.id}`,
        maxAttempts: 40,
      });
      if (outcome.kind === "uncertain") writer?.say("publish.uncertain");
    } else {
      attemptState = outcome.kind;
      operationState = "failed";
      updateAttempt(core, attempt.id, { state: outcome.kind, reasonCode: outcome.reason });
      setOperationState(core, operation.id, "failed", { failureCode: outcome.kind });
      const { draft: reviewed } = commitLifecycle(core, draft, [{ type: "REJECTED_BEFORE_SEND" }], {
        participantAction: true,
      });
      invalidateConfirmation(core, { draftId: draft.id });
      if (writer) {
        writer.say(
          outcome.kind === "rejected_before_send" ? "publish.rejected" : "publish.preparationFailed"
        );
        askConfirmation(writer, reviewed, input.session.account);
      }
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

/**
 * A reference the browser reports after its callback window closed. It may only add the missing
 * transaction or UserOperation hash to the same reserved attempt; it never changes the outcome.
 */
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

/**
 * The wallet window closed without a browser outcome. Absence of a callback never proves that
 * nothing was sent, so the attempt becomes uncertain and the reconciler searches the chain; it is
 * never released or resent from here.
 */
export function watchOwnerAttempt(core: ReportingCore, job: ClaimedJob): JobOutcome {
  return inTransaction(core.db, (): JobOutcome => {
    const attempt = attemptById(core, job.subjectId);
    const operation = attempt ? operationById(core, attempt.operationId) : null;
    if (!attempt || !operation || attempt.state !== "wallet_pending") return { status: "done" };
    updateAttempt(core, attempt.id, { state: "uncertain", reasonCode: "callback_missing" });
    setOperationState(core, operation.id, "reconciling");
    audit(core, "attempt_callback_missing", { kind: "attempt", id: attempt.id }, {});
    enqueueJob(core, {
      kind: "reconcile_operation",
      subjectId: operation.id,
      dedupeKey: `reconcile:${attempt.id}`,
      maxAttempts: 40,
    });
    const draft = operation.draftId ? loadDraft(core, operation.draftId) : null;
    if (!draft) return { status: "done" };
    commitLifecycle(core, draft, [{ type: "OUTCOME_UNCERTAIN" }], { participantAction: false });
    participantWriter(core, {
      participantId: draft.participantId,
      conversationId: draft.conversationId,
      dedupePrefix: `watch:${attempt.id}`,
    })?.say("publish.unknown");
    return { status: "done" };
  });
}
