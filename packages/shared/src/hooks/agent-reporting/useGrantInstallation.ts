import { useCallback, type RefObject } from "react";
import { createPublicClient, http, type Address } from "viem";
import { getChain } from "../../config/chains";
import { getRpcUrl } from "../../utils/blockchain/chain-registry";
import type { AccessResponse, GrantView } from "../../modules/agent-reporting/api-contract";
import type { CeremonyClient } from "../../modules/agent-reporting/ceremony-client";
import {
  descriptorMatchesPolicy,
  grantPolicyDigest,
  revocationDescriptorIssues,
} from "../../modules/agent-reporting/grants";
import { grantInstallCall } from "../../modules/agent-reporting/kernel-permissions";
import { persistRevocationDescriptor } from "../../modules/agent-reporting/permission-management";
import type { TransactionSender } from "../../modules/transactions/types";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import { stageForGrant, type CeremonyStage } from "./ceremony-stage";
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
export function grantInstallationState(requestId: string, grant: GrantView) {
  const stored = readCeremony(requestId);
  const pending = stored?.pendingGrant;
  const matches = pending?.grantId === grant.grantId && pending.policyDigest === grant.policyDigest;
  const authoritative =
    matches && ["active", "paused", "failed", "expired", "revoked"].includes(grant.state);
  if (authoritative) writeCeremony(requestId, { accessId: stored?.accessId });
  const undelivered = Boolean(pending) && !authoritative;
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

/** Installs only the approved, locally reconstructed authority and retains uncertain references. */
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
  stateRef: RefObject<{ grant: GrantView | null; access: AccessResponse | null }>;
  update: (next: {
    stage?: CeremonyStage;
    error?: CeremonyFailure | null;
    grant?: GrantView;
  }) => void;
}) {
  const installGrant = useCallback(async () => {
    const { grant, access } = stateRef.current;
    if (!grant || !access || !sender || !grant.permissionId || !grant.revocationDescriptor) return;
    if (Date.now() >= grant.policy.validUntil)
      return update({ stage: "unavailable", error: "expired" });
    if (readCeremony(requestId)?.pendingGrant)
      return update({ stage: "grant_submitted", error: "outcome_unknown" });
    if (account?.toLowerCase() !== grant.policy.account.toLowerCase())
      return update({ error: "wrong_account" });
    if (
      grantPolicyDigest(grant.policy) !== grant.policyDigest ||
      revocationDescriptorIssues(grant.revocationDescriptor).length ||
      !descriptorMatchesPolicy(grant.revocationDescriptor, grant.policy, grant.permissionId)
    ) {
      return update({ error: "envelope_mismatch" });
    }
    update({ stage: "grant_signing", error: null });
    let broadcast = false;
    let reported = false;
    let knownReference: `0x${string}` | null = null;
    const reportReference = async (hash: `0x${string}`) => {
      // Prefer the sender's first reference (often a UserOperation hash) to its later receipt.
      knownReference ??= hash;
      writeCeremony(requestId, {
        accessId: access.accessId,
        pendingGrant: {
          grantId: grant.grantId,
          version: grant.version,
          policyDigest: grant.policyDigest,
          enableReference: knownReference,
        },
      });
      update({ stage: "grant_submitted" });
      const approved = await client.approveGrant(grant, knownReference).catch(() => null);
      if (approved) {
        reported = true;
        writeCeremony(requestId, { accessId: access.accessId });
        update({ grant: approved });
      }
    };
    try {
      const clientChain = createPublicClient({
        chain: getChain(grant.policy.chainId),
        transport: http(getRpcUrl(grant.policy.chainId)),
      });
      const call = await grantInstallCall(clientChain, grant.policy, grant.permissionId);
      if (Date.now() >= grant.policy.validUntil)
        return update({ stage: "unavailable", error: "expired" });
      persistRevocationDescriptor(grant.revocationDescriptor);
      const result = await sender.sendContractCall(call, {
        assertOwnership: () => sender.assertOwnership?.(grant.policy.account, grant.policy.chainId),
        onBeforeBroadcast: async (reference) => {
          broadcast = true;
          if (reference) {
            knownReference = reference.hash;
            writeCeremony(requestId, {
              accessId: access.accessId,
              pendingGrant: {
                grantId: grant.grantId,
                version: grant.version,
                policyDigest: grant.policyDigest,
                enableReference: reference.hash,
              },
            });
          }
        },
        onBroadcastReference: (reference) => reportReference(reference.hash),
      });
      // A wallet sender may report only its transaction result; repeating the same approval is
      // harmless (the route accepts the same enable reference) and never creates new authority.
      if (!reported) await reportReference(result.hash);
      update({ stage: "grant_submitted" });
    } catch (error) {
      if (!broadcast && isCancelledTxError(error))
        return update({ stage: "grant_ready", error: "declined" });
      update({
        stage: broadcast ? "grant_submitted" : "grant_ready",
        error: broadcast ? "outcome_unknown" : "unsupported",
      });
    }
  }, [account, client, requestId, sender, stateRef, update]);
  return installGrant;
}
