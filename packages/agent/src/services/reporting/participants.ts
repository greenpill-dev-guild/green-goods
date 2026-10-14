import type { Address } from "@green-goods/shared/types/domain";
import type { ReportingCore } from "./runtime";

/**
 * Participants, channel bindings and account bindings are separate because channel possession is
 * not signing authority and a person may replace a phone. A provisional participant owns drafts
 * from the moment processing consent is given; pairing activates the binding and records the
 * proven account. Telegram and WhatsApp may share that proven participant while each conversation
 * keeps its own draft. Every function expects the caller's transaction.
 */
export interface ParticipantBinding {
  participantId: string;
  bindingId: string;
  bindingStatus: "provisional" | "active" | "suspended";
  identityEpoch: number;
  locale: string | null;
}

export interface AccountBinding {
  id: string;
  participantId: string;
  chainId: number;
  address: Address;
  kind: "eoa" | "kernel";
}

export function bindingForSubject(
  core: ReportingCore,
  subjectId: string
): ParticipantBinding | null {
  const row = core.db
    .query(
      `SELECT b.id AS binding_id, b.status, b.identity_epoch, p.id AS participant_id, p.locale
       FROM channel_bindings b JOIN participants p ON p.id = b.participant_id
       WHERE b.channel_subject_id = $subject AND b.status IN ('provisional','active','suspended')`
    )
    .get({ subject: subjectId }) as {
    binding_id: string;
    status: ParticipantBinding["bindingStatus"];
    identity_epoch: number;
    participant_id: string;
    locale: string | null;
  } | null;
  return row
    ? {
        participantId: row.participant_id,
        bindingId: row.binding_id,
        bindingStatus: row.status,
        identityEpoch: row.identity_epoch,
        locale: row.locale,
      }
    : null;
}

/** Creates the provisional participant and binding once processing consent exists. */
export function ensureParticipant(
  core: ReportingCore,
  subjectId: string,
  locale: string | null
): ParticipantBinding {
  const existing = bindingForSubject(core, subjectId);
  if (existing) return existing;
  const now = core.clock.now();
  const participantId = core.ids.id();
  const bindingId = core.ids.id();
  core.db
    .query(
      `INSERT INTO participants (id, identity_epoch, status, locale, created_at, updated_at)
       VALUES ($id, 1, 'provisional', $locale, $now, $now)`
    )
    .run({ id: participantId, locale, now });
  core.db
    .query(
      `INSERT INTO channel_bindings (id, participant_id, channel_subject_id, status, identity_epoch, created_at)
       VALUES ($id, $participant, $subject, 'provisional', 1, $now)`
    )
    .run({ id: bindingId, participant: participantId, subject: subjectId, now });
  // A consented sender is no longer provisional intake; its identity outlives the pre-consent window.
  core.db
    .query("UPDATE channel_subjects SET expires_at = NULL WHERE id = $id")
    .run({ id: subjectId });
  return { participantId, bindingId, bindingStatus: "provisional", identityEpoch: 1, locale };
}

export function activeAccount(
  core: ReportingCore,
  participantId: string,
  chainId: number
): AccountBinding | null {
  const row = core.db
    .query(
      `SELECT id, participant_id, chain_id, account_address, account_kind FROM account_bindings
       WHERE participant_id = $participant AND chain_id = $chain AND status = 'active'`
    )
    .get({ participant: participantId, chain: chainId }) as {
    id: string;
    participant_id: string;
    chain_id: number;
    account_address: Address;
    account_kind: "eoa" | "kernel";
  } | null;
  return row
    ? {
        id: row.id,
        participantId: row.participant_id,
        chainId: row.chain_id,
        address: row.account_address,
        kind: row.account_kind,
      }
    : null;
}

