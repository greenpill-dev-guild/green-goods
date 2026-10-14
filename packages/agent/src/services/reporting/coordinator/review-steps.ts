import {
  reviewContentDigest,
  reviewRequirements,
  reviewSummaryDigest,
  withConfidence,
  withDecision,
  withFeedback,
} from "@green-goods/shared/modules/agent-reporting";
import type { Confidence } from "@green-goods/shared/types/domain";
import { invalidateConfirmation, recordConfirmation } from "../confirmations";
import { enqueueJob } from "../jobs";
import { closeConversationPrompt, resolvePrompt } from "../prompts";
import { commitReview, type ReviewRecord, reviewState } from "../reviews";
import { accountLink } from "./account-link";
import type { ChatCommand } from "./commands";
import type { TurnPlan } from "./context";
import { nextReviewStep } from "./review-prompts";
import type { TurnWriter } from "./writer";

/**
 * The chat half of steward review. Chain reads (operator role, pending work, the work itself) run
 * in background jobs; a turn only moves the decision through its questions and records the
 * steward's explicit, token-bound confirmation of one exact revision.
 */
const EDITABLE = new Set([
  "discussing",
  "needsClarification",
  "decisionPrepared",
  "authority",
  "reviewGrantChoice",
  "awaitingSignature",
]);

/** `REVIEW` lists pending work (after linking an account); `REVIEW n` picks from the open list. */
export function requestReview(writer: TurnWriter, index: number | null): void {
  const { core, ctx } = writer;
  if (index !== null && ctx.prompt?.kind === "select_review_work") {
    const choice = ctx.prompt.options[index - 1];
    return choice ? chooseWork(writer, choice.value) : writer.say("review.none");
  }
  if (!ctx.binding) return writer.say("help");
  if (!ctx.account) {
    const url = accountLink(writer, ctx.binding, null);
    writer.say("review.link", {}, { url, label: writer.text("link.label") });
    writer.say("link.pairHint");
    return;
  }
  enqueueJob(core, {
    kind: "review_list",
    subjectId: ctx.binding.participantId,
    dedupeKey: `review-list:${ctx.event.id}`,
    payload: { conversationId: ctx.conversationId },
  });
}

/** A pick from the listed pending work, by button or by its number. */
export function answerReviewSelection(
  writer: TurnWriter,
  plan: Extract<TurnPlan, { kind: "answer" }>
): void {
  const value = plan.option?.value ?? plan.prompt.options[Number(plan.text?.trim()) - 1]?.value;
  if (!value) return writer.say("review.none");
  chooseWork(writer, value);
}

function chooseWork(writer: TurnWriter, workKey: string): void {
  const { core, ctx } = writer;
  if (!ctx.binding || !ctx.account) return writer.say("review.none");
  if (ctx.prompt) resolvePrompt(core, ctx.prompt.id);
  enqueueJob(core, {
    kind: "review_open",
    subjectId: ctx.binding.participantId,
    dedupeKey: `review-open:${ctx.event.id}`,
    payload: { conversationId: ctx.conversationId, workKey },
  });
}

function decisionFromText(text: string | null): "approve" | "reject" | null {
  const value = text?.trim().toLowerCase();
  if (!value) return null;
  if (["1", "approve", "aprobar", "aprovar", "yes", "sí", "sim"].includes(value)) return "approve";
  if (["2", "reject", "rechazar", "rejeitar", "no", "não"].includes(value)) return "reject";
  return null;
}

/** Applies an answer to the open review question; content changes become a new revision. */
export function answerReviewPrompt(
  writer: TurnWriter,
  review: ReviewRecord,
  plan: Extract<TurnPlan, { kind: "answer" }>
): void {
  const account = writer.ctx.account;
  if (!account) return writer.say("review.none");
  const { prompt } = plan;
  if (prompt.kind === "confirm_review") {
    const value = plan.option?.value;
    if (value === "confirm") return confirmReview(writer, review, null, true);
    if (value === "edit") return editReview(writer, review);
    return cancelReview(writer, review);
  }
  let content = review.content;
  if (prompt.kind === "review_decision") {
    const decision =
      (plan.option?.value as "approve" | "reject" | undefined) ?? decisionFromText(plan.text);
    if (!decision) return nextReviewStep(writer, review, account.address);
    content = withDecision(content, decision);
  } else if (prompt.kind === "review_confidence") {
    const level = Number(plan.option?.value ?? plan.text?.trim());
    const next = Number.isInteger(level) ? withConfidence(content, level as Confidence) : null;
    if (!next) return nextReviewStep(writer, review, account.address);
    content = next;
  } else if (prompt.kind === "review_feedback") {
    const next = withFeedback(content, plan.text ?? "");
    if (!next || next.feedback === "") return writer.say("review.feedbackInvalid");
    content = next;
  }
  applyReviewContent(writer, review, content, account.address);
}

