import { activeConsentId } from "../consent";
import { readControl } from "../controls";
import { DraftContentUnavailableError, type DraftRecord, openDraftFor } from "../drafts";
import { albumItems, type InboxEventRow, readInboxPayload } from "../inbox";
import { modelProcessingOn } from "../model-spend";
import {
  type AccountBinding,
  activeAccount,
  bindingForSubject,
  type ParticipantBinding,
} from "../participants";
import {
  choiceLabelled,
  matchReply,
  openPrompt,
  type PromptOption,
  type PromptRecord,
} from "../prompts";
import { openReviewFor, type ReviewRecord } from "../reviews";
import type { ReportingCore } from "../runtime";
import type { InboundMediaReference, InboundMessageEvent } from "../transport";
import { type ChatCommand, consentAnswer, parseCommand, replyCommand } from "./commands";

/**
 * An album's files arrive one event each, in any order, and no provider marks the last one. The
 * album is read as one message once it has been quiet for `ALBUM_QUIET_MS`, and at the latest
 * `ALBUM_MAX_WAIT_MS` after its first file arrived; a file arriving after that is a message of
 * its own.
 */
export const ALBUM_QUIET_MS = 2_000;
const ALBUM_MAX_WAIT_MS = 10_000;

export interface TurnContext {
  event: InboxEventRow;
  /** The album's other files when `event` opens one: read with it, and consumed with it. */
  album: InboxEventRow[];
  /** When an album may be read; 0 for a message that is not part of one. */
  albumReadyAt: number;
  /** The inbound message, or an album's files and captions merged into one in the order sent. */
  message: InboundMessageEvent;
  command: ChatCommand | null;
  conversationId: string;
  subjectId: string;
  binding: ParticipantBinding | null;
  processingConsent: boolean;
  locale: string;
  prompt: PromptRecord | null;
  draft: DraftRecord | null;
  draftUnavailable: boolean;
  /** The steward's open decision in this conversation, if any. */
  review: ReviewRecord | null;
  account: AccountBinding | null;
  intakeEnabled: boolean;
  /** The model may read this turn: its operator switch is on and today's spend is under the cap. */
  modelEnabled: boolean;
  /**
   * The operator's model switch alone, which the consent notice follows: a consent given on a day
   * the spend cap was reached still covers the days after it, when the model reads again.
   */
  modelSwitchOn: boolean;
  noticeSent: boolean;
}

export type TurnPlan =
  | { kind: "consent_notice" }
  | { kind: "consent_answer"; answer: "agree" | "decline" }
  | { kind: "hold" }
  | { kind: "held_by_pause" }
  | { kind: "suspended" }
  | { kind: "stale_reply" }
  | { kind: "command"; command: ChatCommand }
  | { kind: "answer"; prompt: PromptRecord; option: PromptOption | null; text: string | null }
  | { kind: "message"; text: string | null; media: InboundMediaReference[] };

/** Prompts whose answer may arrive as plain text rather than an interactive reply. */
const TEXT_ANSWER_PROMPTS = new Set([
  "select_garden",
  "select_action",
  "field",
  "time",
  "time_unit",
  "title",
  "feedback",
  "conflict",
  "edit_field",
  "join_community",
  "select_review_work",
  "review_decision",
  "review_confidence",
  "review_feedback",
]);

/**
 * The command typed words stand for. GARDEN and JOIN are everyday words, and a garden, an activity
 * or a choice may be named with one. Typed where the open question shows that very label, such a
 * word picks the choice. Every other command word keeps its meaning wherever it is typed, so STOP,
 * DELETE and CONFIRM can never be taken for an answer.
 */
function typedCommand(text: string | undefined, prompt: PromptRecord | null): ChatCommand | null {
  const command = parseCommand(text);
  if (command?.kind !== "garden" && command?.kind !== "join") return command;
  const answers = prompt !== null && TEXT_ANSWER_PROMPTS.has(prompt.kind);
  return answers && choiceLabelled(prompt, text) ? null : command;
}

