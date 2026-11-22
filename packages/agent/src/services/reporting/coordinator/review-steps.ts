import {
  reviewContentDigest,
  reviewRequirements,
  reviewSummaryDigest,
  withConfidence,
  withDecision,
  withFeedback,
} from "@green-goods/shared/modules/agent-reporting";
import type { Confidence } from "@green-goods/shared/types/domain";
import { awaitingSafeSigners, chainCheckStopped } from "../check-notices";
import { invalidateConfirmation, recordConfirmation } from "../confirmations";
import { forgetGoal, rememberGoal } from "../dialogue-goal";
import type { ReportingCopyKey } from "../copy";
import { enqueueJob } from "../jobs";
import { operationForSubject } from "../operations";
import { closeConversationPrompt, resolvePrompt } from "../prompts";
import { commitReview, type ReviewRecord, reviewState } from "../reviews";
import { decisionLinkIsLatest, reviewLinkLapsed, sendReviewSigningLink } from "../signing-links";
import { accountLink } from "./account-link";
import type { ChatCommand } from "./commands";
import type { TurnPlan } from "./context";
import { readReviewAnswer } from "./review-answers";
import { isReviewPrompt, nextReviewStep } from "./review-prompts";
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

/** The states in which a steward still answers a decision's questions, before confirming it. */
const ANSWERING = new Set(["discussing", "needsClarification", "decisionPrepared"]);

/** A decision that can't change is being recorded, unless its chain check stopped without it. */
function frozenReviewReply(writer: TurnWriter, review: ReviewRecord): ReportingCopyKey {
  return chainCheckStopped(writer.core, { reviewIntentId: review.id }) ?? "review.frozen";
}

/** `REVIEW` lists pending work (after linking an account); `REVIEW n` picks from the open list. */
export function requestReview(writer: TurnWriter, index: number | null): void {
  const { core, ctx } = writer;
  if (index !== null && ctx.prompt?.kind === "select_review_work") {
    const choice = ctx.prompt.options[index - 1];
    return choice ? chooseWork(writer, choice.value) : writer.say("review.none");
  }
  if (!ctx.binding) return writer.say("help");
  if (!ctx.account) {
    // Linking comes first; the review is what the chat is for, and pairing carries on with it.
    rememberGoal(core, {
      conversationId: ctx.conversationId,
      participantId: ctx.binding.participantId,
      identityEpoch: ctx.binding.identityEpoch,
      goal: "review",
    });
    const url = accountLink(writer, ctx.binding, null);
    writer.say("review.link", {}, { url, label: writer.text("link.label") });
    writer.say("link.pairHint");
    return;
  }
  listWorkToReview(writer, ctx.binding.participantId);
}

