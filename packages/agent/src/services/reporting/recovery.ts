import type { BrowserChallenge, ProofResult } from "./browser-access";
import { withdrawConsent } from "./consent";
import {
  type ContinuationRequest,
  hashSecret,
  issueContinuation,
  requestById,
} from "./continuations";
import type { TurnWriter } from "./coordinator/writer";
import { conversationRealm, participantWriter } from "./notify";
import { activeAccount, attachProvisionalChannel, audit, bindingForSubject } from "./participants";
import { destinationAvailable, recoverySources } from "./recovery-channels";
import type { ReportingCore } from "./runtime";
import { revokeParticipantSessions } from "./sessions";

/**
 * Replacing one channel's chat, started from the new chat and proven twice: the
 * owner signs with the account already linked elsewhere, then types the code sent to the new chat
 * into the same browser. Replacement commits once, at the epoch observed when the owner proved the
 * account, so of two concurrent recoveries only one can win. The old chat loses access, browser
 * sessions end and reporting permissions pause; that channel's unfinished drafts follow the owner.
 * Other channels keep their bindings, consent and conversations at the newly fenced epoch.
 */
const MAX_CODE_ATTEMPTS = 5;

interface RecoveryRow {
  id: string;
  request_id: string;
  new_channel_subject_id: string;
  new_conversation_id: string;
  participant_id: string | null;
  account_binding_id: string | null;
  expected_epoch: number | null;
  state:
    | "started"
    | "account_verified"
    | "channel_verified"
    | "confirmed"
    | "applied"
    | "expired"
    | "failed";
  channel_code_hash: string | null;
  channel_attempts: number;
  expires_at: number;
}

function recoveryFor(core: ReportingCore, requestId: string): RecoveryRow | null {
  return core.db
    .query("SELECT * FROM recovery_requests WHERE request_id = $request")
    .get({ request: requestId }) as RecoveryRow | null;
}

/** `RECOVER` from a consented chat that has no linked account yet. */
export function startRecovery(writer: TurnWriter): void {
  const { core, ctx } = writer;
  const binding = ctx.binding;
  if (!binding) return writer.say("help");
  if (ctx.account) return writer.say("recovery.alreadyLinked", { account: ctx.account.address });
  // The recovered owner's drafts move here; a second open draft in this chat would collide.
  if (ctx.draft) return writer.say("recovery.draftOpen");
  const now = core.clock.now();
  const recoveryId = core.ids.id();
  const { request, url } = issueContinuation(core, {
    purpose: "recovery",
    participantId: binding.participantId,
    subjectId: ctx.subjectId,
    bindingId: binding.bindingId,
    conversationId: ctx.conversationId,
    providerRealm: conversationRealm(core, ctx.conversationId),
    resourceKind: "recovery",
    resourceId: recoveryId,
    resourceRevision: null,
    resourceDigest: `recovery:${recoveryId}`,
    expectedAccount: null,
    identityEpoch: binding.identityEpoch,
    ttlMs: core.settings.recoveryTtlMs,
  });
  core.db
    .query(
      `INSERT INTO recovery_requests (id, request_id, new_channel_subject_id, new_conversation_id, state, created_at, expires_at)
       VALUES ($id, $request, $subject, $conversation, 'started', $now, $expires)`
    )
    .run({
      id: recoveryId,
      request: request.id,
      subject: ctx.subjectId,
      conversation: ctx.conversationId,
      now,
      expires: request.expiresAt,
    });
  writer.say("recovery.started", {}, { url, label: writer.text("recovery.label") });
}

/**
 * The owner proved an account in the recovery browser. Only an account already linked to another
 * participant qualifies; the response never says why another account failed. Old access is
 * suspended now, and the possession code goes to the new chat, never to the browser.
 */
