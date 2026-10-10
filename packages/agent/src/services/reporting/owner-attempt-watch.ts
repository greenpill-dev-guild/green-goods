import { attemptById, updateAttempt } from "./attempts";
import { inTransaction } from "./database";
import { enqueueJob, type ClaimedJob } from "./jobs";
import { participantWriter } from "./notify";
import { operationSubject } from "./operation-subjects";
import { operationById, setOperationState } from "./operations";
import { audit } from "./participants";
import type { ReportingCore } from "./runtime";
import type { JobOutcome } from "./worker";

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
    const subject = operationSubject(core, operation);
    if (!subject) return { status: "done" };
    subject.advance("OUTCOME_UNCERTAIN", false);
    participantWriter(core, {
      participantId: subject.participantId,
      conversationId: subject.conversationId,
      dedupePrefix: `watch:${attempt.id}`,
    })?.say("publish.unknown");
    return { status: "done" };
  });
}
