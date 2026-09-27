import {
  GRANT_LIMITS,
  type GrantPolicy,
  type GrantPurpose,
  grantPolicyDigest,
  grantPolicyIssues,
  isDelegationAvailable,
  type PermissionModuleEntry,
  type ReportingDeployment,
} from "@green-goods/shared/modules/agent-reporting";
import type { Hex } from "viem";
import type { ReportingChain } from "./chain";
import { commitLifecycle, lifecycleState } from "./coordinator/draft-commit";
import { gardenLabel } from "./coordinator/prompting";
import { inTransaction } from "./database";
import { loadDraft } from "./drafts";
import { grantById, type GrantRecord } from "./grants-store";
import { type ClaimedJob, enqueueJob } from "./jobs";
import { participantWriter } from "./notify";
import { upsertOperation } from "./operations";
import { audit, participantEpoch } from "./participants";
import { findGarden } from "./gardens";
import type { ReportingCore } from "./runtime";
import type { BrowserSession } from "./sessions";
import type { JobOutcome } from "./worker";

/**
 * Kernel execution grants from proposal to verified activation. The Agent builds the policy; the
 * owner authorizes exactly that digest; `active` is recorded only after the chain shows the
 * permission installed. A paused grant stops new execution at once. Everything here refuses to
 * run unless delegation is available for the chain, which requires a verified permission module.
 */
export interface GrantDeps {
  core: ReportingCore;
  chain: ReportingChain;
  deployment: ReportingDeployment;
  modules: readonly PermissionModuleEntry[];
  signerAddress: Hex;
  /** Cumulative gas units allowed per grant, from measured calls. */
  gasCap: number;
  /** Permission identifier the owner will install for this policy (Kernel adapter). */
  permissionIdFor: (policy: GrantPolicy) => Promise<Hex>;
}

export type GrantError =
  | "unsupported_scope"
  | "unavailable"
  | "conflict"
  | "stale_revision"
  | "forbidden";

function purposeOf(session: BrowserSession): GrantPurpose | null {
  const { purpose } = session.request;
  return purpose === "grant_reporting" ? "reporting" : purpose === "grant_review" ? "review" : null;
}

