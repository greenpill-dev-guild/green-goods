import type { Hex } from "viem";
import { attemptById, updateAttempt } from "./attempts";
import { confirmationById } from "./confirmations";
import { readControl } from "./controls";
import { inTransaction } from "./database";
import type { DelegatedDeps, DelegatedSender } from "./delegated";
import { grantById, type GrantRecord } from "./grants-store";
import { enqueueJob } from "./jobs";
import { participantWriter } from "./notify";
import { type OperationSubject, operationSubject } from "./operation-subjects";
import { operationById, setOperationState } from "./operations";
import { participantEpoch } from "./participants";
import type { ReportingCore } from "./runtime";
import type { JobOutcome } from "./worker";

/** Network handoff of durable signed bytes, with fresh controls/identity/consent after RPC waits. */
const done: JobOutcome = { status: "done" };
export const PAUSED: JobOutcome = {
  status: "retry",
  errorCode: "publication_paused",
  delayMs: 5 * 60_000,
};

export function signedContext(attemptId: string): string {
  return `execution_attempts.signed:${attemptId}`;
}

export function grantOriginMatches(
  core: ReportingCore,
  grant: GrantRecord,
  subject: OperationSubject
): boolean {
  const writer = participantWriter(core, {
    participantId: subject.participantId,
    conversationId: subject.conversationId,
    dedupePrefix: "grant-origin",
  });
  const binding = core.db
    .query(
      "SELECT id FROM channel_bindings WHERE id = $id AND status = 'active' AND channel_subject_id = $subject"
    )
    .get({ id: grant.channelBindingId, subject: writer?.target.subjectId ?? "" });
  return Boolean(binding);
}

export async function submitSigned(
  deps: DelegatedDeps,
  operationId: string,
  attemptId: string
): Promise<JobOutcome> {
  const { core } = deps;
  const attempt = attemptById(core, attemptId);
  const grant = attempt?.grantId ? grantById(core, attempt.grantId) : null;
  const operation = operationById(core, operationId);
  const subject = operation ? operationSubject(core, operation) : null;
  if (!readControl(core, "publication").enabled) return PAUSED;
  // Reservations count this signed attempt itself. Check lifetime/epoch directly, not the
  // remaining-submission predicate, so the fifth reserved attempt can still be sent.
  if (
    !grant ||
    !subject ||
    grant.state !== "active" ||
    core.clock.now() < grant.validAfter ||
    core.clock.now() >= grant.validUntil ||
    grant.identityEpoch !== participantEpoch(core, subject.participantId) ||
    !grantOriginMatches(core, grant, subject)
  ) {
    enqueueJob(core, {
      kind: "reconcile_operation",
      subjectId: operationId,
      dedupeKey: `reconcile:${attemptId}`,
      maxAttempts: 40,
    });
    return done;
  }
  try {
    if (
      !grant.permissionId ||
      !(await deps.chain.permissionInstalled(
        grant.chainId,
        grant.policy.account,
        grant.permissionId as Hex
      ))
    )
      return done;
    const confirmation = operation ? confirmationById(core, operation.confirmationId) : null;
    if (!confirmation || !subject.consented(confirmation.summaryDigest)) return done;
    const roles = await deps.chain.gardenRoles(
      grant.chainId,
      grant.gardenAddress,
      grant.policy.account
    );
    if (!(grant.purpose === "review" ? roles.operator : roles.gardener || roles.operator))
      return done;
  } catch {
    return { status: "retry", errorCode: "dependency_unavailable", delayMs: 30_000 };
  }
  const row = core.db
    .query("SELECT signed_operation_ciphertext FROM execution_attempts WHERE id = $id")
    .get({ id: attemptId }) as { signed_operation_ciphertext: string | null } | null;
  if (!row?.signed_operation_ciphertext) return done;
  const signed = core.keyring.open(row.signed_operation_ciphertext, signedContext(attemptId));
  // RPC waits above are not a lock. Recovery, pause or withdrawn consent during those reads
  // must prevent the subsequent network handoff without releasing an uncertain reservation.
  if (!readControl(core, "publication").enabled) return PAUSED;
  const refreshedGrant = grantById(core, grant.id);
  const refreshedOperation = operationById(core, operationId);
  const refreshedSubject = refreshedOperation ? operationSubject(core, refreshedOperation) : null;
  const refreshedConfirmation = refreshedOperation
    ? confirmationById(core, refreshedOperation.confirmationId)
    : null;
  if (
    !refreshedGrant ||
    !refreshedSubject ||
    !refreshedConfirmation ||
    refreshedGrant.state !== "active" ||
    core.clock.now() < refreshedGrant.validAfter ||
    core.clock.now() >= refreshedGrant.validUntil ||
    refreshedGrant.identityEpoch !== participantEpoch(core, refreshedSubject.participantId) ||
    !grantOriginMatches(core, refreshedGrant, refreshedSubject) ||
    !refreshedSubject.consented(refreshedConfirmation.summaryDigest)
  ) {
    enqueueJob(core, {
      kind: "reconcile_operation",
      subjectId: operationId,
      dedupeKey: `reconcile:${attemptId}`,
      maxAttempts: 40,
    });
    return done;
  }
  let result: Awaited<ReturnType<DelegatedSender["submit"]>>;
  try {
    result = await deps.sender.submit(signed);
  } catch {
    result = { accepted: false, retryable: false, errorCode: "submit_unknown" };
  }
  inTransaction(core.db, () => {
    updateAttempt(core, attemptId, {
      state: result.accepted ? "broadcast" : "uncertain",
      ...(result.accepted ? {} : { reasonCode: result.errorCode ?? "submit_failed" }),
    });
    setOperationState(core, operationId, "reconciling");
    const operation = operationById(core, operationId);
    if (operation)
      operationSubject(core, operation)?.advance(
        result.accepted ? "BROADCAST" : "OUTCOME_UNCERTAIN",
        false
      );
    // Whether or not the bundler answered, the chain decides; nothing is signed again.
    enqueueJob(core, {
      kind: "reconcile_operation",
      subjectId: operationId,
      dedupeKey: `reconcile:${attemptId}`,
      maxAttempts: 40,
    });
  });
  return done;
}
