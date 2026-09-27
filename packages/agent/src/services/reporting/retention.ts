import { commitLifecycle } from "./coordinator/draft-commit";
import { inTransaction } from "./database";
import { DraftContentUnavailableError, loadDraft } from "./drafts";
import { type ClaimedJob, enqueueJob } from "./jobs";
import type { PrivateMediaStore } from "./media-store";
import { participantWriter } from "./notify";
import { audit } from "./participants";
import type { ReportingCore } from "./runtime";
import type { JobOutcome } from "./worker";

/**
 * Durable, idempotent cleanup. A purge removes private content — source text, revision content,
 * provider payloads, sent message copies and private media objects — and keeps tombstones: IDs,
 * digests, consent and operation receipts. It never touches an operation's sealed envelope, so an
 * uncertain attempt can still be reconciled, and it never promises to remove public copies.
 *
 * Scopes: `draft` after publication, cancellation or expiry; `participant` for DELETE. The sweep
 * expires 24-hour pre-consent intake and drafts inactive for seven days of participant time.
 */
export interface RetentionDeps {
  core: ReportingCore;
  media: PrivateMediaStore;
}

const done: JobOutcome = { status: "done" };

/** States a draft can expire from: nothing has been reserved or sent. */
const EXPIRABLE =
  "json_extract(machine_snapshot, '$.value') IN ('collecting','review','authority','grantChoice','preparing','preparationFailed','awaitingWallet','delegatedPreflight')";

async function deleteObjects(deps: RetentionDeps, where: string, params: Record<string, string>) {
  const { core } = deps;
  const assets = core.db
    .query(
      `SELECT id, private_object_ciphertext, sanitized_object_ciphertext FROM media_assets
       WHERE deleted_at IS NULL AND (${where})`
    )
    .all(params) as Array<{
    id: string;
    private_object_ciphertext: string | null;
    sanitized_object_ciphertext: string | null;
  }>;
  for (const asset of assets) {
    const objects = [
      asset.private_object_ciphertext &&
        core.keyring.open(asset.private_object_ciphertext, `media_assets.private:${asset.id}`),
      asset.sanitized_object_ciphertext &&
        core.keyring.open(asset.sanitized_object_ciphertext, `media_assets.sanitized:${asset.id}`),
    ];
    for (const key of objects) if (key) await deps.media.delete(key);
    inTransaction(core.db, () =>
      core.db
        .query(
          `UPDATE media_assets SET private_object_ciphertext = NULL, sanitized_object_ciphertext = NULL,
             provider_ref_ciphertext = NULL, processing_manifest = '{}', state = 'deleted',
             deleted_at = $now, updated_at = $now
           WHERE id = $id`
        )
        .run({ id: asset.id, now: core.clock.now() })
    );
  }
  return assets.length;
}

async function purgeDraft(deps: RetentionDeps, draftId: string): Promise<void> {
  const { core } = deps;
  const draft = core.db
    .query("SELECT participant_id, conversation_id, updated_at FROM work_drafts WHERE id = $id")
    .get({ id: draftId }) as {
    participant_id: string;
    conversation_id: string;
    updated_at: number;
  } | null;
  if (!draft) return;
  // Media first: objects are outside SQLite, so their deletion is retried until the rows say so.
  await deleteObjects(deps, "draft_id = $draft", { draft: draftId });
  inTransaction(core.db, () => {
    const now = core.clock.now();
    core.db
      .query("UPDATE draft_revisions SET content_ciphertext = NULL WHERE draft_id = $draft")
      .run({ draft: draftId });
    // Messages from this participant in this conversation up to the draft's close carry its story.
    const params = {
      participant: draft.participant_id,
      conversation: draft.conversation_id,
      until: draft.updated_at,
      now,
    };
    core.db
      .query(
        `UPDATE inbox_events SET payload_ciphertext = NULL
         WHERE id IN (SELECT inbox_event_id FROM source_entries
           WHERE participant_id = $participant AND conversation_id = $conversation AND received_at <= $until)`
      )
      .run(params);
    core.db
      .query(
        `UPDATE source_entries SET content_ciphertext = NULL, deleted_at = COALESCE(deleted_at, $now)
         WHERE participant_id = $participant AND conversation_id = $conversation AND received_at <= $until`
      )
      .run(params);
    core.db
      .query(
        `UPDATE delivery_outbox SET payload_ciphertext = NULL
         WHERE participant_id = $participant AND conversation_id = $conversation
           AND created_at <= $until AND state NOT IN ('pending','dispatching','retry_wait')`
      )
      .run(params);
    core.db
      .query("UPDATE work_drafts SET content_deleted_at = $now WHERE id = $draft")
      .run({ draft: draftId, now });
    audit(core, "draft_content_purged", { kind: "draft", id: draftId });
  });
}