export async function proposeGrant(
  deps: GrantDeps,
  session: BrowserSession,
  gardenAddress: string
): Promise<{ ok: true; grant: GrantRecord } | { ok: false; errorCode: GrantError }> {
  const { core } = deps;
  const purpose = purposeOf(session);
  const module = deps.modules.find((entry) => entry.chainId === core.settings.chainId);
  if (
    !purpose ||
    session.accountKind !== "kernel" ||
    !module ||
    !isDelegationAvailable(core.settings.chainId, deps.modules)
  ) {
    return { ok: false, errorCode: "unsupported_scope" };
  }
  const garden = findGarden(core.gardens, gardenAddress);
  if (!garden) return { ok: false, errorCode: "unavailable" };
  const now = core.clock.now();
  const schema = purpose === "reporting" ? deps.deployment.work : deps.deployment.review;
  const policy: GrantPolicy = {
    version: 1,
    purpose,
    chainId: core.settings.chainId,
    account: session.account,
    gardenAddress: garden.address,
    easAddress: deps.deployment.easAddress,
    schemaUID: schema.schemaUID,
    signerAddress: deps.signerAddress,
    moduleRef: module.moduleRef,
    validAfter: now,
    validUntil: now + GRANT_LIMITS[purpose].durationMs,
    maxSubmissions: GRANT_LIMITS[purpose].maxSubmissions,
    gasCap: deps.gasCap,
  };
  if (grantPolicyIssues(policy).length > 0) return { ok: false, errorCode: "unsupported_scope" };
  const permissionId = await deps.permissionIdFor(policy);
  return inTransaction(core.db, () => {
    const binding = core.db
      .query(
        "SELECT id FROM channel_bindings WHERE participant_id = $participant AND status = 'active'"
      )
      .get({ participant: session.participantId }) as { id: string } | null;
    if (!binding) return { ok: false as const, errorCode: "forbidden" as const };
    const id = core.ids.id();
    try {
      core.db
        .query(
          `INSERT INTO execution_grants
             (id, purpose, participant_id, account_binding_id, channel_binding_id, identity_epoch, chain_id, garden_address,
              module_ref, permission_id, signer_key_ref, signer_address, policy_digest, policy_json, valid_after, valid_until,
              max_submissions, gas_cap, state, created_at, updated_at)
           VALUES ($id, $purpose, $participant, $account, $binding, $epoch, $chain, $garden, $module, $permission, $signerRef,
                   $signer, $digest, $policy, $after, $until, $max, $gas, 'owner_authorization_pending', $now, $now)`
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
          signerRef: `signer:${deps.signerAddress.toLowerCase()}`,
          signer: deps.signerAddress.toLowerCase(),
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

/** The owner authorized exactly this policy; installation is verified before activation. */
export function approveGrant(
  core: ReportingCore,
  session: BrowserSession,
  input: { grantId: string; expectedVersion: number; policyDigest: string; enableReference: Hex }
): { ok: true; grant: GrantRecord } | { ok: false; errorCode: GrantError } {
  return inTransaction(core.db, () => {
    const grant = grantById(core, input.grantId);
    if (!grant || grant.accountBindingId !== session.accountBindingId) {
      return { ok: false as const, errorCode: "unavailable" as const };
    }
    if (grant.policyDigest !== input.policyDigest)
      return { ok: false as const, errorCode: "stale_revision" as const };
    const moved = core.db
      .query(
        `UPDATE execution_grants SET state = 'enabling', enable_reference = $reference, version = version + 1, updated_at = $now
         WHERE id = $id AND version = $version AND state = 'owner_authorization_pending'`
      )
      .run({
        id: grant.id,
        version: input.expectedVersion,
        reference: input.enableReference,
        now: core.clock.now(),
      });
    if (moved.changes !== 1) return { ok: false as const, errorCode: "conflict" as const };
    enqueueJob(core, {
      kind: "reconcile_grant",
      subjectId: grant.id,
      dedupeKey: `grant-setup:${grant.id}:${input.enableReference}`,
      maxAttempts: 40,
    });
    return { ok: true as const, grant: grantById(core, grant.id) as GrantRecord };
  });
}

/** Stops new delegated execution immediately. Only on-chain revocation removes the key's power. */
export function pauseGrant(core: ReportingCore, grantId: string, participantId: string): boolean {
  const paused = core.db
    .query(
      `UPDATE execution_grants SET state = 'paused', version = version + 1, updated_at = $now
       WHERE id = $id AND participant_id = $participant AND state IN ('active','enabling','owner_authorization_pending')`
    )
    .run({ id: grantId, participant: participantId, now: core.clock.now() });
  if (paused.changes === 1) audit(core, "grant_paused", { kind: "grant", id: grantId });
  return paused.changes === 1;
}

/**
 * Verifies an owner's enable transaction by reading the installed permission. On success, reports
 * waiting for this grant continue without another confirmation: their digest, consent, role and
 * epoch are rechecked by preparation and the executor.
 */
export async function reconcileGrant(deps: GrantDeps, job: ClaimedJob): Promise<JobOutcome> {
  const { core } = deps;
  const grant = grantById(core, job.subjectId);
  if (!grant || grant.state !== "enabling" || !grant.permissionId) return { status: "done" };
  let installed: boolean;
  try {
    installed = await deps.chain.permissionInstalled(
      grant.chainId,
      grant.policy.account,
      grant.permissionId as Hex
    );
  } catch {
    return { status: "retry", errorCode: "dependency_unavailable", delayMs: 30_000 };
  }
  if (!installed) return { status: "retry", errorCode: "permission_pending", delayMs: 30_000 };
  inTransaction(core.db, () => {
    const moved = core.db
      .query(
        "UPDATE execution_grants SET state = 'active', version = version + 1, updated_at = $now WHERE id = $id AND state = 'enabling'"
      )
      .run({ id: grant.id, now: core.clock.now() });
    if (moved.changes !== 1) return;
    const waiting = core.db
      .query(
        `SELECT id FROM work_drafts WHERE participant_id = $participant AND lifecycle = 'open'
         AND json_extract(machine_snapshot, '$.value') = 'grantChoice'`
      )
      .all({ participant: grant.participantId }) as Array<{ id: string }>;
    for (const { id } of waiting) resumeWithGrant(core, id, grant);
  });
  return { status: "done" };
}

function resumeWithGrant(core: ReportingCore, draftId: string, grant: GrantRecord): void {
  const draft = loadDraft(core, draftId);
  const garden = draft?.content.garden;
  if (
    !draft ||
    lifecycleState(draft) !== "grantChoice" ||
    garden?.address.toLowerCase() !== grant.gardenAddress
  )
    return;
  const confirmation = core.db
    .query("SELECT id FROM confirmations WHERE draft_id = $id AND invalidated_at IS NULL")
    .get({ id: draft.id }) as { id: string } | null;
  if (!confirmation) return;
  commitLifecycle(core, draft, [{ type: "GRANT_READY" }], { participantAction: false });
  const operation = upsertOperation(core, {
    subject: { draftId: draft.id },
    authorAccountId: grant.accountBindingId,
    revision: draft.revision,
    confirmationId: confirmation.id,
    chainId: garden.chainId,
    gardenAddress: garden.address,
    mode: "delegated",
  });
  if (typeof operation === "string") return;
  enqueueJob(core, {
    kind: "prepare_operation",
    subjectId: draft.id,
    dedupeKey: `prepare:${operation.id}:${operation.version}`,
  });
  participantWriter(core, {
    participantId: draft.participantId,
    conversationId: draft.conversationId,
    dedupePrefix: `grant-active:${grant.id}`,
  })?.say("grant.active", {
    garden: gardenLabel(core.gardens, grant.gardenAddress),
    until: new Date(grant.validUntil).toISOString().slice(0, 16).replace("T", " "),
  });
}
