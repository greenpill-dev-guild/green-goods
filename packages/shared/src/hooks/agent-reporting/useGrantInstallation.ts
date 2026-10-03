import { useCallback, useRef, type RefObject } from "react";
import type { Address, Hex } from "viem";
import type {
  AccessResponse,
  GrantView,
  ResourceView,
  OperationView,
  AttemptOutcome,
} from "../../modules/agent-reporting/api-contract";
import type { CeremonyClient } from "../../modules/agent-reporting/ceremony-client";
import {
  descriptorMatchesPolicy,
  grantPolicyDigest,
  revocationDescriptorIssues,
} from "../../modules/agent-reporting/grants";
import { sendBrowserGrantActivation } from "../../modules/agent-reporting/browser-grant-activation";
import {
  assertSmartAccountClient,
  assertSmartAccountClientResolverActive,
} from "../../modules/auth/smartAccountClientResolver";
import { assertLocalArbitrumForkSmartAccountsDisabled } from "../../modules/transactions/local-fork-safety";
import { useAuthState } from "../../providers/Auth";
import { getPrimaryAddress } from "../auth/usePrimaryAddress";
import { issuesFor, stageForOperation, stageForGrant, type CeremonyStage } from "./ceremony-stage";
import { persistRevocationDescriptor } from "../../modules/agent-reporting/permission-management";
import type { TransactionSender } from "../../modules/transactions/types";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import {
  readCeremony,
  writeCeremony,
  type CeremonyFailure,
  type StoredCeremony,
} from "./ceremony-storage";

/** A failed Agent delivery retains the original public chain reference and blocks reinstallation. */
export async function resumeGrantInstallation(
  client: CeremonyClient,
  requestId: string,
  stored: StoredCeremony
) {
  const activation = stored.pendingGrantActivation;
  if (activation) {
    await client
      .reportGrantActivationOutcome(activation.grantId, activation.request)
      .then(() => {
        if (activation.request.outcome.kind !== "uncertain")
          writeCeremony(requestId, { accessId: stored.accessId });
      })
      .catch(() => undefined);
    const grant = await client.grant(activation.grantId).catch(() => null);
    return grant
      ? readGrantActivationState(client, requestId, grant)
      : {
          grant: null,
          stage: "grant_submitted" as CeremonyStage,
          error: "outcome_unknown" as const,
        };
  }
  const pending = stored.pendingGrant;
  if (!pending) return null;
  try {
    await client.approveGrant(pending, pending.enableReference);
    writeCeremony(requestId, { accessId: stored.accessId });
    return null;
  } catch {
    const grant = await client.grant(pending.grantId).catch(() => null);
    return grant
      ? grantInstallationState(requestId, grant)
      : { grant, stage: "grant_submitted" as CeremonyStage, error: "outcome_unknown" as const };
  }
}

/** Clear uncertainty only for this exact policy once the Agent reports a reconciled state. */
function grantInstallationState(requestId: string, grant: GrantView) {
  const stored = readCeremony(requestId);
  const pending = stored?.pendingGrant;
  const activation = stored?.pendingGrantActivation;
  const matches =
    (pending?.grantId === grant.grantId && pending.policyDigest === grant.policyDigest) ||
    (activation?.grantId === grant.grantId && activation.policyDigest === grant.policyDigest);
  const authoritative =
    matches && ["active", "paused", "failed", "expired", "revoked"].includes(grant.state);
  if (authoritative) writeCeremony(requestId, { accessId: stored?.accessId });
  const undelivered = Boolean(pending || activation) && !authoritative;
  const error: CeremonyFailure | null = undelivered
    ? "outcome_unknown"
    : grant.state === "paused"
      ? "paused"
      : grant.state === "expired"
        ? "expired"
        : grant.state === "revoked"
          ? "changed"
          : null;
  return {
    grant,
    stage: undelivered ? ("grant_submitted" as CeremonyStage) : stageForGrant(grant.state),
    error,
  };
}