export function accountById(core: ReportingCore, accountBindingId: string): AccountBinding | null {
  const row = core.db
    .query(
      `SELECT id, participant_id, chain_id, account_address, account_kind, status FROM account_bindings
       WHERE id = $id`
    )
    .get({ id: accountBindingId }) as {
    id: string;
    participant_id: string;
    chain_id: number;
    account_address: Address;
    account_kind: "eoa" | "kernel";
    status: string;
  } | null;
  return row && row.status === "active"
    ? {
        id: row.id,
        participantId: row.participant_id,
        chainId: row.chain_id,
        address: row.account_address,
        kind: row.account_kind,
      }
    : null;
}

export function participantEpoch(core: ReportingCore, participantId: string): number {
  const row = core.db
    .query("SELECT identity_epoch FROM participants WHERE id = $id")
    .get({ id: participantId }) as { identity_epoch: number } | null;
  if (!row) throw new Error("Participant does not exist");
  return row.identity_epoch;
}

/** A channel family, not a bot/business realm: replacing a Telegram bot still needs recovery. */
export function subjectChannel(core: ReportingCore, subjectId: string): string | null {
  const row = core.db
    .query("SELECT provider_realm FROM channel_subjects WHERE id = $id")
    .get({ id: subjectId }) as { provider_realm: string } | null;
  return row?.provider_realm.split(":")[0] ?? null;
}

/**
 * After wallet proof and same-chat pairing, attach a new channel to the wallet's existing person.
 * Only a provisional person with this one channel and no signing history can be consolidated.
 * Conversation IDs and binding IDs stay stable; the existing person's locale remains authoritative.
 * The caller owns the transaction and must already have matched the verified browser's code.
 */