export function verifyRecoveryProof(
  core: ReportingCore,
  request: ContinuationRequest,
  challenge: BrowserChallenge,
  proof: { account: string; kind: "eoa" | "kernel" }
): ProofResult {
  const recovery = recoveryFor(core, request.id);
  const owner = core.db
    .query(
      `SELECT a.id, a.participant_id, p.identity_epoch FROM account_bindings a JOIN participants p ON p.id = a.participant_id
       WHERE a.chain_id = $chain AND a.account_address = $account AND a.status = 'active' AND p.status = 'active'`
    )
    .get({ chain: core.settings.chainId, account: proof.account }) as {
    id: string;
    participant_id: string;
    identity_epoch: number;
  } | null;
  if (
    !recovery ||
    recovery.state !== "started" ||
    !owner ||
    owner.participant_id === request.participantId
  ) {
    return { ok: false, errorCode: "forbidden" };
  }
  const sources = recoverySources(core, owner.participant_id, recovery.new_channel_subject_id);
  const target = bindingForSubject(core, recovery.new_channel_subject_id);
  if (
    target?.bindingId !== request.bindingId ||
    target.participantId !== request.participantId ||
    target.identityEpoch !== request.identityEpoch
  )
    return { ok: false, errorCode: "conflict" };
  if (sources.subjects.length === 0) return { ok: false, errorCode: "forbidden" };
  if (
    !destinationAvailable(
      core,
      owner.participant_id,
      recovery.new_channel_subject_id,
      recovery.new_conversation_id,
      sources
    )
  )
    return { ok: false, errorCode: "conflict" };
  const now = core.clock.now();
  const consumed = core.db
    .query(
      `UPDATE browser_challenges SET state = 'proof_verified', verified_account = $account, verified_account_kind = $kind,
         verified_at = $now WHERE id = $id AND state = 'issued' AND expires_at > $now
         AND EXISTS (SELECT 1 FROM continuation_requests WHERE id = $request AND state = 'open' AND expires_at > $now)`
    )
    .run({ id: challenge.id, request: request.id, account: proof.account, kind: proof.kind, now });
  if (consumed.changes !== 1) return { ok: false, errorCode: "conflict" };
  const code = core.ids.code(6);
  core.db
    .query(
      `UPDATE recovery_requests SET state = 'account_verified', participant_id = $participant, account_binding_id = $account,
         expected_epoch = $epoch, channel_code_hash = $code WHERE id = $id AND state = 'started'`
    )
    .run({
      id: recovery.id,
      participant: owner.participant_id,
      account: owner.id,
      epoch: owner.identity_epoch,
      code: hashSecret(code),
    });
  suspendOldAccess(core, owner.participant_id, sources.subjects);
  participantWriter(core, {
    participantId: request.participantId as string,
    conversationId: recovery.new_conversation_id,
    dedupePrefix: `recovery:${recovery.id}`,
  })?.say("recovery.code", { code });
  audit(core, "recovery_account_verified", { kind: "recovery", id: recovery.id });
  return { ok: true, state: "proof_verified" };
}

function suspendOldAccess(core: ReportingCore, participantId: string, subjects: string[]): void {
  const now = core.clock.now();
  for (const subject of subjects)
    core.db
      .query(
        "UPDATE channel_bindings SET status = 'suspended' WHERE participant_id = $participant AND channel_subject_id = $subject AND status = 'active'"
      )
      .run({ participant: participantId, subject });
  revokeParticipantSessions(core, participantId);
  core.db
    .query(
      `UPDATE execution_grants SET state = 'paused', version = version + 1, updated_at = $now
       WHERE participant_id = $participant AND state = 'active'`
    )
    .run({ participant: participantId, now });
}

export type RecoveryStep =
  | { ok: true; state: RecoveryRow["state"]; account: string | null }
  | { ok: false; errorCode: "forbidden" | "conflict" | "unavailable" };

/** Possession of the new chat: the code it received, typed into the same verified browser. */
export function confirmRecoveryChannel(
  core: ReportingCore,
  challenge: BrowserChallenge,
  code: string
): RecoveryStep {
  const recovery = recoveryFor(core, challenge.requestId);
  if (!recovery || recovery.expires_at <= core.clock.now())
    return { ok: false, errorCode: "unavailable" };
  if (recovery.state !== "account_verified" || challenge.state !== "proof_verified")
    return { ok: false, errorCode: "conflict" };
  if (recovery.channel_attempts >= MAX_CODE_ATTEMPTS) return { ok: false, errorCode: "forbidden" };
  if (recovery.channel_code_hash !== hashSecret(code)) {
    core.db
      .query("UPDATE recovery_requests SET channel_attempts = channel_attempts + 1 WHERE id = $id")
      .run({ id: recovery.id });
    return { ok: false, errorCode: "forbidden" };
  }
  core.db
    .query(
      "UPDATE recovery_requests SET state = 'channel_verified' WHERE id = $id AND state = 'account_verified'"
    )
    .run({ id: recovery.id });
  return { ok: true, state: "channel_verified", account: challenge.verifiedAccount };
}

/**
 * Applies the replacement at the expected epoch. A replay after a lost response returns the
 * applied state without repeating anything; a concurrent recovery that already moved the epoch
 * makes this one fail.
 */