/** A GET can restore an existing first report, but never creates or signs one. */
export async function readGrantActivationState(
  client: CeremonyClient,
  requestId: string,
  grant: GrantView
) {
  const installed = grantInstallationState(requestId, grant);
  const resource = await client.grantActivation(grant.grantId).catch(() => null);
  if (!resource) return installed;
  const operation = resource.operation;
  const operationStage = stageForOperation(operation);
  const stage: CeremonyStage =
    installed.stage !== "grant_ready"
      ? installed.stage
      : operationStage === "submitted"
        ? "grant_submitted"
        : operationStage === "loading" || !operation
          ? "loading"
          : operationStage === "failed" && !operation.envelope
            ? "failed"
            : "grant_ready";
  return {
    ...installed,
    resource,
    operation,
    stage,
    error:
      operation?.attempt?.state === "uncertain" ? ("outcome_unknown" as const) : installed.error,
  };
}

/** First freezes a report for review, then enables its permission and publishes on a second action. */
export function useGrantInstallation({
  account,
  client,
  requestId,
  sender,
  stateRef,
  update,
}: {
  account: Address | null;
  client: CeremonyClient;
  requestId: string;
  sender: TransactionSender | null;
  stateRef: RefObject<{
    grant: GrantView | null;
    access: AccessResponse | null;
    resource: ResourceView | null;
  }>;
  update: (next: {
    stage?: CeremonyStage;
    error?: CeremonyFailure | null;
    grant?: GrantView;
    resource?: ResourceView;
    operation?: OperationView | null;
  }) => void;
}) {
  const auth = useAuthState();
  const authRef = useRef(auth);
  authRef.current = auth;
  const busy = useRef(false);
  return useCallback(async () => {
    const { grant, access, resource } = stateRef.current;
    if (busy.current || !grant || !access || !grant.permissionId || !grant.revocationDescriptor)
      return;
    if (!["proposed", "owner_authorization_pending"].includes(grant.state))
      return update({ stage: stageForGrant(grant.state) });
    if (Date.now() >= grant.policy.validUntil)
      return update({ stage: "unavailable", error: "expired" });
    const stored = readCeremony(requestId);
    if (stored?.pendingGrant || stored?.pendingGrantActivation)
      return update({ stage: "grant_submitted", error: "outcome_unknown" });
    if (account?.toLowerCase() !== grant.policy.account.toLowerCase())
      return update({ error: "wrong_account" });
    if (
      grantPolicyDigest(grant.policy) !== grant.policyDigest ||
      revocationDescriptorIssues(grant.revocationDescriptor).length ||
      !descriptorMatchesPolicy(grant.revocationDescriptor, grant.policy, grant.permissionId)
    )
      return update({ error: "envelope_mismatch" });
    busy.current = true;
    let delegateRequested = false;
    let broadcast = false;
    let knownHash: Hex | null = null;
    let attemptId: string | null = null;
    let payloadDigest: Hex | null = null;
    const outcomeRequest = (outcome: AttemptOutcome) => ({
      attemptId: attemptId as string,
      payloadDigest: payloadDigest as Hex,
      idempotencyKey: `${attemptId}:${outcome.kind}`,
      outcome,
    });
    const remember = (outcome: AttemptOutcome) =>
      writeCeremony(requestId, {
        accessId: access.accessId,
        pendingGrantActivation: {
          grantId: grant.grantId,
          policyDigest: grant.policyDigest,
          request: outcomeRequest(outcome),
        },
      });
    const report = async (outcome: AttemptOutcome) => {
      remember(outcome);
      await client.reportGrantActivationOutcome(grant.grantId, outcomeRequest(outcome));
      if (outcome.kind !== "uncertain") writeCeremony(requestId, { accessId: access.accessId });
    };
    try {
      // This first explicit action prepares the summary only. It cannot prompt or sign.
      if (!resource) {
        update({ stage: "loading", error: null });
        const frozen = await client.startGrantActivation(grant);
        update({
          resource: frozen,
          operation: frozen.operation,
          stage:
            stageForOperation(frozen.operation) === "submitted"
              ? "grant_submitted"
              : frozen.operation?.envelope
                ? "grant_ready"
                : "loading",
        });
        return;
      }
      const operation = resource.operation;
      const envelope = operation?.envelope;
      if (!operation || !envelope || issuesFor(operation).length || !sender)
        return update({ error: "envelope_mismatch" });
      payloadDigest = envelope.payloadDigest;
      update({ stage: "grant_signing", error: null });
      const attempt = await client.reserveGrantActivationAttempt(grant.grantId, {
        expectedAttemptVersion: operation.attemptVersion,
        payloadDigest,
        idempotencyKey: crypto.randomUUID(),
      });
      attemptId = attempt.attemptId;
      if (attempt.payloadDigest !== payloadDigest) throw new Error("Activation payload changed");
      await assertLocalArbitrumForkSmartAccountsDisabled();
      const captured = authRef.current;
      const resolve = captured.resolveSmartAccountClient;
      const ownerClient = resolve
        ? await resolve(grant.policy.chainId)
        : captured.smartAccountClient;
      if (!ownerClient) throw new Error("Owner Kernel client unavailable");
      const assertOwner = () => {
        const current = authRef.current;
        assertSmartAccountClientResolverActive(resolve);
        const currentAddress = getPrimaryAddress(
          current.authMode,
          current.walletAddress,
          current.smartAccountAddress,
          current.embeddedAddress
        );
        if (
          currentAddress?.toLowerCase() !== grant.policy.account.toLowerCase() ||
          current.resolveSmartAccountClient !== resolve ||
          current.smartAccountClient !== captured.smartAccountClient
        )
          throw new Error("Owner session changed");
        assertSmartAccountClient(ownerClient, grant.policy.chainId, grant.policy.account);
        if (Date.now() >= grant.policy.validUntil) throw new Error("Permission expired");
      };
      persistRevocationDescriptor(grant.revocationDescriptor);
      const hash = await sendBrowserGrantActivation({
        ownerClient,
        policy: grant.policy,
        permissionId: grant.permissionId,
        envelope,
        assertOwner,
        signDelegate: async (userOperation) => {
          delegateRequested = true;
          remember({ kind: "uncertain", reason: "send_unknown" });
          return client.signGrantActivation(grant.grantId, {
            attemptId: attempt.attemptId,
            permitVersion: attempt.permitVersion,
            payloadDigest: attempt.payloadDigest,
            userOperation,
          });
        },
        onBeforeBroadcast: (hash) => {
          broadcast = true;
          knownHash = hash;
          remember({ kind: "uncertain", reason: "send_unknown", userOperationHash: hash });
        },
      });
      await report({ kind: "broadcast", userOperationHash: hash });
      update({ stage: "grant_submitted", error: null });
    } catch (error) {
      const uncertain = delegateRequested || broadcast;
      if (attemptId && payloadDigest) {
        const outcome: AttemptOutcome = uncertain
          ? {
              kind: "uncertain",
              reason: "send_unknown",
              ...(knownHash ? { userOperationHash: knownHash } : {}),
            }
          : isCancelledTxError(error)
            ? { kind: "rejected_before_send", reason: "user_rejected" }
            : { kind: "preparation_failed", reason: "activation_unavailable" };
        await report(outcome).catch(() => undefined);
      }
      if (!uncertain && resource) {
        const fresh = await readGrantActivationState(client, requestId, grant);
        update({ ...fresh, error: isCancelledTxError(error) ? "declined" : "unsupported" });
        return;
      }
      update({
        stage: uncertain ? "grant_submitted" : "grant_ready",
        error: uncertain
          ? "outcome_unknown"
          : isCancelledTxError(error)
            ? "declined"
            : "unsupported",
      });
    } finally {
      busy.current = false;
    }
  }, [account, client, requestId, sender, stateRef, update]);
}
