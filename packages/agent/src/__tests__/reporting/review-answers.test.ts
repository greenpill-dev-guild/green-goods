import { Confidence } from "@green-goods/shared/types/domain";
import { describe, expect, it } from "vitest";
import { readReviewAnswer } from "../../services/reporting/coordinator/review-answers";

/** A steward's answer read without a model: what decides, and what never does. */
describe("reading a review answer", () => {
  it.each([
    [
      "Approve. High confidence. Clear photos and counts, thank you.",
      {
        decision: "approve",
        confidence: Confidence.HIGH,
        feedback: "Clear photos and counts, thank you",
      },
    ],
    [
      "I approve this work, confidence: medium",
      { decision: "approve", confidence: Confidence.MEDIUM },
    ],
    [
      "Approve high confidence good work",
      { decision: "approve", confidence: Confidence.HIGH, feedback: "good work" },
    ],
    [
      "Reject. The photos show a different site.",
      { decision: "reject", feedback: "The photos show a different site" },
    ],
    [
      "Apruebo. Confianza alta. Fotos claras, gracias.",
      { decision: "approve", confidence: Confidence.HIGH, feedback: "Fotos claras, gracias" },
    ],
    [
      "Rejeito. As fotos são de outro lugar.",
      { decision: "reject", feedback: "As fotos são de outro lugar" },
    ],
    ["Aprovo. Alta.", { decision: "approve", confidence: Confidence.HIGH }],
    [
      "Actually reject, the photos show a different site",
      { decision: "reject", feedback: "the photos show a different site" },
    ],
    [
      "En realidad rechazo, las fotos son de otro lugar",
      { decision: "reject", feedback: "las fotos son de otro lugar" },
    ],
  ] as const)("reads %j", (text, expected) => {
    expect(readReviewAnswer(text, "decision")).toEqual(expected);
  });

  it.each([
    "Looks good to me, thank you so much!",
    "Great work, high five to the team",
    "I can't approve this yet",
    "Actually I can't approve this",
    "Not approved",
    "No apruebo esto",
    "Approve? I'm not sure",
    "Approve. Actually reject.",
    "Should I approve or reject?",
  ])("takes no decision from %j", (text) => {
    expect(readReviewAnswer(text, "decision").decision).toBeUndefined();
  });

  it("reads a bare level only where a confidence is expected", () => {
    expect(readReviewAnswer("high", "confidence")).toEqual({ confidence: Confidence.HIGH });
    expect(readReviewAnswer("media", "confidence")).toEqual({ confidence: Confidence.MEDIUM });
    // In feedback, "high" is a word like any other.
    expect(readReviewAnswer("high", "feedback")).toEqual({ feedback: "high" });
    expect(readReviewAnswer("the wall is high", "feedback")).toEqual({
      feedback: "the wall is high",
    });
  });

  it("keeps the whole answer as feedback when feedback is what was asked", () => {
    expect(readReviewAnswer("Clear photos and counts, thank you", "feedback")).toEqual({
      feedback: "Clear photos and counts, thank you",
    });
    // With nothing asked and nothing decided, words are not feedback.
    expect(readReviewAnswer("Clear photos and counts, thank you", null)).toEqual({});
  });
});
