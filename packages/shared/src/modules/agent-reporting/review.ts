import type { Address, Hex } from "viem";
import { Confidence, VerificationMethod, type WorkApprovalDraft } from "../../types/domain";
import { reportingDigest } from "./canonical";

/**
 * A steward's decision about published work, assembled in chat.
 *
 * Application rules are stronger than the resolver's range checks, so they live here and are
 * enforced by both the command boundary and the restricted executor: approvals carry an explicit
 * LOW–HIGH confidence, rejections carry NONE, the method is HUMAN (using a messaging agent to
 * submit never makes a review an AGENT verification), and a steward never reviews their own work.
 */
export interface ReviewContent {
  version: 1;
  chainId: number;
  gardenAddress: Address;
  workUID: Hex;
  actionUID: number;
  gardenerAddress: Address;
  decision: "approve" | "reject" | null;
  /** `""` records that the steward explicitly chose to add no feedback. */
  feedback: string | null;
  confidence: Confidence | null;
}

export type ReviewRequirement = "decision" | "confidence" | "feedback";
export type ReviewIssue = "self_review" | "approval_confidence" | "rejection_confidence";

export const MAX_REVIEW_FEEDBACK_LENGTH = 2_000;

export function newReview(
  work: Pick<
    ReviewContent,
    "chainId" | "gardenAddress" | "workUID" | "actionUID" | "gardenerAddress"
  >
): ReviewContent {
  return {
    version: 1,
    ...work,
    gardenAddress: work.gardenAddress.toLowerCase() as Address,
    gardenerAddress: work.gardenerAddress.toLowerCase() as Address,
    decision: null,
    feedback: null,
    confidence: null,
  };
}

export function reviewRequirements(content: ReviewContent): ReviewRequirement[] {
  const requirements: ReviewRequirement[] = [];
  if (content.decision === null) requirements.push("decision");
  if (
    content.decision === "approve" &&
    (content.confidence === null || content.confidence === Confidence.NONE)
  ) {
    requirements.push("confidence");
  }
  if (content.feedback === null || (content.decision === "reject" && content.feedback === "")) {
    requirements.push("feedback");
  }
  return requirements;
}

export function reviewIssues(content: ReviewContent, steward: Address): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  if (content.gardenerAddress.toLowerCase() === steward.toLowerCase()) issues.push("self_review");
  if (
    content.decision === "approve" &&
    (content.confidence === null ||
      content.confidence < Confidence.LOW ||
      content.confidence > Confidence.HIGH)
  ) {
    issues.push("approval_confidence");
  }
  if (
    content.decision === "reject" &&
    content.confidence !== null &&
    content.confidence !== Confidence.NONE
  ) {
    issues.push("rejection_confidence");
  }
  return issues;
}

/** Sets the decision; a rejection's confidence is always NONE. */
export function withDecision(
  content: ReviewContent,
  decision: "approve" | "reject"
): ReviewContent {
  return {
    ...content,
    decision,
    confidence:
      decision === "reject"
        ? Confidence.NONE
        : content.confidence === Confidence.NONE
          ? null
          : content.confidence,
  };
}

export function withFeedback(content: ReviewContent, feedback: string): ReviewContent | null {
  const text = feedback.trim();
  return text.length <= MAX_REVIEW_FEEDBACK_LENGTH ? { ...content, feedback: text } : null;
}

export function withConfidence(
  content: ReviewContent,
  confidence: Confidence
): ReviewContent | null {
  if (
    content.decision !== "approve" ||
    confidence < Confidence.LOW ||
    confidence > Confidence.HIGH
  ) {
    return null;
  }
  return { ...content, confidence };
}

export function toApprovalDraft(content: ReviewContent): WorkApprovalDraft {
  if (content.decision === null || content.feedback === null) {
    throw new Error("Review is not complete");
  }
  return {
    actionUID: content.actionUID,
    workUID: content.workUID,
    approved: content.decision === "approve",
    feedback: content.feedback,
    confidence:
      content.decision === "reject" ? Confidence.NONE : (content.confidence as Confidence),
    verificationMethod: VerificationMethod.HUMAN,
    reviewNotesCID: "",
  };
}

export interface ReviewSummary {
  reviewIntentId: string;
  revision: number;
  steward: Address;
  content: ReviewContent;
  contentDigest: Hex;
}

export function reviewContentDigest(content: ReviewContent): Hex {
  return reportingDigest("review-content", content);
}

export function reviewSummaryDigest(summary: ReviewSummary): Hex {
  return reportingDigest("review-summary", {
    ...summary,
    steward: summary.steward.toLowerCase(),
  });
}
