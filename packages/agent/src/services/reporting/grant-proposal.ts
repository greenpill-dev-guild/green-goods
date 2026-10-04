import {
  GRANT_LIMITS,
  type GrantPolicy,
  type GrantPurpose,
  grantPolicyDigest,
  grantPolicyIssues,
  isDelegationAvailable,
} from "@green-goods/shared/modules/agent-reporting";
import type { Hex } from "viem";
import { activeConsentId } from "./consent";
import { currentConfirmation } from "./confirmations";
import { inTransaction } from "./database";
import { loadDraft } from "./drafts";
import { findGarden } from "./gardens";
import type { GrantDeps, GrantError } from "./grants";
import { grantById, liveGrant, type GrantRecord } from "./grants-store";
import { participantEpoch } from "./participants";
import { loadReview } from "./reviews";
import type { BrowserSession } from "./sessions";

/** The sealed origin contains scope metadata, never an owner signature. */
export function grantOriginMatchesSession(
  core: GrantDeps["core"],
  session: BrowserSession,
  grantId: string
) {
  const stored = core.db
    .query("SELECT approval_ciphertext FROM execution_grants WHERE id = $id")
    .get({ id: grantId }) as { approval_ciphertext: string | null } | null;
  if (!stored?.approval_ciphertext) return false;
  const origin = JSON.parse(
    core.keyring.open(stored.approval_ciphertext, `execution_grants.activation-origin:${grantId}`)
  ) as { requestId: string; resourceId: string; revision: number };
  return (
    origin.requestId === session.request.id &&
    origin.resourceId === session.request.resourceId &&
    origin.revision === session.request.resourceRevision
  );
}

/** Builds only a role-authorized grant for the exact originally confirmed subject. */
export function grantPurposeOf(session: BrowserSession): GrantPurpose | null {
  const { purpose } = session.request;
  return purpose === "grant_reporting" ? "reporting" : purpose === "grant_review" ? "review" : null;
}

