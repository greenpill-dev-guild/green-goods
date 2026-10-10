import { describe, expect, it } from "vitest";
import {
  newReview,
  reviewIssues,
  reviewRequirements,
  toApprovalDraft,
  withConfidence,
  withDecision,
  withFeedback,
} from "../../../modules/agent-reporting/review";
import { Confidence, VerificationMethod } from "../../../types/domain";

const GARDENER = "0x00000000000000000000000000000000000000A1";
const STEWARD = "0x00000000000000000000000000000000000000B2";
const base = newReview({
  chainId: 42161,
  gardenAddress: "0x00000000000000000000000000000000000000cc",
  workUID: `0x${"ab".repeat(32)}`,
  actionUID: 7,
  gardenerAddress: GARDENER,
});

describe("review rules", () => {
  it("requires an explicit LOW–HIGH confidence for approvals and records NONE for rejections", () => {
    const approving = withDecision(base, "approve");
    expect(reviewRequirements(approving)).toEqual(["confidence", "feedback"]);
    expect(withConfidence(approving, Confidence.NONE)).toBeNull();
    const rejecting = withDecision(withConfidence(approving, Confidence.HIGH)!, "reject");
    expect(rejecting.confidence).toBe(Confidence.NONE);
    expect(reviewRequirements({ ...rejecting, feedback: "" })).toEqual(["feedback"]);
  });

  it("rejects self-review regardless of address case", () => {
    expect(reviewIssues(base, GARDENER.toLowerCase() as `0x${string}`)).toContain("self_review");
    expect(reviewIssues(base, STEWARD)).toEqual([]);
  });

  it("refuses overlong feedback without changing the existing review", () => {
    const prior = withFeedback(base, "Existing steward feedback")!;
    expect(withFeedback(prior, "x".repeat(2_001))).toBeNull();
    expect(prior.feedback).toBe("Existing steward feedback");
    expect(withFeedback(prior, "x".repeat(2_000))?.feedback).toHaveLength(2_000);
  });

  it("publishes a HUMAN verification with empty review notes, never an AGENT flag", () => {
    const approved = withFeedback(
      withConfidence(withDecision(base, "approve"), Confidence.MEDIUM)!,
      " Looks good "
    )!;
    expect(toApprovalDraft(approved)).toEqual({
      actionUID: 7,
      workUID: base.workUID,
      approved: true,
      feedback: "Looks good",
      confidence: Confidence.MEDIUM,
      verificationMethod: VerificationMethod.HUMAN,
      reviewNotesCID: "",
    });
  });
});