/** An album as one message: its captions and files in the order the sender sent them. */
function albumMessage(
  first: InboundMessageEvent,
  others: readonly InboundMessageEvent[]
): InboundMessageEvent {
  const sent = [first, ...others].sort(
    (a, b) =>
      a.sentAt - b.sentAt ||
      a.providerMessageId.localeCompare(b.providerMessageId, undefined, { numeric: true })
  );
  const text = sent
    .map((item) => item.text?.trim())
    .filter(Boolean)
    .join("\n");
  const replyTo = sent.find((item) => item.replyToProviderMessageId)?.replyToProviderMessageId;
  const { text: _text, replyToProviderMessageId: _replyTo, ...rest } = first;
  return {
    ...rest,
    sentAt: sent[0]?.sentAt ?? first.sentAt,
    ...(text ? { text } : {}),
    ...(replyTo ? { replyToProviderMessageId: replyTo } : {}),
    media: sent.flatMap((item) => item.media ?? []),
  };
}

/** `wholeAlbum: false` reads an album's file on its own, as every file was read before albums. */
export function loadTurnContext(
  core: ReportingCore,
  event: InboxEventRow,
  { wholeAlbum = true }: { wholeAlbum?: boolean } = {}
): TurnContext | null {
  const first = readInboxPayload<InboundMessageEvent>(core, event);
  if (!first || !event.conversation_id || !event.channel_subject_id) return null;
  const grouped = wholeAlbum ? first.mediaGroupId : undefined;
  const album = grouped ? albumItems(core, event, grouped) : [];
  const message =
    album.length > 0
      ? albumMessage(
          first,
          album.map((item) => item.message)
        )
      : first;
  const arrivals = [event.received_at, ...album.map((item) => item.row.received_at)];
  const albumReadyAt = grouped
    ? Math.min(Math.max(...arrivals) + ALBUM_QUIET_MS, Math.min(...arrivals) + ALBUM_MAX_WAIT_MS)
    : 0;
  const binding = bindingForSubject(core, event.channel_subject_id);
  let draft: DraftRecord | null = null;
  let draftUnavailable = false;
  if (binding) {
    try {
      draft = openDraftFor(core, binding.participantId, event.conversation_id);
    } catch (error) {
      if (!(error instanceof DraftContentUnavailableError)) throw error;
      draftUnavailable = true;
    }
  }
  const prompt = openPrompt(core, event.conversation_id);
  const parsed = typedCommand(message.text, prompt) ?? replyCommand(message.replyId);
  const bareCode = message.text?.trim();
  // Only a chat with its own live, verified browser challenge treats six digits as a code.
  // pairFromChat still compares the hash and counts every wrong attempt.
  const waitingForPair =
    binding && bareCode && /^\d{6}$/.test(bareCode)
      ? core.db
          .query(
            `SELECT 1 FROM browser_challenges c
         JOIN continuation_requests r ON r.id = c.request_id
         JOIN channel_bindings b ON b.id = r.channel_binding_id
         JOIN participants p ON p.id = b.participant_id
         WHERE r.channel_subject_id = $subject AND r.participant_id = $participant
           AND r.state = 'open' AND r.purpose IN ('link_account','publish_work','review_decision')
           AND b.participant_id = $participant AND b.channel_subject_id = $subject
           AND b.status IN ('provisional','active') AND b.identity_epoch = r.identity_epoch
           AND p.identity_epoch = r.identity_epoch AND c.state = 'proof_verified'
           AND c.expires_at > $now AND c.pairing_attempts < 5 LIMIT 1`
          )
          .get({
            subject: event.channel_subject_id,
            participant: binding.participantId,
            now: core.clock.now(),
          })
      : null;
  const notice = core.db
    .query("SELECT notice_sent_at FROM channel_subjects WHERE id = $id")
    .get({ id: event.channel_subject_id }) as { notice_sent_at: number | null } | null;
  return {
    event,
    album: album.map((item) => item.row),
    albumReadyAt,
    message,
    command: waitingForPair ? { kind: "pair", code: bareCode as string } : parsed,
    conversationId: event.conversation_id,
    subjectId: event.channel_subject_id,
    binding,
    processingConsent: activeConsentId(core, event.channel_subject_id, "processing") !== null,
    locale: binding?.locale ?? message.locale ?? "en",
    prompt,
    draft,
    draftUnavailable,
    review: binding ? openReviewFor(core, binding.participantId, event.conversation_id) : null,
    account: binding ? activeAccount(core, binding.participantId, core.settings.chainId) : null,
    intakeEnabled: readControl(core, "intake").enabled,
    modelEnabled: modelProcessingOn(core),
    modelSwitchOn: readControl(core, "model_processing").enabled,
    noticeSent: Boolean(notice?.notice_sent_at),
  };
}

