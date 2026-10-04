import type { ReportingCore } from "./runtime";

/**
 * The single outstanding question in a conversation. A conversational "yes" is interpreted only
 * against this prompt; issuing a new prompt supersedes the old one so a late answer to a replaced
 * question can never be applied to a newer revision.
 */
export type PromptSubjectKind = "consent" | "draft" | "review" | "pairing" | "recovery";

export interface PromptOption {
  id: string;
  label: string;
  value: string;
}

export interface PromptRecord {
  id: string;
  conversationId: string;
  participantId: string | null;
  subjectKind: PromptSubjectKind;
  subjectId: string | null;
  subjectRevision: number | null;
  kind: string;
  fieldKey: string | null;
  token: string;
  options: PromptOption[];
  page: number;
}

interface PromptRow {
  id: string;
  conversation_id: string;
  participant_id: string | null;
  subject_kind: PromptSubjectKind;
  subject_id: string | null;
  subject_revision: number | null;
  kind: string;
  field_key: string | null;
  token: string;
  options_json: string;
  page: number;
}

function toPrompt(row: PromptRow | null): PromptRecord | null {
  return row
    ? {
        id: row.id,
        conversationId: row.conversation_id,
        participantId: row.participant_id,
        subjectKind: row.subject_kind,
        subjectId: row.subject_id,
        subjectRevision: row.subject_revision,
        kind: row.kind,
        fieldKey: row.field_key,
        token: row.token,
        options: JSON.parse(row.options_json) as PromptOption[],
        page: row.page,
      }
    : null;
}

export function openPrompt(core: ReportingCore, conversationId: string): PromptRecord | null {
  return toPrompt(
    core.db
      .query(
        "SELECT * FROM conversation_prompts WHERE conversation_id = $conversation AND state = 'open'"
      )
      .get({ conversation: conversationId }) as PromptRow | null
  );
}

export function issuePrompt(
  core: ReportingCore,
  input: {
    conversationId: string;
    subjectId: string;
    participantId: string | null;
    subjectKind: PromptSubjectKind;
    resourceId: string | null;
    resourceRevision: number | null;
    kind: string;
    fieldKey?: string | null;
    options?: PromptOption[];
    page?: number;
  }
): PromptRecord {
  const now = core.clock.now();
  core.db
    .query(
      `UPDATE conversation_prompts SET state = 'superseded', resolved_at = $now
       WHERE conversation_id = $conversation AND state = 'open'`
    )
    .run({ conversation: input.conversationId, now });
  const id = core.ids.id();
  core.db
    .query(
      `INSERT INTO conversation_prompts
         (id, conversation_id, participant_id, channel_subject_id, subject_kind, subject_id,
          subject_revision, kind, field_key, token, options_json, page, state, created_at)
       VALUES ($id, $conversation, $participant, $subject, $subjectKind, $resource, $revision, $kind,
               $field, $token, $options, $page, 'open', $now)`
    )
    .run({
      id,
      conversation: input.conversationId,
      participant: input.participantId,
      subject: input.subjectId,
      subjectKind: input.subjectKind,
      resource: input.resourceId,
      revision: input.resourceRevision,
      kind: input.kind,
      field: input.fieldKey ?? null,
      token: core.ids.code(4),
      options: JSON.stringify(input.options ?? []),
      page: input.page ?? 0,
      now,
    });
  return openPrompt(core, input.conversationId) as PromptRecord;
}

export function resolvePrompt(core: ReportingCore, promptId: string): void {
  core.db
    .query(
      "UPDATE conversation_prompts SET state = 'answered', resolved_at = $now WHERE id = $id AND state = 'open'"
    )
    .run({ id: promptId, now: core.clock.now() });
}

export function closeConversationPrompt(core: ReportingCore, conversationId: string): void {
  core.db
    .query(
      `UPDATE conversation_prompts SET state = 'superseded', resolved_at = $now
       WHERE conversation_id = $conversation AND state = 'open'`
    )
    .run({ conversation: conversationId, now: core.clock.now() });
}

/**
 * Interprets an interactive reply ID of the form `p:<promptId>:<optionId>` against the open
 * prompt. A reply to a superseded prompt returns null and is treated as a new message.
 */
export function matchReply(
  prompt: PromptRecord | null,
  replyId: string | undefined
): PromptOption | null {
  if (!prompt || !replyId) return null;
  const [marker, promptId, optionId] = replyId.split(":");
  if (marker !== "p" || promptId !== prompt.id) return null;
  return prompt.options.find((option) => option.id === optionId) ?? null;
}

export function replyIdFor(prompt: PromptRecord, option: PromptOption): string {
  return `p:${prompt.id}:${option.id}`;
}
