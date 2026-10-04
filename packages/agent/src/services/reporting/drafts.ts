import {
  type ActionDefinitionSnapshot,
  parseActionSnapshot,
  type ReportContent,
  reportContentDigest,
  serializeActionSnapshot,
} from "@green-goods/shared/modules/agent-reporting";
import {
  agentReportLifecycle,
  type PersistedLifecycle,
  type ReportLifecycleContext,
  startLifecycle,
} from "@green-goods/shared/workflows/agent-reporting";
import type { ReportingCore } from "./runtime";

/**
 * Work drafts: one small mutable row plus append-only revisions. Every content or lifecycle change
 * is a compare-and-swap on the expected revision, so a stale model result or a concurrent
 * correction loses cleanly instead of overwriting newer state. Revision content is sealed.
 */
export const REPORT_LIFECYCLE_VERSION = 1;

export type ReportLifecycle = PersistedLifecycle<ReportLifecycleContext>;

export interface DraftRecord {
  id: string;
  participantId: string;
  conversationId: string;
  revision: number;
  lifecycle: ReportLifecycle;
  authorAccountId: string | null;
  content: ReportContent;
  snapshot: ActionDefinitionSnapshot | null;
  lastParticipantActionAt: number;
}

interface DraftRow {
  id: string;
  participant_id: string;
  conversation_id: string;
  revision: number;
  machine_snapshot: string;
  author_account_id: string | null;
  last_participant_action_at: number;
  content_ciphertext: string | null;
  action_definition_snapshot: string | null;
}

const TERMINAL = new Set(["published", "cancelled", "expired"]);

function contentContext(draftId: string, revision: number): string {
  return `draft_revisions.content:${draftId}:${revision}`;
}

function lifecycleColumn(lifecycle: ReportLifecycle): string {
  return typeof lifecycle.value === "string" && TERMINAL.has(lifecycle.value)
    ? lifecycle.value
    : "open";
}

const SELECT_DRAFT = `
  SELECT d.id, d.participant_id, d.conversation_id, d.revision, d.machine_snapshot, d.author_account_id,
         d.last_participant_action_at, r.content_ciphertext, r.action_definition_snapshot
  FROM work_drafts d JOIN draft_revisions r ON r.draft_id = d.id AND r.revision = d.revision`;

function toRecord(core: ReportingCore, row: DraftRow | null): DraftRecord | null {
  if (!row) return null;
  if (!row.content_ciphertext) throw new DraftContentUnavailableError(row.id);
  return {
    id: row.id,
    participantId: row.participant_id,
    conversationId: row.conversation_id,
    revision: row.revision,
    lifecycle: JSON.parse(row.machine_snapshot) as ReportLifecycle,
    authorAccountId: row.author_account_id,
    content: JSON.parse(
      core.keyring.open(row.content_ciphertext, contentContext(row.id, row.revision))
    ),
    snapshot: row.action_definition_snapshot
      ? parseActionSnapshot(row.action_definition_snapshot)
      : null,
    lastParticipantActionAt: row.last_participant_action_at,
  };
}

/** Raised when retention already removed a draft's private content. */
export class DraftContentUnavailableError extends Error {
  constructor(readonly draftId: string) {
    super("Draft content is no longer available");
  }
}

export function loadDraft(core: ReportingCore, draftId: string): DraftRecord | null {
  return toRecord(
    core,
    core.db.query(`${SELECT_DRAFT} WHERE d.id = $id`).get({ id: draftId }) as DraftRow | null
  );
}

export function openDraftFor(
  core: ReportingCore,
  participantId: string,
  conversationId: string
): DraftRecord | null {
  const row = core.db
    .query(
      `${SELECT_DRAFT} WHERE d.participant_id = $participant AND d.conversation_id = $conversation AND d.lifecycle = 'open'`
    )
    .get({ participant: participantId, conversation: conversationId }) as DraftRow | null;
  return toRecord(core, row);
}

