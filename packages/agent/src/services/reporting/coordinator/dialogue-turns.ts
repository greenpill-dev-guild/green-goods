import { type InboxEventRow, readInboxPayload } from "../inbox";
import type { DialogueQuestion, DialogueTurn } from "../interpretation";
import { MODEL_INPUT_POLICY, sanitizeModelText } from "../model-policy";
import { readReplyMessage } from "../outbox";
import type { ReportingCore } from "../runtime";
import { parseCommand } from "./commands";
import type { TurnContext } from "./context";

/**
 * The part of a conversation's history a model may read, taken from the inbox and the outbox:
 * the question the report has open and the few turns before this one. What retention, STOP and
 * DELETE clear is gone from here too, and whatever they leave is behind the consent in force,
 * where the context begins.
 */
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

/** Where a context begins: a time, and the arrival of the message that began it on a tie. */
interface ContextStart {
  at: number;
  /**
   * A message read in the same millisecond counts only if it arrived no earlier than this: for a
   * report, the story that began it; 0 where a tie cannot cross a boundary.
   */
  arrival: number;
}

const UNKNOWN = Number.MAX_SAFE_INTEGER;

/**
 * When the context a model may read begins: at the consent in force, at the last time an account
 * was linked or unlinked, at the chat's own link to its person, and at the start of the open
 * report or the end of the last one, whichever is latest. A turn handled before then belongs to
 * another consent, another account or another report.
 */
function contextStart(core: ReportingCore, ctx: TurnContext): ContextStart {
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
          `SELECT r.created_at AS at, e.arrival_seq AS arrival FROM draft_revisions r
           LEFT JOIN inbox_events e ON e.id = r.source_event_id
           WHERE r.draft_id = $draft AND r.revision = 1`
        )
        .get({ draft: ctx.draft.id }) as { at: number; arrival: number | null } | null)
    : (core.db
        .query(
          `SELECT MAX(updated_at) AS at FROM work_drafts
           WHERE conversation_id = $conversation AND lifecycle <> 'open'`
        )
        .get({ conversation: ctx.conversationId }) as { at: number | null });
  // A consent and an account link each follow the person's reply to a notice or a link, and the
  // chat's own link is its first contact, so a message read in their millisecond counts. A report
  // can begin in the same pass as the last one ended, so there a message counts only if it arrived
  // no earlier than the story that began the report.
  const at = (bound: { at: number | null } | null, arrival = 0): ContextStart[] =>
    bound?.at ? [{ at: bound.at, arrival }] : [];
  const bounds = [
    ...at(consent),
    ...at(account),
    ...at(channel),
    ...at(report, (report as { arrival?: number | null } | null)?.arrival ?? UNKNOWN),
  ];
  const start = Math.max(0, ...bounds.map((bound) => bound.at));
  const arrival = Math.max(
    0,
    ...bounds.filter((bound) => bound.at === start).map((bound) => bound.arrival)
  );
  return { at: start, arrival };
}

/**
 * The questions a turn asked of a report and the person was sent, read from the replies it
 * committed: one a newer question replaced before it went out was never seen. The question still
 * open is left out: the snapshot carries it on its own. A reply's key opens with the event that
 * caused it, so the lookup is a range over the key's own index; the `+` keeps the planner from
 * walking every sent reply by state instead.
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
         AND +o.state IN ('accepted','sent','delivered','read')
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
 * so is anything said while a decision on someone's work was open in the chat, or while one of
 * its questions was, the list of work to review among them. A message from the last report read in
 * the same millisecond as a new report began does not cross into it.
 */
export function earlierTurns(core: ReportingCore, ctx: TurnContext): DialogueTurn[] {
  const start = contextStart(core, ctx);
  const events = core.db
    .query(
      `SELECT id, payload_ciphertext FROM inbox_events
       WHERE conversation_id = $conversation AND channel_subject_id = $subject AND kind = 'message'
         AND state = 'consumed' AND arrival_seq < $before
         AND (consumed_at > $since OR (consumed_at = $since AND arrival_seq >= $sinceArrival))
         AND payload_ciphertext IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM review_intents r
           WHERE r.conversation_id = inbox_events.conversation_id
             AND inbox_events.consumed_at >= r.created_at
             AND (r.lifecycle = 'open' OR inbox_events.received_at <= r.updated_at))
         AND NOT EXISTS (SELECT 1 FROM conversation_prompts p
           WHERE p.conversation_id = inbox_events.conversation_id AND p.subject_kind = 'review'
             AND p.created_at <= inbox_events.consumed_at
             AND (p.state = 'open' OR p.resolved_at >= inbox_events.received_at))
       ORDER BY arrival_seq DESC LIMIT $limit`
    )
    .all({
      conversation: ctx.conversationId,
      subject: ctx.subjectId,
      since: start.at,
      sinceArrival: start.arrival,
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

const named = (text: string) => sanitizeModelText(text, MODEL_INPUT_POLICY.maxLabelChars);

export function openQuestion(core: ReportingCore, ctx: TurnContext): DialogueQuestion | null {
  const prompt = ctx.prompt;
  if (!prompt || prompt.subjectKind !== "draft" || !QUESTION_KINDS.has(prompt.kind)) return null;
  const row = core.db
    .query(
      `SELECT id, payload_ciphertext FROM delivery_outbox WHERE prompt_id = $prompt
       ORDER BY dispatch_seq DESC LIMIT 1`
    )
    .get({ prompt: prompt.id }) as { id: string; payload_ciphertext: string | null } | null;
  const text = row ? (readReplyMessage(core, row)?.text ?? "") : "";
  const key = prompt.fieldKey?.replace(/^details\./u, "") ?? "";
  return {
    kind: prompt.kind,
    // A field is named by its key; one the sanitizer would alter is not named.
    field: prompt.fieldKey && named(key) === key ? prompt.fieldKey : null,
    text: sanitizeModelText(text, MODEL_INPUT_POLICY.maxTurnChars),
    options: prompt.options.map((option) => named(option.label)),
  };
}