export async function proposeGrant(
  deps: GrantDeps,
  session: BrowserSession,
  gardenAddress: string
): Promise<{ ok: true; grant: GrantRecord } | { ok: false; errorCode: GrantError }> {
  const { core } = deps;
  const purpose = grantPurposeOf(session);
  const module = deps.modules.find((entry) => entry.chainId === core.settings.chainId);
  if (
    !purpose ||
    session.accountKind !== "kernel" ||
    !module ||
    !isDelegationAvailable(core.settings.chainId, deps.modules) ||
    (purpose === "review" && Boolean(module?.singleCallPolicy) && !module?.reviewSupported)
  ) {
    return { ok: false, errorCode: "unsupported_scope" };
  }
  const garden = findGarden(core.gardens, gardenAddress);
  if (!garden) return { ok: false, errorCode: "unavailable" };
  const now = core.clock.now();
  const existing = liveGrant(core, {
    accountBindingId: session.accountBindingId,
    purpose,
    chainId: core.settings.chainId,
    gardenAddress: garden.address,
  });
  if (existing)
    return existing.channelBindingId === session.request.bindingId &&
      existing.identityEpoch === session.identityEpoch &&
      grantOriginMatchesSession(core, session, existing.id)
      ? { ok: true, grant: existing }
      : { ok: false, errorCode: "forbidden" };
  const resourceId = session.request.resourceId;
  if (
    session.request.resourceKind !== "grant" ||
    !resourceId ||
    !activeConsentId(core, session.request.subjectId, "processing")
  )
    return { ok: false, errorCode: "forbidden" };
  const subject =
    purpose === "reporting" ? { draftId: resourceId } : { reviewIntentId: resourceId };
  const resource =
    purpose === "reporting" ? loadDraft(core, resourceId) : loadReview(core, resourceId);
  const confirmation = currentConfirmation(core, subject);
  const resourceGarden =
    resource &&
    ("snapshot" in resource ? resource.content.garden?.address : resource.content.gardenAddress);
  if (
    !resource ||
    !confirmation ||
    resource.participantId !== session.participantId ||
    resource.revision !== session.request.resourceRevision ||
    confirmation.revision !== resource.revision ||
    confirmation.accountBindingId !== session.accountBindingId ||
    confirmation.identityEpoch !== session.identityEpoch ||
    resourceGarden?.toLowerCase() !== garden.address.toLowerCase()
  )
    return { ok: false, errorCode: "forbidden" };
  try {
    const [kind, roles] = await Promise.all([
      deps.chain.accountKind(core.settings.chainId, session.account),
      deps.chain.gardenRoles(core.settings.chainId, garden.address, session.account),
    ]);
    if (
      kind !== "kernel" ||
      !(purpose === "review" ? roles.operator : roles.gardener || roles.operator)
    )
      return { ok: false, errorCode: "forbidden" };
    if (purpose === "review" && "workUID" in resource) {
      const work = await deps.chain.work(core.settings.chainId, resource.workUID as Hex);
      if (
        !work ||
        work.gardenAddress.toLowerCase() !== garden.address.toLowerCase() ||
        work.gardenerAddress.toLowerCase() === session.account.toLowerCase() ||
        resource.content.gardenerAddress.toLowerCase() === session.account.toLowerCase()
      )
        return { ok: false, errorCode: "forbidden" };
    }
  } catch {
    return { ok: false, errorCode: "dependency_unavailable" };
  }
  if (participantEpoch(core, session.participantId) !== session.identityEpoch)
    return { ok: false, errorCode: "forbidden" };
  const schema = purpose === "reporting" ? deps.deployment.work : deps.deployment.review;
  const signer = deps.createSigner
    ? await deps.createSigner()
    : {
        signerAddress: deps.signerAddress,
        signerKeyRef: `signer:${deps.signerAddress.toLowerCase()}`,
      };
  const policy: GrantPolicy = {
    version: 1,
    purpose,
    chainId: core.settings.chainId,
    account: session.account,
    gardenAddress: garden.address,
    easAddress: deps.deployment.easAddress,
    schemaUID: schema.schemaUID,
    signerAddress: signer.signerAddress,
    moduleRef: module.moduleRef,
    validAfter: now,
    validUntil: now + GRANT_LIMITS[purpose].durationMs,
    maxSubmissions: GRANT_LIMITS[purpose].maxSubmissions,
    gasCap: deps.gasCap,
    ...(module.singleCallPolicy ? { singleCallPolicy: module.singleCallPolicy } : {}),
    ...(module.approvedPaymaster ? { approvedPaymaster: module.approvedPaymaster } : {}),
    ...(module.gasCostCapsWei ? { gasCostCapWei: module.gasCostCapsWei[purpose] } : {}),
  };
  if (grantPolicyIssues(policy).length > 0) return { ok: false, errorCode: "unsupported_scope" };
  const permissionId = await deps.permissionIdFor(policy);
  if (core.clock.now() >= policy.validUntil) return { ok: false, errorCode: "unavailable" };
  const descriptor = deps.descriptorFor?.(policy, permissionId) ?? null;
  return inTransaction(core.db, () => {
    const binding = core.db
      .query(
        `SELECT id FROM channel_bindings WHERE id = $binding AND participant_id = $participant
         AND channel_subject_id = $subject AND status = 'active'`
      )
      .get({
        binding: session.request.bindingId,
        participant: session.participantId,
        subject: session.request.subjectId,
      }) as { id: string } | null;
    if (!binding || participantEpoch(core, session.participantId) !== session.identityEpoch)
      return { ok: false as const, errorCode: "forbidden" as const };
    const id = core.ids.id();
    try {
      core.db
        .query(
          `INSERT INTO execution_grants
             (id, purpose, participant_id, account_binding_id, channel_binding_id, identity_epoch, chain_id, garden_address,
              module_ref, permission_id, signer_key_ref, signer_address, policy_digest, policy_json, valid_after, valid_until,
              max_submissions, gas_cap, revocation_descriptor, approval_ciphertext, state, created_at, updated_at)
           VALUES ($id, $purpose, $participant, $account, $binding, $epoch, $chain, $garden, $module, $permission, $signerRef,
                   $signer, $digest, $policy, $after, $until, $max, $gas, $descriptor, $origin, 'owner_authorization_pending', $now, $now)`
        )
        .run({
          id,
          purpose,
          participant: session.participantId,
          account: session.accountBindingId,
          binding: binding.id,
          epoch: participantEpoch(core, session.participantId),
          chain: policy.chainId,
          garden: garden.address,
          module: module.moduleRef,
          permission: permissionId,
          signerRef: signer.signerKeyRef,
          signer: signer.signerAddress.toLowerCase(),
          descriptor,
          // Scope metadata only. The owner's enable signature is never held by the Agent.
          origin: core.keyring.seal(
            JSON.stringify({
              requestId: session.request.id,
              resourceId: session.request.resourceId,
              revision: session.request.resourceRevision,
            }),
            `execution_grants.activation-origin:${id}`
          ),
          digest: grantPolicyDigest(policy),
          policy: JSON.stringify(policy),
          after: policy.validAfter,
          until: policy.validUntil,
          max: policy.maxSubmissions,
          gas: policy.gasCap,
          now,
        });
    } catch (error) {
      if ((error as { code?: string }).code?.startsWith("SQLITE_CONSTRAINT")) {
        return { ok: false as const, errorCode: "conflict" as const };
      }
      throw error;
    }
    return { ok: true as const, grant: grantById(core, id) as GrantRecord };
  });
}
