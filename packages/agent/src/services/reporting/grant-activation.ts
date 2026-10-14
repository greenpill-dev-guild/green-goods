import type { AttemptOutcome, ResourceView } from "@green-goods/shared/modules/agent-reporting";
import { attemptById } from "./attempts";
import { currentConfirmation } from "./confirmations";
import { activeConsentId } from "./consent";
import { commitLifecycle, lifecycleState } from "./coordinator/draft-commit";
import { inTransaction } from "./database";
import type { DelegatedSender } from "./delegated";
import { DraftContentUnavailableError, loadDraft } from "./drafts";
import {
  ActivationBudgetError,
  recordOwnerOutcome,
  reserveOwnerAttempt,
  type ExecutionError,
} from "./execution";
import { approveGrant, type GrantDeps } from "./grants";
import { grantOriginMatchesSession } from "./grant-proposal";
import { gardenLabel } from "./coordinator/prompting";
import { grantById } from "./grants-store";
import { enqueueJob } from "./jobs";
import { operationForSubject, upsertOperation } from "./operations";
import { participantEpoch } from "./participants";
import { loadReview } from "./reviews";
import type { ReportingCore } from "./runtime";
import type { BrowserSession } from "./sessions";
import { draftView, reviewView, operationView } from "./views";

export interface GrantActivationDeps extends GrantDeps {
  sender: DelegatedSender;
  gasPerSubmission: number;
}

/** A grant session is translated only for its original confirmed resource, account and channel. */
export function activationContext(core: ReportingCore, session: BrowserSession, grantId: string) {
  const grant = grantById(core, grantId);
  const request = session.request;
  if (
    !grant ||
    session.accountKind !== "kernel" ||
    request.resourceKind !== "grant" ||
    !request.resourceId ||
    request.purpose !== (grant.purpose === "reporting" ? "grant_reporting" : "grant_review") ||
    grant.accountBindingId !== session.accountBindingId ||
    grant.participantId !== session.participantId ||
    grant.channelBindingId !== request.bindingId ||
    grant.identityEpoch !== session.identityEpoch ||
    participantEpoch(core, session.participantId) !== session.identityEpoch ||
    session.expiresAt <= core.clock.now()
  )
    return null;
  const binding = core.db
    .query(`SELECT id FROM channel_bindings WHERE id = $id AND participant_id = $participant
    AND channel_subject_id = $subject AND status = 'active'`)
    .get({ id: request.bindingId, participant: session.participantId, subject: request.subjectId });
  const access = core.db
    .query(
      "SELECT id FROM app_access_grants WHERE id = $id AND state = 'active' AND expires_at > $now"
    )
    .get({ id: session.accessId, now: core.clock.now() });
  if (!binding || !access) return null;
  if (!grantOriginMatchesSession(core, session, grantId)) return null;
  const subject =
    grant.purpose === "reporting"
      ? { draftId: request.resourceId }
      : { reviewIntentId: request.resourceId };
  const metadata = core.db
    .query(
      grant.purpose === "reporting"
        ? "SELECT id, participant_id, author_account_id AS owner, revision, garden_address FROM work_drafts WHERE id = $id"
        : `SELECT r.id, r.participant_id, r.steward_account_id AS owner, r.revision, w.garden_address
       FROM review_intents r JOIN work_records w ON w.chain_id = r.chain_id AND w.work_uid = r.work_uid WHERE r.id = $id`
    )
    .get({ id: request.resourceId }) as {
    id: string;
    participant_id: string;
    owner: string;
    revision: number;
    garden_address: string;
  } | null;
  const confirmation = currentConfirmation(core, subject);
  if (
    !metadata ||
    !confirmation ||
    metadata.participant_id !== session.participantId ||
    metadata.owner !== session.accountBindingId ||
    metadata.revision !== request.resourceRevision ||
    confirmation.revision !== metadata.revision ||
    confirmation.accountBindingId !== session.accountBindingId ||
    confirmation.identityEpoch !== session.identityEpoch ||
    metadata.garden_address.toLowerCase() !== grant.gardenAddress ||
    confirmation.gardenChainId !== grant.chainId ||
    confirmation.gardenAddress.toLowerCase() !== grant.gardenAddress
  )
    return null;
  const operation = operationForSubject(core, subject);
  let resource = null;
  try {
    resource =
      grant.purpose === "reporting"
        ? loadDraft(core, request.resourceId)
        : loadReview(core, request.resourceId);
  } catch (error) {
    if (!(error instanceof DraftContentUnavailableError)) throw error;
  }
  // Receipt truth survives private-content retention, but no purged subject can be prepared again.
  if (!resource && operation?.state !== "published") return null;
  const virtual: BrowserSession = {
    ...session,
    request: {
      ...request,
      resourceKind: grant.purpose === "reporting" ? "draft" : "review",
      purpose: grant.purpose === "reporting" ? "publish_work" : "review_decision",
    },
  };
  return {
    grant,
    resource,
    confirmation,
    subject,
    session: virtual,
    operation,
    resourceId: request.resourceId,
  };
}