/**
 * Plans the turn an inbox event opens. An album is read as one report message. Words that answer
 * the consent notice or name a command are taken as they always were: the file whose caption
 * carries them is read first and alone, whatever order the album arrived in, and the album's
 * other files are then read together, instead of being consumed by a reply that reads none.
 */
export function planEventTurn(
  core: ReportingCore,
  loaded: TurnContext
): { ctx: TurnContext; plan: TurnPlan; wholeAlbum: boolean } {
  const plan = planTurn(loaded);
  if (loaded.album.length === 0 || !["consent_answer", "command"].includes(plan.kind)) {
    return { ctx: loaded, plan, wholeAlbum: true };
  }
  const captioned =
    [loaded.event, ...loaded.album].find((row) =>
      readInboxPayload<InboundMessageEvent>(core, row)?.text?.trim()
    ) ?? loaded.event;
  const single = loadTurnContext(core, captioned, { wholeAlbum: false }) as TurnContext;
  return { ctx: single, plan: planTurn(single), wholeAlbum: false };
}

function planTurn(ctx: TurnContext): TurnPlan {
  const { message, prompt } = ctx;
  const command = ctx.command;

  if (!ctx.processingConsent) {
    if (command?.kind === "stop" || command?.kind === "delete")
      return { kind: "consent_answer", answer: "decline" };
    if (prompt?.kind === "processing_consent") {
      const option = matchReply(prompt, message.replyId);
      const answer = option ? (option.value as "agree" | "decline") : consentAnswer(message.text);
      return answer ? { kind: "consent_answer", answer } : { kind: "hold" };
    }
    return ctx.noticeSent && command?.kind !== "start"
      ? { kind: "hold" }
      : { kind: "consent_notice" };
  }

  const maintenanceSafe = command && ["stop", "delete", "help"].includes(command.kind);
  // An owner proved this account elsewhere to move it; this chat waits for the outcome.
  if (ctx.binding?.bindingStatus === "suspended" && !maintenanceSafe) return { kind: "suspended" };
  if (!ctx.intakeEnabled && !maintenanceSafe) return { kind: "held_by_pause" };
  if (command) return { kind: "command", command };

  if (message.replyId) {
    const option = matchReply(prompt, message.replyId);
    return option && prompt
      ? { kind: "answer", prompt, option, text: null }
      : { kind: "stale_reply" };
  }
  const media = message.media ?? [];
  if (prompt?.kind === "connect_offer" && media.length === 0) {
    // Only its number or a plain yes or no answers the offer; anything else starts a report.
    const answer = message.text?.trim() === "1" ? "agree" : consentAnswer(message.text);
    const option = answer === "agree" ? (prompt.options[0] ?? null) : null;
    if (answer) return { kind: "answer", prompt, option, text: message.text ?? null };
  }
  if (prompt && message.text && media.length === 0 && TEXT_ANSWER_PROMPTS.has(prompt.kind)) {
    return { kind: "answer", prompt, option: null, text: message.text };
  }
  return { kind: "message", text: message.text ?? null, media };
}
