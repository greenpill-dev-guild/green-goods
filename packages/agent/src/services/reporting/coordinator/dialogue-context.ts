import {
  type ActionDefinitionSnapshot,
  outstandingRequirements,
  type ReportField,
} from "@green-goods/shared/modules/agent-reporting";
import type { WorkInput } from "@green-goods/shared/types/domain";
import { pendingGoal } from "../dialogue-goal";
import type { ReportingGarden } from "../gardens";
import { type InboxEventRow, readInboxPayload } from "../inbox";
import type {
  DialogueGoal,
  DialogueQuestion,
  DialogueSnapshot,
  DialogueTurn,
  InterpretationRequest,
  InterpretationResult,
} from "../interpretation";
import { MODEL_INPUT_POLICY, sanitizeModelText } from "../model-policy";
import { readReplyMessage } from "../outbox";
import type { ReportingCore } from "../runtime";
import { parseCommand } from "./commands";
import type { TurnContext } from "./context";

/**
 * The privacy gateway. A model reads a conversation only as the snapshot built here: free text is
 * sanitized, lists are bounded, gardens are named by identifiers made up for the turn, and earlier
 * turns come only from this chat, this identity and this consent.
 */
export interface DialogueView {
  request: InterpretationRequest;
  /** A model's answer with its garden named as the directory names it. */
  resolve(result: InterpretationResult): InterpretationResult;
}

/**
 * The assistant's replies a model may read as context: the questions a report or a decision
 * asked. Summaries, links, account replies and outcomes are left out, so no confirmation code,
 * address or result reaches a provider through history.
 */
const QUESTION_KINDS = new Set([
  "select_garden",
  "select_action",
  "field",
  "time",
  "time_unit",
  "title",
  "feedback",
  "evidence",
  "conflict",
  "edit_field",
  "review_decision",
  "review_confidence",
  "review_feedback",
]);

const label = (text: string) => sanitizeModelText(text, MODEL_INPUT_POLICY.maxLabelChars);

function labels(map: Record<string, string> | undefined): Record<string, string> | undefined {
  return map
    ? Object.fromEntries(Object.entries(map).map(([key, value]) => [label(key), label(value)]))
    : undefined;
}

function publicInput(input: WorkInput): WorkInput {
  const optionLabels = labels(input.optionLabels);
  const bandLabels = labels(input.bandLabels);
  return {
    ...input,
    title: label(input.title),
    placeholder: label(input.placeholder ?? ""),
    options: (input.options ?? []).map(label),
    ...(input.bands ? { bands: input.bands.map(label) } : {}),
    ...(optionLabels ? { optionLabels } : {}),
    ...(bandLabels ? { bandLabels } : {}),
    ...(input.unit ? { unit: label(input.unit) } : {}),
  };
}

const fieldText = (value: string | null) =>
  value === null ? null : sanitizeModelText(value, MODEL_INPUT_POLICY.maxFieldChars);

function publicValue(value: unknown): unknown {
  if (typeof value === "string") return fieldText(value);
  return Array.isArray(value) ? value.map((item) => label(String(item))) : value;
}

/**
 * When the context a model may read begins: at the consent in force, at the last time an account
 * was linked or unlinked, and at the start of the open report or the end of the last one,
 * whichever is latest. A turn handled before then belongs to another consent, another account or
 * another report.
 */
function contextStart(core: ReportingCore, ctx: TurnContext): number {
  const params = { subject: ctx.subjectId, conversation: ctx.conversationId };
  const consent = core.db
    .query(
      `SELECT MAX(granted_at) AS at FROM consent_records
       WHERE channel_subject_id = $subject AND purpose = 'processing' AND withdrawn_at IS NULL`
    )
    .get({ subject: ctx.subjectId }) as { at: number | null };
  const participant = ctx.binding?.participantId ?? null;
  const account = participant
    ? (core.db
        .query(
          `SELECT MAX(MAX(created_at, COALESCE(revoked_at, 0))) AS at FROM account_bindings
           WHERE participant_id = $participant`
        )
        .get({ participant }) as { at: number | null })
    : { at: null };
  const report = ctx.draft
    ? (core.db
        .query(
          "SELECT created_at AS at FROM draft_revisions WHERE draft_id = $draft AND revision = 1"
        )
        .get({ draft: ctx.draft.id }) as { at: number | null } | null)
    : (core.db
        .query(
          `SELECT MAX(updated_at) AS at FROM work_drafts
           WHERE conversation_id = $conversation AND lifecycle <> 'open'`
        )
        .get({ conversation: params.conversation }) as { at: number | null });
  return Math.max(consent.at ?? 0, account.at ?? 0, report?.at ?? 0);
}