/** Commits changed decision content as the next revision, then asks the next question. */
function applyReviewContent(
  writer: TurnWriter,
  review: ReviewRecord,
  content: ReviewRecord["content"],
  account: string
): void {
  const events =
    reviewRequirements(content).length === 0
      ? [{ type: "READY_FOR_REVIEW" as const, revision: review.revision + 1 }]
      : [];
  const { review: next, refused } = commitReview(writer.core, review, events, content);
  if (refused.some((event) => event.type === "REVISED")) return writer.say("review.frozen");
  supersedeReviewOperation(writer, review.id);
  if (writer.ctx.prompt) resolvePrompt(writer.core, writer.ctx.prompt.id);
  nextReviewStep(writer, next, account);
}

/** Review commands take precedence while a review question or summary is open. */
export function handleReviewCommand(
  writer: TurnWriter,
  review: ReviewRecord,
  command: ChatCommand
): boolean {
  const account = writer.ctx.account;
  switch (command.kind) {
    case "confirm":
      confirmReview(writer, review, command.token, false);
      return true;
    case "edit":
      editReview(writer, review);
      return true;
    case "cancel":
      cancelReview(writer, review);
      return true;
    case "skip": {
      if (writer.ctx.prompt?.kind !== "review_feedback" || !account) return false;
      // Only an approval may go without feedback; a rejection must say why.
      const next = review.content.decision === "approve" ? withFeedback(review.content, "") : null;
      if (next) applyReviewContent(writer, review, next, account.address);
      else nextReviewStep(writer, review, account.address);
      return true;
    }
    default:
      return false;
  }
}

function confirmReview(
  writer: TurnWriter,
  review: ReviewRecord,
  token: string | null,
  fromButton: boolean
): void {
  const { core, ctx } = writer;
  const prompt = ctx.prompt;
  const account = ctx.account;
  const binding = ctx.binding;
  const current =
    prompt?.kind === "confirm_review" &&
    prompt.subjectId === review.id &&
    prompt.subjectRevision === review.revision;
  if (!current || !prompt || !account || !binding) {
    if (account) nextReviewStep(writer, review, account.address);
    return;
  }
  if (!fromButton && token !== prompt.token)
    return writer.say("review.confirmToken", { token: prompt.token });
  const contentDigest = reviewContentDigest(review.content);
  const summaryDigest = reviewSummaryDigest({
    reviewIntentId: review.id,
    revision: review.revision,
    steward: account.address as `0x${string}`,
    content: review.content,
    contentDigest,
  });
  const { refused } = commitReview(core, review, [
    { type: "CONFIRMED", revision: review.revision },
  ]);
  if (refused.length > 0) return nextReviewStep(writer, review, account.address);
  const confirmationId = recordConfirmation(core, {
    subject: { reviewIntentId: review.id },
    revision: review.revision,
    summaryDigest,
    contentDigest,
    actionDefinitionDigest: null,
    accountBindingId: account.id,
    gardenChainId: review.chainId,
    gardenAddress: review.content.gardenAddress,
    sourceEventId: ctx.event.id,
    promptId: prompt.id,
    identityEpoch: binding.identityEpoch,
    publicationConsentId: null,
  });
  resolvePrompt(core, prompt.id);
  enqueueJob(core, {
    kind: "review_authority",
    subjectId: review.id,
    dedupeKey: `review-authority:${review.id}:${confirmationId}`,
  });
}

function editReview(writer: TurnWriter, review: ReviewRecord): void {
  const account = writer.ctx.account;
  if (!EDITABLE.has(reviewState(review)) || !account) return writer.say("review.frozen");
  const cleared = { ...review.content, decision: null, confidence: null, feedback: null };
  applyReviewContent(writer, review, cleared, account.address);
}

function cancelReview(writer: TurnWriter, review: ReviewRecord): void {
  const { refused } = commitReview(writer.core, review, [{ type: "CANCEL" }]);
  if (refused.length > 0) return writer.say("review.frozen");
  supersedeReviewOperation(writer, review.id);
  closeConversationPrompt(writer.core, writer.ctx.conversationId);
  writer.say("review.cancelled");
}

/**
 * A changed or cancelled decision retires its confirmation, any operation that never reached an
 * unresolved attempt, and open signing links for the old revision.
 */
function supersedeReviewOperation(writer: TurnWriter, reviewId: string): void {
  const { core } = writer;
  invalidateConfirmation(core, { reviewIntentId: reviewId });
  core.db
    .query(
      `UPDATE execution_operations SET state = 'cancelled', failure_code = 'superseded', version = version + 1, updated_at = $now
       WHERE review_intent_id = $review AND state IN ('created','preparing','preparation_failed','prepared')
         AND NOT EXISTS (SELECT 1 FROM execution_attempts a WHERE a.operation_id = execution_operations.id
           AND a.state IN ('reserved','wallet_pending','signed','broadcast','uncertain'))`
    )
    .run({ review: reviewId, now: core.clock.now() });
  core.db
    .query(
      "UPDATE continuation_requests SET state = 'revoked' WHERE resource_kind = 'review' AND resource_id = $review AND state = 'open'"
    )
    .run({ review: reviewId });
}
