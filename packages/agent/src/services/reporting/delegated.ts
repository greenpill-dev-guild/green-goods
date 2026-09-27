import {
  attestCallFailures,
  envelopeIssues,
  type PublicationEnvelope,
  type ReportingDeployment,
} from "@green-goods/shared/modules/agent-reporting";
import type { Hex } from "viem";
import { attemptById, latestAttempt, reserveAttempt, updateAttempt } from "./attempts";
import type { ReportingChain } from "./chain";
import { confirmationById } from "./confirmations";
import { readControl } from "./controls";
import { inTransaction } from "./database";
import { grantById, grantUsability, type GrantRecord, liveGrant } from "./grants-store";
import { type ClaimedJob, enqueueJob } from "./jobs";
import { type OperationSubject, operationSubject } from "./operation-subjects";
import { type OperationRecord, operationById, setOperationState } from "./operations";
import { audit, participantEpoch } from "./participants";
import type { ReportingCore } from "./runtime";
import type { JobOutcome } from "./worker";

/**
 * The restricted executor for delegated publication. It reads a confirmed operation from its own
 * queue, never calldata from a model or browser, and before signing rechecks the grant, budget,
 * consent, role, epoch, publication switch and the exact envelope against the grant's call rules.
 * The signed operation and its hash are persisted before submission; after a crash only those same
 * bytes may be resubmitted, never a fresh signature, and an unknown outcome is reconciled. A paused
 * publication switch holds the operation for later; a grant that can no longer be used returns
 * the report to its owner to sign, so a confirmed report is never silently stranded.
 */
export interface DelegatedSender {
  readonly signerAddress: Hex;
  sign(input: {
    grant: GrantRecord;
    envelope: PublicationEnvelope;
  }): Promise<{ userOperationHash: Hex; signedOperation: string }>;
  submit(
    signedOperation: string
  ): Promise<{ accepted: boolean; retryable: boolean; errorCode?: string }>;
}

export interface DelegatedDeps {
  core: ReportingCore;
  chain: ReportingChain;
  deployment: ReportingDeployment;
  sender: DelegatedSender;
  /** Gas units reserved per submission until the receipt shows actual use. */
  gasPerSubmission: number;
}

const done: JobOutcome = { status: "done" };
const PAUSED: JobOutcome = {
  status: "retry",
  errorCode: "publication_paused",
  delayMs: 5 * 60_000,
};

type Reservation =
  | { kind: "reserved"; attemptId: string }
  | { kind: "paused" }
  /** Consent or confirmation no longer holds; the consent path already stopped the report. */
  | { kind: "skipped" }
  /** The grant stopped being usable while the executor waited, for the named reason. */
  | { kind: "unusable"; reason: string };

/** The grant cannot carry this operation: record why and ask the owner to confirm again. */
function returnToOwner(
  core: ReportingCore,
  operation: OperationRecord,
  subject: OperationSubject,
  refusal: string
): JobOutcome {
  audit(core, "delegated_refused", { kind: "operation", id: operation.id }, { refusal });
  inTransaction(core.db, () => {
    if (operationById(core, operation.id)?.state !== "prepared") return;
    const owner = core.db
      .query("SELECT account_address FROM account_bindings WHERE id = $id")
      .get({ id: operation.authorAccountId }) as { account_address: string } | null;
    setOperationState(core, operation.id, "failed", { failureCode: `delegated_${refusal}` });
    subject.reopen(
      "grant_unavailable",
      owner?.account_address ?? null,
      `delegated:${operation.id}`
    );
  });
  return done;
}

function signedContext(attemptId: string): string {
  return `execution_attempts.signed:${attemptId}`;
}