export function activationView(
  core: ReportingCore,
  session: BrowserSession,
  grantId: string
): ResourceView | null {
  const context = activationContext(core, session, grantId);
  if (!context) return null;
  const view =
    context.grant.purpose === "reporting"
      ? draftView(core, context.resourceId)
      : reviewView(core, context.resourceId);
  if (view) return view;
  if (!context.operation || context.operation.state !== "published") return null;
  return {
    ok: true,
    kind: context.grant.purpose === "reporting" ? "draft" : "review",
    resourceId: context.resourceId,
    revision: context.operation.resourceRevision,
    state: "published",
    gardenLabel: gardenLabel(core.gardens, context.grant.gardenAddress),
    title: "",
    lines: [],
    evidence: [],
    summaryDigest: context.confirmation.summaryDigest as `0x${string}`,
    operation: operationView(core, context.operation),
  };
}

/** Recheck deployed account and current role; first review authority also forbids self-review. */
export async function activationAuthority(
  deps: GrantActivationDeps,
  session: BrowserSession,
  grantId: string
): Promise<ExecutionError | null> {
  const context = activationContext(deps.core, session, grantId);
  if (!context) return "unavailable";
  if (!activeConsentId(deps.core, session.request.subjectId, "processing")) return "forbidden";
  try {
    const [kind, roles] = await Promise.all([
      deps.chain.accountKind(context.grant.chainId, session.account),
      deps.chain.gardenRoles(context.grant.chainId, context.grant.gardenAddress, session.account),
    ]);
    if (
      kind !== "kernel" ||
      !(context.grant.purpose === "review" ? roles.operator : roles.gardener || roles.operator)
    )
      return "forbidden";
    if (context.grant.purpose === "review" && context.resource && "workUID" in context.resource) {
      const work = await deps.chain.work(
        context.grant.chainId,
        context.resource.workUID as `0x${string}`
      );
      if (
        !work ||
        work.gardenAddress.toLowerCase() !== context.grant.gardenAddress ||
        work.gardenerAddress.toLowerCase() === session.account.toLowerCase() ||
        context.resource.content.gardenerAddress.toLowerCase() === session.account.toLowerCase()
      )
        return "forbidden";
    }
  } catch {
    return "dependency_unavailable";
  }
  return activationContext(deps.core, session, grantId) ? null : "forbidden";
}