export function applyRecovery(core: ReportingCore, challenge: BrowserChallenge): RecoveryStep {
  const recovery = recoveryFor(core, challenge.requestId);
  if (!recovery) return { ok: false, errorCode: "unavailable" };
  if (recovery.state === "applied")
    return { ok: true, state: "applied", account: challenge.verifiedAccount };
  if (recovery.state !== "channel_verified" || recovery.expires_at <= core.clock.now())
    return { ok: false, errorCode: "conflict" };
  const participantId = recovery.participant_id as string;
  const target = bindingForSubject(core, recovery.new_channel_subject_id);
  const request = requestById(core, recovery.request_id);
  if (
    !request ||
    target?.bindingId !== request.bindingId ||
    target.participantId !== request.participantId ||
    target.identityEpoch !== request.identityEpoch
  )
    return { ok: false, errorCode: "conflict" };
  const sources = recoverySources(core, participantId, recovery.new_channel_subject_id);
  if (
    !target ||
    !destinationAvailable(
      core,
      participantId,
      recovery.new_channel_subject_id,
      recovery.new_conversation_id,
      sources
    )
  )
    return { ok: false, errorCode: "conflict" };
  const now = core.clock.now();
  const moved = core.db
    .query(
      `UPDATE participants SET identity_epoch = identity_epoch + 1, status = 'active', updated_at = $now
       WHERE id = $id AND identity_epoch = $expected`
    )
    .run({ id: participantId, expected: recovery.expected_epoch, now });
  if (moved.changes !== 1) {
    core.db
      .query("UPDATE recovery_requests SET state = 'failed' WHERE id = $id")
      .run({ id: recovery.id });
    return { ok: false, errorCode: "conflict" };
  }
  const epoch = (recovery.expected_epoch as number) + 1;
  for (const subject of sources.subjects)
    core.db
      .query(
        `UPDATE channel_bindings SET status = 'replaced', ended_at = $now
       WHERE participant_id = $participant AND channel_subject_id = $subject AND status IN ('active','suspended')`
      )
      .run({ participant: participantId, subject, now });
  // The old chat is no longer this owner's; it would start over with a fresh notice.
  for (const subject of sources.subjects) {
    withdrawConsent(core, subject, ["processing", "voice"], "relinked");
  }
  if (
    !attachProvisionalChannel(core, {
      participantId: target.participantId,
      canonicalParticipantId: participantId,
      subjectId: recovery.new_channel_subject_id,
      requestId: recovery.request_id,
    })
  ) {
    // Preconditions were checked before the epoch transition, inside the same transaction.
    throw new Error("Recovery target could not be consolidated");
  }
  core.db
    .query(
      `UPDATE channel_bindings SET identity_epoch = $epoch
       WHERE participant_id = $participant AND status IN ('provisional','active')`
    )
    .run({
      participant: participantId,
      epoch,
    });
  core.db
    .query("UPDATE channel_bindings SET status = 'active', verified_at = $now WHERE id = $id")
    .run({ id: target.bindingId, now });
  for (const table of ["work_drafts", "review_intents"])
    for (const conversation of sources.conversations) {
      core.db
        .query(
          `UPDATE ${table} SET conversation_id = $conversation WHERE participant_id = $participant AND lifecycle = 'open' AND conversation_id = $oldConversation`
        )
        .run({
          conversation: recovery.new_conversation_id,
          participant: participantId,
          oldConversation: conversation,
        });
    }
  core.db
    .query(
      `UPDATE continuation_requests SET state = CASE WHEN id = $request THEN 'completed' ELSE 'revoked' END,
         completed_at = CASE WHEN id = $request THEN $now ELSE completed_at END
       WHERE state = 'open' AND (participant_id = $participant OR id = $request)`
    )
    .run({ request: recovery.request_id, participant: participantId, now });
  core.db
    .query("UPDATE browser_challenges SET state = 'paired', paired_at = $now WHERE id = $id")
    .run({ id: challenge.id, now });
  core.db
    .query("UPDATE recovery_requests SET state = 'applied', applied_at = $now WHERE id = $id")
    .run({ id: recovery.id, now });
  revokeParticipantSessions(core, participantId);
  participantWriter(core, {
    participantId,
    conversationId: recovery.new_conversation_id,
    dedupePrefix: `recovered:${recovery.id}`,
  })?.say("recovery.completed");
  audit(core, "recovery_applied", { kind: "participant", id: participantId }, { epoch });
  return {
    ok: true,
    state: "applied",
    account: activeAccount(core, participantId, core.settings.chainId)?.address ?? null,
  };
}

export function recoveryState(core: ReportingCore, challenge: BrowserChallenge): RecoveryStep {
  const recovery = recoveryFor(core, challenge.requestId);
  return recovery
    ? { ok: true, state: recovery.state, account: challenge.verifiedAccount }
    : { ok: false, errorCode: "unavailable" };
}