/** Reads the work waiting for the linked account's review; the list is the reply. */
export function listWorkToReview(writer: TurnWriter, participantId: string): void {
  const { core, ctx } = writer;
  forgetGoal(core, ctx.conversationId);
  enqueueJob(core, {
    kind: "review_list",
    subjectId: participantId,
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

/**
 * A changed decision drops the feedback given for the other one, so a rejection is asked for its
 * own reason and never shows the approval's praise as one.
 */
function decide(
  content: ReviewRecord["content"],
  decision: "approve" | "reject"
): ReviewRecord["content"] {
  const next = withDecision(content, decision);
  return content.decision && content.decision !== decision ? { ...next, feedback: null } : next;
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
  const asked = prompt.kind.slice("review_".length) as "decision" | "confidence" | "feedback";
  // Typed words may give more than was asked: a decision, its confidence and feedback together.
  const read = plan.option || !plan.text ? {} : readReviewAnswer(plan.text, asked);
  let content = review.content;
  if (prompt.kind === "review_decision") {
    const decision =
      (plan.option?.value as "approve" | "reject" | undefined) ??
      decisionFromText(plan.text) ??
      read.decision;
    if (!decision) return nextReviewStep(writer, review, account.address);
    content = decide(content, decision);
  } else if (read.decision) {
    // A decision stated at a later question changes it: "Actually reject, the site is wrong."
    content = decide(content, read.decision);
  }
  if (prompt.kind === "review_confidence" || read.confidence !== undefined) {
    const level = read.confidence ?? Number(plan.option?.value ?? plan.text?.trim());
    const next = Number.isInteger(level) ? withConfidence(content, level as Confidence) : null;
    // A level only answers the confidence question; beside a rejection it is left out.
    if (next) content = next;
    else if (prompt.kind === "review_confidence" && !read.decision)
      return nextReviewStep(writer, review, account.address);
  }
  const feedback =
    prompt.kind === "review_feedback" && !read.decision && read.confidence === undefined
      ? (plan.text ?? "")
      : read.feedback;
  if (feedback !== undefined) {
    const next = withFeedback(content, feedback);
    if (prompt.kind === "review_feedback" && (!next || next.feedback === ""))
      return writer.say("review.feedbackInvalid");
    if (next) content = next;
  }
  applyReviewContent(writer, review, content, account.address);
}

/**
 * Words sent while a decision's question or summary is showing, and not as its answer. A decision
 * or a confidence they state is a correction, which makes a new revision and so a new summary to
 * confirm. Anything else leaves the decision as it is and puts its question again.
 */
export function correctReview(writer: TurnWriter, review: ReviewRecord, text: string | null): void {
  const account = writer.ctx.account;
  if (!account) return writer.say("review.none");
  const read = text ? readReviewAnswer(text, null) : {};
  let content = review.content;
  if (read.decision) content = decide(content, read.decision);
  if (read.confidence !== undefined) content = withConfidence(content, read.confidence) ?? content;
  if (read.feedback !== undefined) content = withFeedback(content, read.feedback) ?? content;
  // Saying again what the summary shows changes nothing, so its code still confirms it.
  if (JSON.stringify(content) === JSON.stringify(review.content))
    return nextReviewStep(writer, review, account.address);
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
  if (refused.some((event) => event.type === "REVISED"))
    return writer.say(frozenReviewReply(writer, review));
  supersedeReviewOperation(writer, review.id);
  if (writer.ctx.prompt) resolvePrompt(writer.core, writer.ctx.prompt.id);
  nextReviewStep(writer, next, account);
}

/**
 * Commands such as CONFIRM or CANCEL belong to an open decision while its question is showing.
 * RETRY belongs to a decision whose signing link lapsed, as the chat told the steward, and NEW
 * LINK to one whose link was the last the chat sent, report or not.
 */
export function reviewOwnsCommand(
  writer: TurnWriter,
  review: ReviewRecord,
  command: ChatCommand
): boolean {
  const { core, ctx } = writer;
  if (command.kind === "newLink") return decisionLinkIsLatest(core, review, ctx.draft?.id ?? null);
  if (command.kind === "retry" && reviewLinkLapsed(core, review)) return true;
  return isReviewPrompt(ctx.prompt?.kind) || !ctx.draft;
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
    // A confirmed decision whose signing link and pages have all closed gets a fresh link.
    case "retry":
      return resendReviewSigning(writer, review);
    // A decision the steward is still answering comes first, whether or not its question is
    // showing: STOP closes the question and leaves the decision open. NEW says so, and STATUS
    // shows the question it waits on. A question no longer showing is put again, so the next
    // story goes to the review and not to a report beside it.
    case "new":
    case "status": {
      // STATUS for a decision whose chain check stopped, that waits for a Safe's signers, or whose
      // signing link expired unused, says so, not that no report is open.
      const stopped =
        command.kind === "status"
          ? (chainCheckStopped(writer.core, { reviewIntentId: review.id }) ??
            awaitingSafeSigners(writer.core, { reviewIntentId: review.id }) ??
            (reviewLinkLapsed(writer.core, review) ? "review.linkExpired" : null))
          : null;
      if (stopped) {
        writer.say(stopped);
        return true;
      }
      if (!account || !ANSWERING.has(reviewState(review))) return false;
      if (command.kind === "new") writer.say("review.resumeFirst");
      if (command.kind === "status" || !isReviewPrompt(writer.ctx.prompt?.kind))
        nextReviewStep(writer, review, account.address);
      return true;
    }
    default:
      return false;
  }
}

/** Sends a confirmed decision's signing link again. False when it is not waiting on one. */
function resendReviewSigning(writer: TurnWriter, review: ReviewRecord): boolean {
  const account = writer.ctx.account;
  if (!account || account.id !== review.stewardAccountId) return false;
  if (reviewState(review) !== "awaitingSignature") return false;
  const operation = operationForSubject(writer.core, { reviewIntentId: review.id });
  return (
    operation?.state === "prepared" &&
    sendReviewSigningLink(writer.core, writer, review, operation, account)
  );
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
  if (!EDITABLE.has(reviewState(review)) || !account)
    return writer.say(frozenReviewReply(writer, review));
  const cleared = { ...review.content, decision: null, confidence: null, feedback: null };
  applyReviewContent(writer, review, cleared, account.address);
}

function cancelReview(writer: TurnWriter, review: ReviewRecord): void {
  const { refused } = commitReview(writer.core, review, [{ type: "CANCEL" }]);
  if (refused.length > 0) return writer.say(frozenReviewReply(writer, review));
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
