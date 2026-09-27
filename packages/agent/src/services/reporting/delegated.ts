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
import { operationSubject } from "./operation-subjects";
import { operationById, setOperationState } from "./operations";
import { audit, participantEpoch } from "./participants";
import type { ReportingCore } from "./runtime";
import type { JobOutcome } from "./worker";

/**
 * The restricted executor for delegated publication. It reads a confirmed operation from its own
 * queue, never calldata from a model or browser, and before signing rechecks the grant, budget,
 * consent, role, epoch, publication switch and the exact envelope against the grant's call rules.
 * The signed operation and its hash are persisted before submission; after a crash only those same
 * bytes may be resubmitted, never a fresh signature, and an unknown outcome is reconciled.
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

  // A signed attempt from before a restart is resubmitted as the same bytes.
  const previous = latestAttempt(core, current.id);
  if (previous?.state === "signed") return submitSigned(deps, current.id, previous.id);
  if (current.state !== "prepared") return done;

  const envelope = current.envelope;
  const grant = liveGrant(core, {
    accountBindingId: current.authorAccountId,
    purpose: current.kind === "work" ? "reporting" : "review",
    chainId: current.chainId,
    gardenAddress: current.gardenAddress,
  });
  const subject = operationSubject(core, current);
  if (!subject || !grant) return done;
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
  if (refusal) {
    audit(core, "delegated_refused", { kind: "operation", id: current.id }, { refusal });
    return done;
  }
  try {
    const roles = await deps.chain.gardenRoles(
      current.chainId,
      current.gardenAddress,
      grant.policy.account
    );
    if (!(current.kind === "review" ? roles.operator : roles.gardener || roles.operator)) {
      audit(
        core,
        "delegated_refused",
        { kind: "operation", id: current.id },
        { refusal: "role_missing" }
      );
      return done;
    }
  } catch {
    return { status: "retry", errorCode: "dependency_unavailable", delayMs: 30_000 };
  }

  const reserved = inTransaction(core.db, () => {
    const confirmation = confirmationById(core, current.confirmationId);
    if (
      !confirmation ||
      !subject.consented(confirmation.summaryDigest) ||
      !readControl(core, "publication").enabled
    )
      return null;
    const budget = core.db
      .query(
        `UPDATE execution_grants SET submissions_reserved = submissions_reserved + 1, gas_reserved = gas_reserved + $gas,
           version = version + 1, updated_at = $now
         WHERE id = $id AND state = 'active' AND submissions_reserved + submissions_consumed < max_submissions
           AND gas_reserved + gas_consumed + $gas <= gas_cap`
      )
      .run({ id: grant.id, gas: deps.gasPerSubmission, now: core.clock.now() });
    if (budget.changes !== 1) return null;
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
    return attempt.attempt.id;
  });
  if (!reserved) return done;

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
