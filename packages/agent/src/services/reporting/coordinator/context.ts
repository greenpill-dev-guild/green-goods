import { activeConsentId } from "../consent";
import { readControl } from "../controls";
import { DraftContentUnavailableError, type DraftRecord, openDraftFor } from "../drafts";
import { type InboxEventRow, readInboxPayload } from "../inbox";
import {
  type AccountBinding,
  activeAccount,
  bindingForSubject,
  type ParticipantBinding,
} from "../participants";
import { matchReply, openPrompt, type PromptOption, type PromptRecord } from "../prompts";
import { openReviewFor, type ReviewRecord } from "../reviews";
import type { ReportingCore } from "../runtime";
import type { InboundMediaReference, InboundMessageEvent } from "../transport";
import { type ChatCommand, consentAnswer, parseCommand, replyCommand } from "./commands";

export interface TurnContext {
  event: InboxEventRow;
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
  modelEnabled: boolean;
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

export function loadTurnContext(core: ReportingCore, event: InboxEventRow): TurnContext | null {
  const message = readInboxPayload<InboundMessageEvent>(core, event);
  if (!message || !event.conversation_id || !event.channel_subject_id) return null;
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
  const parsed = parseCommand(message.text) ?? replyCommand(message.replyId);
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
    message,
    command: waitingForPair ? { kind: "pair", code: bareCode as string } : parsed,
    conversationId: event.conversation_id,
    subjectId: event.channel_subject_id,
    binding,
    processingConsent: activeConsentId(core, event.channel_subject_id, "processing") !== null,
    locale: binding?.locale ?? message.locale ?? "en",
    prompt: openPrompt(core, event.conversation_id),
    draft,
    draftUnavailable,
    review: binding ? openReviewFor(core, binding.participantId, event.conversation_id) : null,
    account: binding ? activeAccount(core, binding.participantId, core.settings.chainId) : null,
    intakeEnabled: readControl(core, "intake").enabled,
    modelEnabled: readControl(core, "model_processing").enabled,
    noticeSent: Boolean(notice?.notice_sent_at),
  };
}

export function planTurn(ctx: TurnContext): TurnPlan {
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
