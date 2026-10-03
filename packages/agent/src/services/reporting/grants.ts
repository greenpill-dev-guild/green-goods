import {
  type GrantPolicy,
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
import { audit } from "./participants";
import { grantPurposeOf } from "./grant-proposal";
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
  createSigner?: () => Promise<{ signerAddress: Hex; signerKeyRef: string }>;
  descriptorFor?: (policy: GrantPolicy, permissionId: Hex) => string;
}

export type GrantError =
  | "unsupported_scope"
  | "unavailable"
  | "conflict"
  | "stale_revision"
  | "forbidden"
  | "dependency_unavailable";

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
    if (
      grant.channelBindingId !== session.request.bindingId ||
      grantPurposeOf(session) !== grant.purpose
    ) {
      return { ok: false as const, errorCode: "forbidden" as const };
    }
    if (grant.policyDigest !== input.policyDigest)
      return { ok: false as const, errorCode: "stale_revision" as const };
    const enabled = core.db
      .query("SELECT enable_reference FROM execution_grants WHERE id = $id")
      .get({ id: grant.id }) as { enable_reference: string | null };
    if (
      ["enabling", "active"].includes(grant.state) &&
      enabled.enable_reference === input.enableReference
    ) {
      return { ok: true as const, grant };
    }
    const activation = core.db
      .query(`SELECT a.id FROM execution_attempts a JOIN execution_operations o ON o.id = a.operation_id
      WHERE a.execution_grant_id = $grant AND a.authorization_mode = 'activation' AND a.user_operation_hash = $hash
      AND (o.draft_id = $resource OR o.review_intent_id = $resource) AND a.state IN ('uncertain','broadcast','confirmed')`)
      .get({ grant: grant.id, hash: input.enableReference, resource: session.request.resourceId });
    if (!activation) return { ok: false as const, errorCode: "forbidden" as const };
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
  const first = core.db
    .query(`SELECT o.state, o.draft_id, a.state AS attempt_state FROM execution_attempts a
    JOIN execution_operations o ON o.id = a.operation_id WHERE a.execution_grant_id = $grant
    AND a.authorization_mode = 'activation' ORDER BY a.created_at DESC LIMIT 1`)
    .get({ grant: grant.id }) as {
    state: string;
    draft_id: string | null;
    attempt_state: string;
  } | null;
  if (!first || first.state !== "published" || first.attempt_state !== "confirmed")
    return { status: "retry", errorCode: "activation_receipt_pending", delayMs: 30_000 };
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
  if (grantById(core, grant.id)?.state !== "enabling") return { status: "done" };
  if (!installed) return { status: "retry", errorCode: "permission_pending", delayMs: 30_000 };
  inTransaction(core.db, () => {
    const moved = core.db
      .query(
        "UPDATE execution_grants SET state = 'active', version = version + 1, updated_at = $now WHERE id = $id AND state = 'enabling' AND valid_after <= $now AND valid_until > $now"
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
    const firstDraft = first.draft_id
      ? (core.db
          .query("SELECT conversation_id FROM work_drafts WHERE id = $id")
          .get({ id: first.draft_id }) as { conversation_id: string } | null)
      : null;
    if (firstDraft)
      participantWriter(core, {
        participantId: grant.participantId,
        conversationId: firstDraft.conversation_id,
        dedupePrefix: `grant-active:${grant.id}`,
      })?.say("grant.active", {
        garden: gardenLabel(core.gardens, grant.gardenAddress),
        until: new Date(grant.validUntil).toISOString().slice(0, 16).replace("T", " "),
      });
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