export async function startGrantActivation(
  deps: GrantActivationDeps,
  session: BrowserSession,
  grantId: string,
  input: { expectedVersion: number; policyDigest: string }
) {
  const refusal = await activationAuthority(deps, session, grantId);
  if (refusal) return { ok: false as const, errorCode: refusal };
  return inTransaction(deps.core.db, () => {
    const context = activationContext(deps.core, session, grantId);
    if (!context) return { ok: false as const, errorCode: "unavailable" as const };
    if (context.grant.policyDigest !== input.policyDigest)
      return { ok: false as const, errorCode: "stale_revision" as const };
    if (
      context.grant.state !== "owner_authorization_pending" ||
      context.grant.version !== input.expectedVersion
    )
      return { ok: false as const, errorCode: "conflict" as const };
    if (
      context.grant.purpose === "reporting" &&
      context.resource &&
      "snapshot" in context.resource &&
      lifecycleState(context.resource) === "grantChoice"
    ) {
      commitLifecycle(deps.core, context.resource, [{ type: "SIGN_ONCE_CHOSEN" }], {
        participantAction: true,
      });
      const operation = upsertOperation(deps.core, {
        subject: context.subject,
        authorAccountId: session.accountBindingId,
        revision: context.resource.revision,
        confirmationId: context.confirmation.id,
        chainId: context.grant.chainId,
        gardenAddress: context.grant.gardenAddress as `0x${string}`,
        mode: "owner",
      });
      if (typeof operation === "string") throw new Error("Activation operation unavailable");
      enqueueJob(deps.core, {
        kind: "prepare_operation",
        subjectId: context.resourceId,
        dedupeKey: `prepare:${operation.id}:${operation.version}`,
        payload: { activationGrantId: grantId },
      });
    } else if (!context.operation || context.operation.authorizationMode !== "owner")
      return { ok: false as const, errorCode: "conflict" as const };
    const resource = activationView(deps.core, session, grantId);
    return resource
      ? { ok: true as const, resource }
      : { ok: false as const, errorCode: "unavailable" as const };
  });
}

export async function reserveGrantActivation(
  deps: GrantActivationDeps,
  session: BrowserSession,
  grantId: string,
  input: { expectedAttemptVersion: number; payloadDigest: string }
) {
  const refusal = await activationAuthority(deps, session, grantId);
  if (refusal) return { ok: false as const, errorCode: refusal };
  const context = activationContext(deps.core, session, grantId);
  if (!context?.operation) return { ok: false as const, errorCode: "unavailable" as const };
  try {
    return await reserveOwnerAttempt(deps.core, deps.chain, {
      operationId: context.operation.id,
      session: context.session,
      ...input,
      activation: { grantId, gasReserved: deps.gasPerSubmission },
    });
  } catch (error) {
    if (error instanceof ActivationBudgetError)
      return { ok: false as const, errorCode: "conflict" as const };
    throw error;
  }
}

export function recordGrantActivationOutcome(
  core: ReportingCore,
  session: BrowserSession,
  grantId: string,
  input: {
    attemptId: string;
    idempotencyKey: string;
    payloadDigest: string;
    outcome: AttemptOutcome;
  }
) {
  return inTransaction(core.db, () => {
    const context = activationContext(core, session, grantId);
    const attempt = attemptById(core, input.attemptId);
    if (
      !context?.operation ||
      !attempt ||
      attempt.mode !== "activation" ||
      attempt.grantId !== grantId ||
      attempt.operationId !== context.operation.id
    )
      return { ok: false as const, errorCode: "unavailable" as const };
    if (
      (input.outcome.kind === "broadcast" || input.outcome.kind === "uncertain") &&
      (!attempt.userOperationHash ||
        input.outcome.userOperationHash?.toLowerCase() !== attempt.userOperationHash.toLowerCase())
    )
      return { ok: false as const, errorCode: "conflict" as const };
    const result = recordOwnerOutcome(core, {
      ...input,
      session: context.session,
      operationId: context.operation.id,
      activationGrantId: grantId,
    });
    if (!result.ok) return result;
    if (input.outcome.kind === "broadcast" || input.outcome.kind === "uncertain") {
      const approved = approveGrant(core, session, {
        grantId,
        expectedVersion: context.grant.version,
        policyDigest: context.grant.policyDigest,
        enableReference: attempt.userOperationHash as `0x${string}`,
      });
      if (!approved.ok && !["active", "enabling", "paused"].includes(context.grant.state))
        throw new Error("Activation outcome approval changed");
    }
    return result;
  });
}
