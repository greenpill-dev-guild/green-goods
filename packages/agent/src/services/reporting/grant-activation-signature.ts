import {
  canonicalJson,
  type GrantActivationSignatureRequest,
} from "@green-goods/shared/modules/agent-reporting";
import type { Hex } from "viem";
import { attemptById, updateAttempt } from "./attempts";
import { readControl } from "./controls";
import { inTransaction } from "./database";
import {
  activationAuthority,
  activationContext,
  type GrantActivationDeps,
} from "./grant-activation";
import { approveGrant } from "./grants";
import { enqueueJob } from "./jobs";
import { operationSubject } from "./operation-subjects";
import { setOperationState } from "./operations";
import type { BrowserSession } from "./sessions";
import { createLogger } from "../logger";

const log = createLogger("reporting");

/** The sealed request locks one attempt to one exact operation before any async signer work. */
export async function signGrantActivation(
  deps: GrantActivationDeps,
  session: BrowserSession,
  grantId: string,
  input: GrantActivationSignatureRequest
) {
  const { core } = deps;
  const refusal = await activationAuthority(deps, session, grantId);
  if (refusal) return { ok: false as const, errorCode: refusal };
  if (!deps.sender.signActivation)
    return { ok: false as const, errorCode: "dependency_unavailable" as const };
  const request = canonicalJson(input.userOperation);
  const contextKey = `execution_attempts.activation:${input.attemptId}`;
  const claim = inTransaction(core.db, () => {
    const context = activationContext(core, session, grantId);
    const attempt = attemptById(core, input.attemptId);
    if (
      !context?.operation?.envelope ||
      !attempt ||
      attempt.operationId !== context.operation.id ||
      attempt.mode !== "activation" ||
      attempt.grantId !== grantId ||
      attempt.identityEpoch !== session.identityEpoch ||
      attempt.expectedAccount !== session.account.toLowerCase()
    )
      return { errorCode: "unavailable" as const };
    if (
      attempt.payloadDigest !== input.payloadDigest ||
      context.operation.payloadDigest !== input.payloadDigest
    )
      return { errorCode: "stale_revision" as const };
    const control = readControl(core, "publication");
    if (!control.enabled || control.version !== input.permitVersion)
      return { errorCode: "paused" as const };
    if (
      !["owner_authorization_pending", "enabling", "active"].includes(context.grant.state) ||
      core.clock.now() < context.grant.validAfter ||
      core.clock.now() >= context.grant.validUntil
    )
      return { errorCode: "forbidden" as const };
    const requestedGas = [
      input.userOperation.callGasLimit,
      input.userOperation.verificationGasLimit,
      input.userOperation.preVerificationGas,
      input.userOperation.paymasterVerificationGasLimit,
      input.userOperation.paymasterPostOpGasLimit,
    ].reduce((sum, value) => sum + BigInt(value), 0n);
    // What a live bundler asks for is what the reservation has to make room for. Neither figure
    // names anyone, so both go to the log whichever way this falls.
    const gas = { requestedGas: requestedGas.toString(), reservedGas: attempt.gasReserved };
    if (requestedGas > BigInt(attempt.gasReserved)) {
      log.warn(gas, "Refused a first report: its gas limits exceed the reservation");
      return { errorCode: "forbidden" as const };
    }
    log.info(gas, "A first report's gas limits fit the reservation");
    const stored = core.db
      .query("SELECT signed_operation_ciphertext FROM execution_attempts WHERE id = $id")
      .get({ id: attempt.id }) as { signed_operation_ciphertext: string | null };
    if (stored.signed_operation_ciphertext) {
      const prior = JSON.parse(
        core.keyring.open(stored.signed_operation_ciphertext, contextKey)
      ) as { request: string; delegateSignature?: Hex };
      if (prior.request !== request) return { errorCode: "conflict" as const };
      if (prior.delegateSignature) return { delegateSignature: prior.delegateSignature };
      return { errorCode: "conflict" as const };
    }
    if (
      attempt.state !== "wallet_pending" ||
      context.operation.state !== "sending" ||
      context.grant.state !== "owner_authorization_pending" ||
      core.clock.now() >= context.grant.validUntil
    )
      return { errorCode: "conflict" as const };
    const subject = operationSubject(core, context.operation);
    if (!subject?.consented(context.confirmation.summaryDigest))
      return { errorCode: "forbidden" as const };
    const lock = core.keyring.seal(JSON.stringify({ request }), contextKey);
    core.db
      .query(
        "UPDATE execution_attempts SET signed_operation_ciphertext = $lock WHERE id = $id AND signed_operation_ciphertext IS NULL"
      )
      .run({ id: attempt.id, lock });
    return { context, lock };
  });
  if ("errorCode" in claim) return { ok: false as const, errorCode: claim.errorCode ?? "conflict" };
  if ("delegateSignature" in claim)
    return { ok: true as const, delegateSignature: claim.delegateSignature };
  const releaseLock = () =>
    core.db
      .query(`UPDATE execution_attempts SET signed_operation_ciphertext = NULL
    WHERE id = $id AND signed_operation_ciphertext = $lock AND state = 'wallet_pending'`)
      .run({ id: input.attemptId, lock: claim.lock });
  let signed: { userOperationHash: Hex; delegateSignature: Hex };
  try {
    signed = await deps.sender.signActivation({
      grant: claim.context.grant,
      envelope: claim.context.operation!.envelope!,
      userOperation: input.userOperation,
    });
  } catch {
    releaseLock();
    return { ok: false as const, errorCode: "dependency_unavailable" as const };
  }
  const after = await activationAuthority(deps, session, grantId);
  if (after) {
    releaseLock();
    return { ok: false as const, errorCode: after };
  }
  return inTransaction(core.db, () => {
    const fresh = activationContext(core, session, grantId);
    const attempt = attemptById(core, input.attemptId);
    const control = readControl(core, "publication");
    if (!control.enabled || control.version !== input.permitVersion) {
      releaseLock();
      return { ok: false as const, errorCode: "paused" as const };
    }
    if (
      !fresh?.operation ||
      !attempt ||
      attempt.state !== "wallet_pending" ||
      fresh.grant.state !== "owner_authorization_pending" ||
      core.clock.now() >= fresh.grant.validUntil ||
      !operationSubject(core, fresh.operation)?.consented(fresh.confirmation.summaryDigest)
    ) {
      releaseLock();
      return { ok: false as const, errorCode: "conflict" as const };
    }
    updateAttempt(core, attempt.id, {
      state: "uncertain",
      reasonCode: "grant_activation_signed",
      userOperationHash: signed.userOperationHash,
      signedOperation: core.keyring.seal(JSON.stringify({ request, ...signed }), contextKey),
    });
    setOperationState(core, fresh.operation.id, "reconciling");
    operationSubject(core, fresh.operation)?.advance("OUTCOME_UNCERTAIN", true);
    const approved = approveGrant(core, session, {
      grantId,
      expectedVersion: fresh.grant.version,
      policyDigest: fresh.grant.policyDigest,
      enableReference: signed.userOperationHash,
    });
    if (!approved.ok) throw new Error("Activation approval changed during signature persistence");
    enqueueJob(core, {
      kind: "reconcile_operation",
      subjectId: fresh.operation.id,
      dedupeKey: `reconcile:${attempt.id}`,
      maxAttempts: 40,
    });
    return { ok: true as const, delegateSignature: signed.delegateSignature };
  });
}