async function purgeParticipant(deps: RetentionDeps, participantId: string): Promise<void> {
  const { core } = deps;
  const drafts = core.db
    .query(
      `SELECT id FROM work_drafts WHERE participant_id = $participant AND content_deleted_at IS NULL
       AND (lifecycle <> 'open' OR ${EXPIRABLE})`
    )
    .all({ participant: participantId }) as Array<{ id: string }>;
  for (const draft of drafts) {
    inTransaction(core.db, () => {
      const loaded = safeLoad(core, draft.id);
      if (loaded) commitLifecycle(core, loaded, [{ type: "CANCEL" }], { participantAction: true });
    });
    await purgeDraft(deps, draft.id);
  }
  await deleteObjects(deps, "participant_id = $participant", { participant: participantId });
  inTransaction(core.db, () => {
    const now = core.clock.now();
    core.db
      .query(
        `UPDATE source_entries SET content_ciphertext = NULL, deleted_at = COALESCE(deleted_at, $now)
         WHERE participant_id = $participant`
      )
      .run({ participant: participantId, now });
    core.db
      .query(
        `UPDATE review_intents SET content_ciphertext = NULL, history_ciphertext = NULL, lifecycle = 'cancelled',
           updated_at = $now
         WHERE participant_id = $participant AND lifecycle = 'open'
           AND json_extract(machine_snapshot, '$.value') IN ('discussing','needsClarification','decisionPrepared','authority','reviewGrantChoice','awaitingSignature')`
      )
      .run({ participant: participantId, now });
    audit(core, "participant_content_purged", { kind: "participant", id: participantId });
  });
}

function safeLoad(core: ReportingCore, draftId: string) {
  try {
    return loadDraft(core, draftId);
  } catch (error) {
    if (error instanceof DraftContentUnavailableError) return null;
    throw error;
  }
}

export async function purgePrivateContent(
  deps: RetentionDeps,
  job: ClaimedJob
): Promise<JobOutcome> {
  if (job.payload.scope === "participant") await purgeParticipant(deps, job.subjectId);
  else await purgeDraft(deps, job.subjectId);
  return done;
}

/** Expires pre-consent intake and inactive drafts; the runtime schedules it periodically. */
export async function sweepRetention(deps: RetentionDeps, _job: ClaimedJob): Promise<JobOutcome> {
  const { core } = deps;
  const now = core.clock.now();
  inTransaction(core.db, () => {
    core.db
      .query(
        `UPDATE inbox_events SET payload_ciphertext = NULL, state = 'expired'
         WHERE state = 'quarantined' AND expires_at IS NOT NULL AND expires_at <= $now`
      )
      .run({ now });
    core.db
      .query(
        `UPDATE browser_challenges SET pairing_code_ciphertext = NULL
         WHERE pairing_code_ciphertext IS NOT NULL AND expires_at <= $now`
      )
      .run({ now });
  });
  const inactive = core.db
    .query(
      `SELECT id FROM work_drafts WHERE lifecycle = 'open' AND ${EXPIRABLE}
       AND last_participant_action_at <= $cutoff`
    )
    .all({ cutoff: now - core.settings.inactiveDraftRetentionMs }) as Array<{ id: string }>;
  for (const { id } of inactive) {
    inTransaction(core.db, () => {
      const draft = safeLoad(core, id);
      if (!draft) return;
      const { refused } = commitLifecycle(core, draft, [{ type: "EXPIRE" }], {
        participantAction: false,
      });
      if (refused.length > 0) return;
      participantWriter(core, {
        participantId: draft.participantId,
        conversationId: draft.conversationId,
        dedupePrefix: `expired:${draft.id}`,
      })?.say("report.expired");
      enqueueJob(core, {
        kind: "purge_private_content",
        subjectId: draft.id,
        dedupeKey: `purge:expired:${draft.id}`,
        payload: { scope: "draft" },
      });
    });
  }
  return done;
}

/** Enqueues the next sweep; the dedupe key makes it one sweep per interval across restarts. */
export function scheduleRetentionSweep(core: ReportingCore, intervalMs: number): void {
  const slot = Math.floor(core.clock.now() / intervalMs);
  enqueueJob(core, {
    kind: "retention_sweep",
    subjectId: "retention",
    dedupeKey: `retention:${slot}`,
  });
}
