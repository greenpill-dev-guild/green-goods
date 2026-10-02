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
import { type ClaimedJob } from "./jobs";
import { type OperationSubject, operationSubject } from "./operation-subjects";
import { type OperationRecord, operationById, setOperationState } from "./operations";
import { audit, participantEpoch } from "./participants";
import type { ReportingCore } from "./runtime";
import type { JobOutcome } from "./worker";
import { grantOriginMatches, PAUSED, signedContext, submitSigned } from "./delegated-submit";

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
    nonceRef?: string;
    onPrepared?: (nonce: bigint) => Promise<void>;
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

type Reservation =
  | { kind: "reserved"; attemptId: string }
  | { kind: "paused" }
  | { kind: "nonce_pending" }
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

export async function executeDelegated(deps: DelegatedDeps, job: ClaimedJob): Promise<JobOutcome> {
  const { core } = deps;
  const current = operationById(core, job.subjectId);
  if (!current || current.authorizationMode !== "delegated" || !current.envelope) return done;

  // A restart may reconcile old bytes; sending them still requires current authority.
  const previous = latestAttempt(core, current.id);
  if (previous?.state === "signed") return submitSigned(deps, current.id, previous.id);
  if (previous?.state === "reserved" && previous.grantId) {
    const reservedGrant = grantById(core, previous.grantId);
    const reservedSubject = operationSubject(core, current);
    if (!readControl(core, "publication").enabled) return PAUSED;
    if (
      !reservedGrant ||
      !reservedSubject ||
      reservedGrant.state !== "active" ||
      core.clock.now() < reservedGrant.validAfter ||
      core.clock.now() >= reservedGrant.validUntil ||
      reservedGrant.identityEpoch !== participantEpoch(core, reservedSubject.participantId) ||
      !grantOriginMatches(core, reservedGrant, reservedSubject)
    )
      return done;
    // No bytes can leave the signer until signed state/ciphertext/hash are durable. A crashed
    // reservation therefore resumes the same attempt and persisted nonce, without another budget.
    return signReserved(deps, current, previous.id, reservedGrant, reservedSubject);
  }
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
  if (!grantOriginMatches(core, grant, subject))
    return returnToOwner(core, current, subject, "channel_changed");
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
    const pending = core.db
      .query(
        "SELECT id FROM execution_attempts WHERE execution_grant_id = $grant AND state IN ('reserved','signed','broadcast','uncertain') LIMIT 1"
      )
      .get({ grant: grant.id });
    if (pending) return { kind: "nonce_pending" };
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
  if (reservation.kind === "nonce_pending")
    return { status: "retry", errorCode: "grant_nonce_pending", delayMs: 30_000 };
  if (reservation.kind === "unusable")
    return returnToOwner(core, current, subject, reservation.reason);
  if (reservation.kind === "skipped") return done;
  const reserved = reservation.attemptId;

  return signReserved(deps, current, reserved, grant, subject);
}

async function signReserved(
  deps: DelegatedDeps,
  current: OperationRecord,
  reserved: string,
  grant: GrantRecord,
  subject: OperationSubject
): Promise<JobOutcome> {
  const { core } = deps;
  let signed: { userOperationHash: Hex; signedOperation: string };
  try {
    const savedNonce = core.db
      .query("SELECT nonce_ref FROM execution_attempts WHERE id = $id")
      .get({ id: reserved }) as { nonce_ref: string | null };
    signed = await deps.sender.sign({
      grant: grantById(core, grant.id) as GrantRecord,
      envelope: current.envelope as PublicationEnvelope,
      ...(savedNonce.nonce_ref ? { nonceRef: savedNonce.nonce_ref } : {}),
      onPrepared: async (nonce) => {
        const changed = core.db
          .query(
            "UPDATE execution_attempts SET nonce_ref = $nonce WHERE id = $id AND state = 'reserved' AND (nonce_ref IS NULL OR nonce_ref = $nonce)"
          )
          .run({ id: reserved, nonce: nonce.toString() });
        if (changed.changes !== 1) throw new Error("Nonce reservation changed");
      },
    });
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