/**
 * The questions a turn asked, read from the replies it committed. The question still open is left
 * out: the snapshot carries it on its own.
 */
function questionsAskedBy(
  core: ReportingCore,
  eventId: string,
  openPromptId: string | null
): DialogueTurn[] {
  const rows = core.db
    .query(
      `SELECT id, reply_kind, payload_ciphertext FROM delivery_outbox
       WHERE dedupe_key LIKE $prefix AND prompt_id IS NOT NULL
         AND ($open IS NULL OR prompt_id <> $open) ORDER BY dispatch_seq`
    )
    .all({ prefix: `${eventId}:%`, open: openPromptId }) as Array<{
    id: string;
    reply_kind: string;
    payload_ciphertext: string | null;
  }>;
  return rows.flatMap((row): DialogueTurn[] => {
    if (!QUESTION_KINDS.has(row.reply_kind.replace(/^prompt:/u, ""))) return [];
    const text = readReplyMessage(core, row)?.text;
    return text
      ? [{ role: "assistant", text: sanitizeModelText(text, MODEL_INPUT_POLICY.maxTurnChars) }]
      : [];
  });
}

/**
 * The turns before this one, oldest first, at most `maxTurns`. A person's turn is what they typed:
 * commands, codes and button taps are left out, since the state already holds what they did.
 */
function earlierTurns(core: ReportingCore, ctx: TurnContext): DialogueTurn[] {
  const events = core.db
    .query(
      `SELECT id, payload_ciphertext FROM inbox_events
       WHERE conversation_id = $conversation AND channel_subject_id = $subject AND kind = 'message'
         AND state = 'consumed' AND consumed_at >= $since AND arrival_seq < $before
         AND payload_ciphertext IS NOT NULL
       ORDER BY arrival_seq DESC LIMIT $limit`
    )
    .all({
      conversation: ctx.conversationId,
      subject: ctx.subjectId,
      since: contextStart(core, ctx),
      before: ctx.event.arrival_seq,
      limit: MODEL_INPUT_POLICY.maxTurns * 2,
    }) as Array<Pick<InboxEventRow, "id" | "payload_ciphertext">>;
  const turns: DialogueTurn[] = [];
  for (const event of events) {
    if (turns.length >= MODEL_INPUT_POLICY.maxTurns) break;
    const said = readInboxPayload(core, event);
    const text = said?.replyId ? "" : (said?.text?.trim() ?? "");
    const typed = text && !parseCommand(text) && !/^\d{4,8}$/u.test(text);
    // Newest first here: a turn's questions follow what the person said, so they go in before it.
    turns.push(...questionsAskedBy(core, event.id, ctx.prompt?.id ?? null).reverse());
    if (typed)
      turns.push({
        role: "person",
        text: sanitizeModelText(text, MODEL_INPUT_POLICY.maxTurnChars),
      });
  }
  return turns.slice(0, MODEL_INPUT_POLICY.maxTurns).reverse();
}

function openQuestion(core: ReportingCore, ctx: TurnContext): DialogueQuestion | null {
  const prompt = ctx.prompt;
  if (!prompt || !QUESTION_KINDS.has(prompt.kind)) return null;
  const row = core.db
    .query(
      `SELECT id, payload_ciphertext FROM delivery_outbox WHERE prompt_id = $prompt
       ORDER BY dispatch_seq DESC LIMIT 1`
    )
    .get({ prompt: prompt.id }) as { id: string; payload_ciphertext: string | null } | null;
  const text = row ? (readReplyMessage(core, row)?.text ?? "") : "";
  return {
    kind: prompt.kind,
    field: prompt.fieldKey,
    text: sanitizeModelText(text, MODEL_INPUT_POLICY.maxTurnChars),
    options: prompt.options.map((option) => label(option.label)),
  };
}

