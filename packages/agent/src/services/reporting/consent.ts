import type { ReportingCore } from "./runtime";

/**
 * Processing consent and publication consent are separate records. Processing consent lets the
 * agent read and interpret a conversation; publication consent is scoped to one report revision
 * and digest and is the only thing that lets evidence become public. Withdrawal is recorded, never
 * deleted, and is honored again at every dispatch boundary.
 */
export type ConsentPurpose = "processing" | "publication" | "voice";

export function activeConsentId(
  core: ReportingCore,
  subjectId: string,
  purpose: Exclude<ConsentPurpose, "publication">
): string | null {
  const row = core.db
    .query(
      `SELECT id FROM consent_records
       WHERE channel_subject_id = $subject AND purpose = $purpose AND withdrawn_at IS NULL
       ORDER BY granted_at DESC LIMIT 1`
    )
    .get({ subject: subjectId, purpose }) as { id: string } | null;
  return row?.id ?? null;
}

export function grantConsent(
  core: ReportingCore,
  input: {
    subjectId: string;
    participantId: string | null;
    purpose: Exclude<ConsentPurpose, "publication">;
    sourceEventId: string | null;
  }
): string {
  const id = core.ids.id();
  core.db
    .query(
      `INSERT INTO consent_records
         (id, channel_subject_id, participant_id, purpose, notice_version, source_event_id, granted_at)
       VALUES ($id, $subject, $participant, $purpose, $notice, $source, $now)`
    )
    .run({
      id,
      subject: input.subjectId,
      participant: input.participantId,
      purpose: input.purpose,
      notice: core.settings.noticeVersion,
      source: input.sourceEventId,
      now: core.clock.now(),
    });
  return id;
}

export function grantPublicationConsent(
  core: ReportingCore,
  input: {
    subjectId: string;
    participantId: string;
    resourceKind: "draft" | "review";
    resourceId: string;
    revision: number;
    digest: string;
    sourceEventId: string;
  }
): string {
  const id = core.ids.id();
  core.db
    .query(
      `INSERT INTO consent_records
         (id, channel_subject_id, participant_id, purpose, notice_version, resource_kind, resource_id,
          resource_revision, resource_digest, source_event_id, granted_at)
       VALUES ($id, $subject, $participant, 'publication', $notice, $kind, $resource, $revision, $digest, $source, $now)`
    )
    .run({
      id,
      subject: input.subjectId,
      participant: input.participantId,
      notice: core.settings.noticeVersion,
      kind: input.resourceKind,
      resource: input.resourceId,
      revision: input.revision,
      digest: input.digest,
      source: input.sourceEventId,
      now: core.clock.now(),
    });
  return id;
}

/** True only for an unwithdrawn publication consent naming exactly this revision and digest. */
export function hasPublicationConsent(
  core: ReportingCore,
  resourceId: string,
  revision: number,
  digest: string
): boolean {
  const row = core.db
    .query(
      `SELECT 1 AS ok FROM consent_records
       WHERE purpose = 'publication' AND resource_id = $resource AND resource_revision = $revision
         AND resource_digest = $digest AND withdrawn_at IS NULL LIMIT 1`
    )
    .get({ resource: resourceId, revision, digest }) as { ok: number } | null;
  return row !== null;
}

export function withdrawConsent(
  core: ReportingCore,
  subjectId: string,
  purposes: readonly ConsentPurpose[],
  source: string
): number {
  const placeholders = purposes.map((_, index) => `$p${index}`).join(",");
  const params: Record<string, string | number> = {
    subject: subjectId,
    now: core.clock.now(),
    source,
  };
  purposes.forEach((purpose, index) => {
    params[`p${index}`] = purpose;
  });
  return core.db
    .query(
      `UPDATE consent_records SET withdrawn_at = $now, withdrawal_source = $source
       WHERE channel_subject_id = $subject AND withdrawn_at IS NULL AND purpose IN (${placeholders})`
    )
    .run(params).changes;
}