async function submitSigned(
  deps: DelegatedDeps,
  operationId: string,
  attemptId: string
): Promise<JobOutcome> {
  const { core } = deps;
  const row = core.db
    .query("SELECT signed_operation_ciphertext FROM execution_attempts WHERE id = $id")
    .get({ id: attemptId }) as { signed_operation_ciphertext: string | null } | null;
  if (!row?.signed_operation_ciphertext) return done;
  const signed = core.keyring.open(row.signed_operation_ciphertext, signedContext(attemptId));
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

export async function executeDelegated(deps: DelegatedDeps, job: ClaimedJob): Promise<JobOutcome> {
  const { core } = deps;
  const current = operationById(core, job.subjectId);
  if (!current || current.authorizationMode !== "delegated" || !current.envelope) return done;

  // A signed attempt from before a restart is resubmitted as the same bytes, even while paused:
  // its first submission may already have landed, and identical bytes cannot publish twice.
  const previous = latestAttempt(core, current.id);
  if (previous?.state === "signed") return submitSigned(deps, current.id, previous.id);
  if (current.state !== "prepared") return done;

  const envelope = current.envelope;
  const subject = operationSubject(core, current);
  if (!subject) return done;
  if (!readControl(core, "publication").enabled) return PAUSED;
  const grant = liveGrant(core, {
    accountBindingId: current.authorAccountId,
    purpose: current.kind === "work" ? "reporting" : "review",
    chainId: current.chainId,
    gardenAddress: current.gardenAddress,
  });
  if (!grant) return returnToOwner(core, current, subject, "no_grant");
  const epoch = participantEpoch(core, subject.participantId);
  const refusal =
    grantUsability(grant, { identityEpoch: epoch, now: core.clock.now() }) ??
    (envelopeIssues(envelope, { deployment: deps.deployment, account: grant.policy.account })
      .length > 0 ||
    attestCallFailures(
      {
        purpose: grant.purpose,
        easAddress: grant.policy.easAddress as Hex,
        schemaUID: grant.policy.schemaUID,
        gardenAddress: grant.policy.gardenAddress as Hex,
      },
      { to: envelope.call.to, value: 0n, data: envelope.call.data }
    ).length > 0
      ? "outside_grant"
      : null);
  if (refusal) return returnToOwner(core, current, subject, refusal);
  try {
    const roles = await deps.chain.gardenRoles(
      current.chainId,
      current.gardenAddress,
      grant.policy.account
    );
    if (!(current.kind === "review" ? roles.operator : roles.gardener || roles.operator)) {
      return returnToOwner(core, current, subject, "role_missing");
    }
  } catch {
    return { status: "retry", errorCode: "dependency_unavailable", delayMs: 30_000 };
  }

  const reservation = inTransaction(core.db, (): Reservation => {
    const confirmation = confirmationById(core, current.confirmationId);
    if (!readControl(core, "publication").enabled) return { kind: "paused" };
    if (!confirmation || !subject.consented(confirmation.summaryDigest)) return { kind: "skipped" };
    const budget = core.db
      .query(
        `UPDATE execution_grants SET submissions_reserved = submissions_reserved + 1, gas_reserved = gas_reserved + $gas,
           version = version + 1, updated_at = $now
         WHERE id = $id AND state = 'active' AND valid_after <= $now AND valid_until > $now
           AND submissions_reserved + submissions_consumed < max_submissions
           AND gas_reserved + gas_consumed + $gas <= gas_cap`
      )
      .run({ id: grant.id, gas: deps.gasPerSubmission, now: core.clock.now() });
    // The reservation is the atomic gate: the window and budget are checked again at this instant.
    if (budget.changes !== 1) {
      const reason = grantUsability(grantById(core, grant.id), {
        identityEpoch: epoch,
        now: core.clock.now(),
      });
      return { kind: "unusable", reason: reason ?? "gas_exhausted" };
    }
    const attempt = reserveAttempt(core, {
      operation: current,
      expectedAttemptVersion: current.attemptVersion,
      payloadDigest: envelope.payloadDigest,
      mode: "delegated",
      grantId: grant.id,
      policyDigest: grant.policyDigest,
      identityEpoch: epoch,
      expectedAccount: grant.policy.account,
      fromBlock: null,
      gasReserved: deps.gasPerSubmission,
    });
    if (typeof attempt === "string") throw new Error(`Delegated reservation refused: ${attempt}`);
    subject.advance("ATTEMPT_RESERVED", false);
    return { kind: "reserved", attemptId: attempt.attempt.id };
  });
  if (reservation.kind === "paused") return PAUSED;
  if (reservation.kind === "unusable")
    return returnToOwner(core, current, subject, reservation.reason);
  if (reservation.kind === "skipped") return done;
  const reserved = reservation.attemptId;

  let signed: { userOperationHash: Hex; signedOperation: string };
  try {
    signed = await deps.sender.sign({ grant: grantById(core, grant.id) as GrantRecord, envelope });
  } catch {
    // Nothing left the executor: the reservation is released and the report waits for the owner.
    inTransaction(core.db, () => {
      updateAttempt(core, reserved, { state: "preparation_failed", reasonCode: "signing_failed" });
      core.db
        .query(
          `UPDATE execution_grants SET submissions_reserved = submissions_reserved - 1, gas_reserved = gas_reserved - $gas,
             version = version + 1 WHERE id = $id AND submissions_reserved > 0`
        )
        .run({ id: grant.id, gas: deps.gasPerSubmission });
      setOperationState(core, current.id, "failed", { failureCode: "signing_failed" });
      subject.reopen("preparation_failed", grant.policy.account, `delegated:${reserved}`);
    });
    return done;
  }
  inTransaction(core.db, () =>
    updateAttempt(core, reserved, {
      state: "signed",
      userOperationHash: signed.userOperationHash,
      signedOperation: core.keyring.seal(signed.signedOperation, signedContext(reserved)),
    })
  );
  const block = await deps.chain.blockNumber(current.chainId).catch(() => null);
  if (block !== null) {
    core.db
      .query(
        "UPDATE execution_attempts SET from_block = COALESCE(from_block, $block) WHERE id = $id"
      )
      .run({ id: reserved, block: Number(block) });
  }
  return submitSigned(deps, current.id, (attemptById(core, reserved) ?? { id: reserved }).id);
}
