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
import { MODEL_INPUT_POLICY, REDACTION_MARK, sanitizeModelText } from "../model-policy";
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
 * The assistant's replies a model may read as context: the questions the report in hand asked.
 * Summaries, links, account replies and outcomes are left out, so no confirmation code, address or
 * result reaches a provider through history. A decision's questions are left out too: what a
 * steward says about someone's work is not context for a report.
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
]);

const label = (text: string) => sanitizeModelText(text, MODEL_INPUT_POLICY.maxLabelChars);

/**
 * The choices a model may name. A choice is named by its own value, which the report then stores,
 * so a value the sanitizer would change is left out instead of being sent altered: the model
 * cannot pick it, and the gardener still can.
 */
const namable = (values: readonly string[]) => values.filter((value) => label(value) === value);

function labels(
  map: Record<string, string> | undefined,
  values: readonly string[]
): Record<string, string> | undefined {
  return map
    ? Object.fromEntries(
        values
          .filter((value) => map[value] !== undefined)
          .map((value) => [value, label(map[value] as string)])
      )
    : undefined;
}

/** A field as a model may read it. A repeater's nested fields are never asked in chat, so they stay out. */
function publicInput(input: WorkInput): WorkInput {
  const options = namable(input.options ?? []);
  const bands = input.bands ? namable(input.bands) : undefined;
  const optionLabels = labels(input.optionLabels, options);
  const bandLabels = labels(input.bandLabels, bands ?? []);
  return {
    key: input.key,
    title: label(input.title),
    placeholder: label(input.placeholder ?? ""),
    type: input.type,
    required: input.required,
    options,
    ...(bands ? { bands } : {}),
    ...(optionLabels ? { optionLabels } : {}),
    ...(bandLabels ? { bandLabels } : {}),
    ...(input.unit ? { unit: label(input.unit) } : {}),
  };
}

const fieldText = (value: string | null) =>
  value === null ? null : sanitizeModelText(value, MODEL_INPUT_POLICY.maxFieldChars);

/** A field's value as a model may read it; anything that is not plain text or a number stays out. */
function publicValue(value: unknown): unknown {
  if (typeof value === "string") return fieldText(value);
  if (Array.isArray(value)) return value.map((item) => label(String(item)));
  return typeof value === "number" ? value : null;
}

/**
 * When the context a model may read begins: at the consent in force, at the last time an account
 * was linked or unlinked, at the chat's own link to its person, and at the start of the open
 * report or the end of the last one, whichever is latest. A turn handled before then belongs to another consent, another account or
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
  // A chat that joined a person known from another channel keeps nothing from before it joined.
  const channel = core.db
    .query(
      `SELECT MAX(MAX(created_at, COALESCE(verified_at, 0))) AS at FROM channel_bindings
       WHERE channel_subject_id = $subject AND status IN ('provisional','active','suspended')`
    )
    .get({ subject: ctx.subjectId }) as { at: number | null };
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
  return Math.max(consent.at ?? 0, account.at ?? 0, channel.at ?? 0, report?.at ?? 0);
}

/**
 * The questions a turn asked of a report, read from the replies it committed. The question still
 * open is left out: the snapshot carries it on its own. A reply's key opens with the event that
 * caused it, so the lookup is a range over the key's own index.
 */
function questionsAskedBy(
  core: ReportingCore,
  eventId: string,
  openPromptId: string | null
): DialogueTurn[] {
  const rows = core.db
    .query(
      `SELECT o.id, o.reply_kind, o.payload_ciphertext FROM delivery_outbox o
       JOIN conversation_prompts p ON p.id = o.prompt_id
       WHERE o.dedupe_key >= $from AND o.dedupe_key < $to AND p.subject_kind = 'draft'
         AND ($open IS NULL OR o.prompt_id <> $open) ORDER BY o.dispatch_seq`
    )
    // ";" is the character after ":", so the range holds exactly the keys that open "<event>:".
    .all({ from: `${eventId}:`, to: `${eventId};`, open: openPromptId }) as Array<{
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
 * commands, codes and button taps are left out, since the state already holds what they did, and
 * so is anything said while a decision on someone's work was open in the chat.
 */
function earlierTurns(core: ReportingCore, ctx: TurnContext): DialogueTurn[] {
  const events = core.db
    .query(
      `SELECT id, payload_ciphertext FROM inbox_events
       WHERE conversation_id = $conversation AND channel_subject_id = $subject AND kind = 'message'
         AND state = 'consumed' AND consumed_at >= $since AND arrival_seq < $before
         AND payload_ciphertext IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM review_intents r
           WHERE r.conversation_id = inbox_events.conversation_id
             AND inbox_events.consumed_at >= r.created_at
             AND (r.lifecycle = 'open' OR inbox_events.consumed_at <= r.updated_at))
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
  if (!prompt || prompt.subjectKind !== "draft" || !QUESTION_KINDS.has(prompt.kind)) return null;
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

/**
 * Keeps the snapshot inside its size bound: earlier turns go first, then the last activities
 * listed. A snapshot still too large after that is not sent at all, and the turn goes on without
 * the model.
 */
function bounded(snapshot: DialogueSnapshot): DialogueSnapshot {
  const fits = (candidate: DialogueSnapshot) =>
    JSON.stringify(candidate).length <= MODEL_INPUT_POLICY.maxSnapshotChars;
  let next = snapshot;
  while (!fits(next) && next.turns.length > 0) next = { ...next, turns: next.turns.slice(1) };
  while (!fits(next) && next.actions.length > 1)
    next = { ...next, actions: next.actions.slice(0, -1) };
  if (!fits(next)) throw new Error("The dialogue snapshot exceeds its size bound");
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
  /** The identifier this turn gave a garden, or null for one it does not offer. */
  const gardenId = (address: string | undefined): string | null => {
    const at = offered.findIndex((garden) => garden.address === address?.toLowerCase());
    return at < 0 ? null : `g${at + 1}`;
  };
  // The report's own activity is listed first, so a long catalogue never crowds it out.
  const activities = [...input.activities].sort(
    (one, other) =>
      Number(other.definition.actionUID === content?.actionUID) -
      Number(one.definition.actionUID === content?.actionUID)
  );
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
      proposed:
        conflict.field === "garden"
          ? gardenId((conflict.proposed as { address?: string } | null)?.address)
          : publicValue(conflict.proposed),
    })),
    requirements: content ? outstandingRequirements(content, ctx.draft?.snapshot ?? null) : [],
    gardens: [...gardenKeys.keys()].map((key, index) => ({
      key,
      label: label(offered[index]?.label ?? ""),
    })),
    actions: activities.slice(0, MODEL_INPUT_POLICY.maxActivities).map((activity) => ({
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
      // A value read from where an identifier was taken out is not a value the gardener gave.
      facts: result.facts.filter((fact) => !REDACTION_MARK.test(JSON.stringify(fact.value))),
    }),
  };
}