function goalOf(core: ReportingCore, ctx: TurnContext): DialogueGoal {
  if (ctx.review) return "review";
  if (ctx.draft) return "report";
  const pending = ctx.binding
    ? pendingGoal(core, {
        conversationId: ctx.conversationId,
        participantId: ctx.binding.participantId,
        identityEpoch: ctx.binding.identityEpoch,
      })
    : null;
  return pending ?? "none";
}

/** Keeps the snapshot inside its size bound: earlier turns go first, then the last activities listed. */
function bounded(snapshot: DialogueSnapshot): DialogueSnapshot {
  const fits = (candidate: DialogueSnapshot) =>
    JSON.stringify(candidate).length <= MODEL_INPUT_POLICY.maxSnapshotChars;
  let next = snapshot;
  while (!fits(next) && next.turns.length > 0) next = { ...next, turns: next.turns.slice(1) };
  while (!fits(next) && next.actions.length > 1)
    next = { ...next, actions: next.actions.slice(0, -1) };
  return next;
}

/** Builds the view of this turn a model may read. `gardens` and `activities` are what the chat is offered. */
export function dialogueView(
  core: ReportingCore,
  ctx: TurnContext,
  input: {
    text: string;
    gardens: readonly ReportingGarden[];
    activities: readonly ActionDefinitionSnapshot[];
  }
): DialogueView {
  const content = ctx.draft?.content ?? null;
  const offered = input.gardens.slice(0, MODEL_INPUT_POLICY.maxGardens);
  const gardenKeys = new Map(offered.map((garden, index) => [`g${index + 1}`, garden.key]));
  const provenance: DialogueSnapshot["provenance"] = {};
  for (const [field, read] of Object.entries(content?.provenance ?? {})) {
    if (read)
      provenance[field as ReportField] = { origin: read.origin, stated: read.gardenerStated };
  }
  const snapshot = bounded({
    version: MODEL_INPUT_POLICY.version,
    locale: ctx.locale,
    goal: goalOf(core, ctx),
    draftRevision: ctx.draft?.revision ?? 0,
    message: {
      sourceEntryId: ctx.event.id,
      text: sanitizeModelText(input.text, MODEL_INPUT_POLICY.maxMessageChars),
    },
    turns: earlierTurns(core, ctx),
    question: openQuestion(core, ctx),
    content: {
      actionUID: content?.actionUID ?? null,
      title: fieldText(content?.title ?? null),
      timeSpentMinutes: content?.timeSpentMinutes ?? null,
      feedback: fieldText(content?.feedback ?? null),
      details: Object.fromEntries(
        Object.entries(content?.details ?? {}).map(([key, value]) => [key, publicValue(value)])
      ) as DialogueSnapshot["content"]["details"],
    },
    provenance,
    conflicts: (content?.conflicts ?? []).map((conflict) => ({
      field: conflict.field,
      proposed: publicValue(conflict.proposed),
    })),
    requirements: content ? outstandingRequirements(content, ctx.draft?.snapshot ?? null) : [],
    gardens: [...gardenKeys.keys()].map((key, index) => ({
      key,
      label: label(offered[index]?.label ?? ""),
    })),
    actions: input.activities.slice(0, MODEL_INPUT_POLICY.maxActivities).map((activity) => ({
      uid: activity.definition.actionUID,
      title: label(activity.definition.title),
      inputs: activity.definition.inputs.map(publicInput),
    })),
    observations: [],
  });
  return {
    request: snapshot as InterpretationRequest,
    resolve: (result) => ({
      ...result,
      gardenKey: result.gardenKey === null ? null : (gardenKeys.get(result.gardenKey) ?? null),
    }),
  };
}