function insertRevision(
  core: ReportingCore,
  input: {
    draftId: string;
    revision: number;
    content: ReportContent;
    snapshot: ActionDefinitionSnapshot | null;
    cause: string;
    sourceEventId: string | null;
  }
): void {
  core.db
    .query(
      `INSERT INTO draft_revisions
         (draft_id, revision, content_ciphertext, content_digest, action_definition_digest,
          action_definition_snapshot, evidence_manifest, cause, source_event_id, created_at)
       VALUES ($draft, $revision, $content, $digest, $snapshotDigest, $snapshot, $evidence, $cause, $source, $now)`
    )
    .run({
      draft: input.draftId,
      revision: input.revision,
      content: core.keyring.seal(
        JSON.stringify(input.content),
        contentContext(input.draftId, input.revision)
      ),
      digest: reportContentDigest(input.content),
      snapshotDigest: input.snapshot?.digest ?? null,
      snapshot: input.snapshot ? serializeActionSnapshot(input.snapshot) : null,
      evidence: JSON.stringify(input.content.evidence),
      cause: input.cause,
      source: input.sourceEventId,
      now: core.clock.now(),
    });
}

export function createDraft(
  core: ReportingCore,
  input: {
    participantId: string;
    conversationId: string;
    content: ReportContent;
    sourceEventId: string | null;
  }
): DraftRecord {
  const id = core.ids.id();
  const now = core.clock.now();
  const lifecycle = startLifecycle<ReportLifecycleContext>(
    agentReportLifecycle,
    REPORT_LIFECYCLE_VERSION
  );
  core.db
    .query(
      `INSERT INTO work_drafts
         (id, participant_id, conversation_id, garden_chain_id, garden_address, action_uid, revision,
          machine_snapshot, machine_version, lifecycle, last_participant_action_at, created_at, updated_at)
       VALUES ($id, $participant, $conversation, $chain, $garden, $action, 1, $machine, $version, 'open', $now, $now, $now)`
    )
    .run({
      id,
      participant: input.participantId,
      conversation: input.conversationId,
      chain: input.content.garden?.chainId ?? null,
      garden: input.content.garden?.address ?? null,
      action: input.content.actionUID?.toString() ?? null,
      machine: JSON.stringify(lifecycle),
      version: REPORT_LIFECYCLE_VERSION,
      now,
    });
  insertRevision(core, {
    draftId: id,
    revision: 1,
    content: input.content,
    snapshot: null,
    cause: "story",
    sourceEventId: input.sourceEventId,
  });
  return loadDraft(core, id) as DraftRecord;
}

/**
 * Commits the next state of a draft if `expectedRevision` is still current. Content changes append
 * a new revision; lifecycle-only changes keep the revision. Returns "stale" when another writer won.
 */
export function commitDraft(
  core: ReportingCore,
  input: {
    draftId: string;
    expectedRevision: number;
    lifecycle: ReportLifecycle;
    content?: ReportContent;
    snapshot?: ActionDefinitionSnapshot | null;
    cause?: string;
    sourceEventId?: string | null;
    participantAction: boolean;
    authorAccountId?: string | null;
  }
): DraftRecord | "stale" {
  const current = loadDraft(core, input.draftId);
  if (!current || current.revision !== input.expectedRevision) return "stale";
  const content = input.content ?? current.content;
  const snapshot = input.snapshot === undefined ? current.snapshot : input.snapshot;
  const revision = input.content ? current.revision + 1 : current.revision;
  const now = core.clock.now();
  const result = core.db
    .query(
      `UPDATE work_drafts
       SET revision = $revision, machine_snapshot = $machine, lifecycle = $lifecycle,
           garden_chain_id = $chain, garden_address = $garden, action_uid = $action,
           author_account_id = COALESCE($author, author_account_id),
           last_participant_action_at = CASE WHEN $participantAction = 1 THEN $now ELSE last_participant_action_at END,
           updated_at = $now
       WHERE id = $id AND revision = $expected`
    )
    .run({
      id: input.draftId,
      expected: input.expectedRevision,
      revision,
      machine: JSON.stringify(input.lifecycle),
      lifecycle: lifecycleColumn(input.lifecycle),
      chain: content.garden?.chainId ?? null,
      garden: content.garden?.address ?? null,
      action: content.actionUID?.toString() ?? null,
      author: input.authorAccountId ?? null,
      participantAction: input.participantAction ? 1 : 0,
      now,
    });
  if (result.changes !== 1) return "stale";
  if (input.content) {
    insertRevision(core, {
      draftId: input.draftId,
      revision,
      content,
      snapshot,
      cause: input.cause ?? "update",
      sourceEventId: input.sourceEventId ?? null,
    });
  }
  return loadDraft(core, input.draftId) as DraftRecord;
}
