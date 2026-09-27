import type { Address } from "@green-goods/shared/types/domain";
import type { ReportingCore } from "./runtime";

/**
 * Participants, channel bindings and account bindings are separate because channel possession is
 * not signing authority and a person may replace a phone. A provisional participant owns drafts
 * from the moment processing consent is given; pairing activates the binding and records the
 * proven account. Every function expects the caller's transaction.
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