export function attachProvisionalChannel(
  core: ReportingCore,
  input: {
    participantId: string;
    canonicalParticipantId: string;
    subjectId: string;
    requestId: string;
  }
): boolean {
  const { participantId, canonicalParticipantId, subjectId, requestId } = input;
  const binding = bindingForSubject(core, subjectId);
  const provisional = core.db
    .query("SELECT status FROM participants WHERE id = $id")
    .get({ id: participantId }) as { status: string } | null;
  const canonical = core.db
    .query("SELECT status, identity_epoch FROM participants WHERE id = $id")
    .get({ id: canonicalParticipantId }) as { status: string; identity_epoch: number } | null;
  const channel = subjectChannel(core, subjectId);
  if (
    !channel ||
    provisional?.status !== "provisional" ||
    canonical?.status !== "active" ||
    binding?.participantId !== participantId ||
    binding.bindingStatus !== "provisional"
  )
    return false;
  const established = core.db
    .query(`SELECT 1 FROM account_bindings WHERE participant_id = $participant
    UNION ALL SELECT 1 FROM execution_grants WHERE participant_id = $participant
    UNION ALL SELECT 1 FROM app_access_grants WHERE participant_id = $participant
    UNION ALL SELECT 1 FROM review_intents WHERE participant_id = $participant
    UNION ALL SELECT 1 FROM channel_bindings WHERE participant_id = $participant AND channel_subject_id <> $subject
    UNION ALL SELECT 1 FROM work_drafts d WHERE d.participant_id = $participant AND
      (d.author_account_id IS NOT NULL OR EXISTS (SELECT 1 FROM execution_operations o WHERE o.draft_id = d.id))
    LIMIT 1`)
    .get({ participant: participantId, subject: subjectId });
  if (established) return false;
  const recovering = core.db
    .query(`SELECT 1 FROM recovery_requests WHERE participant_id = $participant
    AND state IN ('account_verified','channel_verified','confirmed') AND expires_at > $now`)
    .get({ participant: canonicalParticipantId, now: core.clock.now() });
  // The recovery applying this exact request is already authorized; another pending move is not.
  if (
    recovering &&
    !core.db
      .query(`SELECT 1 FROM recovery_requests WHERE request_id = $request
    AND participant_id = $participant AND state = 'channel_verified'`)
      .get({ request: requestId, participant: canonicalParticipantId })
  )
    return false;
  const existingChannels = core.db
    .query(`SELECT s.provider_realm FROM channel_bindings b
    JOIN channel_subjects s ON s.id = b.channel_subject_id
    WHERE b.participant_id = $participant AND b.status IN ('provisional','active','suspended')`)
    .all({ participant: canonicalParticipantId }) as Array<{ provider_realm: string }>;
  if (existingChannels.some((row) => row.provider_realm.split(":")[0] === channel)) return false;
  const collision = core.db
    .query(`SELECT 1 FROM work_drafts p JOIN work_drafts c ON c.conversation_id = p.conversation_id
    WHERE p.participant_id = $provisional AND c.participant_id = $canonical AND p.lifecycle = 'open' AND c.lifecycle = 'open'`)
    .get({ provisional: participantId, canonical: canonicalParticipantId });
  if (collision) return false;
  const params = {
    provisional: participantId,
    canonical: canonicalParticipantId,
    subject: subjectId,
  };
  for (const table of ["consent_records", "source_entries", "conversation_prompts"]) {
    core.db
      .query(`UPDATE ${table} SET participant_id = $canonical
      WHERE participant_id = $provisional AND channel_subject_id = $subject`)
      .run(params);
  }
  for (const table of ["work_drafts", "media_assets"]) {
    core.db
      .query(`UPDATE ${table} SET participant_id = $canonical WHERE participant_id = $provisional
      AND conversation_id IN (SELECT conversation_id FROM inbox_events WHERE channel_subject_id = $subject)`)
      .run(params);
  }
  core.db
    .query(`UPDATE delivery_outbox SET participant_id = $canonical,
    identity_epoch = CASE WHEN channel_binding_id IS NOT NULL THEN $epoch ELSE identity_epoch END
    WHERE participant_id = $provisional AND channel_subject_id = $subject`)
    .run({ ...params, epoch: canonical.identity_epoch });
  core.db
    .query(`UPDATE continuation_requests SET participant_id = $canonical, identity_epoch = $epoch
    WHERE participant_id = $provisional AND channel_subject_id = $subject`)
    .run({ ...params, epoch: canonical.identity_epoch });
  // Other verified browser candidates signed the provisional epoch. They must prove again.
  core.db
    .query(`UPDATE browser_challenges SET state = 'superseded' WHERE state IN ('issued','proof_verified')
    AND request_id <> $request AND request_id IN (SELECT id FROM continuation_requests WHERE channel_subject_id = $subject)`)
    .run({ request: requestId, subject: subjectId });
  core.db
    .query(`UPDATE continuation_requests SET state = 'revoked'
    WHERE channel_subject_id = $subject AND id <> $request AND state = 'open'`)
    .run({ request: requestId, subject: subjectId });
  core.db
    .query(`UPDATE channel_bindings SET participant_id = $canonical, identity_epoch = $epoch
    WHERE id = $id AND status = 'provisional'`)
    .run({
      id: binding.bindingId,
      canonical: canonicalParticipantId,
      epoch: canonical.identity_epoch,
    });
  core.db
    .query("UPDATE participants SET status = 'deleted', updated_at = $now WHERE id = $id")
    .run({ id: participantId, now: core.clock.now() });
  audit(core, "channel_attached", { kind: "participant", id: canonicalParticipantId }, { channel });
  return true;
}

export function setParticipantLocale(
  core: ReportingCore,
  participantId: string,
  locale: string
): void {
  core.db
    .query("UPDATE participants SET locale = $locale, updated_at = $now WHERE id = $id")
    .run({ id: participantId, locale, now: core.clock.now() });
}

export function audit(
  core: ReportingCore,
  kind: string,
  subject: { kind: string; id: string } | null,
  detail: Record<string, string | number | boolean | null> = {}
): void {
  core.db
    .query(
      `INSERT INTO audit_events (id, kind, subject_kind, subject_id, detail_json, created_at)
       VALUES ($id, $kind, $subjectKind, $subjectId, $detail, $now)`
    )
    .run({
      id: core.ids.id(),
      kind,
      subjectKind: subject?.kind ?? null,
      subjectId: subject?.id ?? null,
      detail: JSON.stringify(detail),
      now: core.clock.now(),
    });
}
