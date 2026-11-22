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
        feedback: "Clear photos and counts, thank you.",
      },
    ],
    [
      "I approve this work, confidence: medium",
      { decision: "approve", confidence: Confidence.MEDIUM },
    ],
    [
      "Approve high confidence. Good work",
      { decision: "approve", confidence: Confidence.HIGH, feedback: "Good work" },
    ],
    [
      "Approve. Great job! Did you water them?",
      { decision: "approve", feedback: "Great job! Did you water them?" },
    ],
    [
      "Reject. The photos show a different site.",
      { decision: "reject", feedback: "The photos show a different site." },
    ],
    [
      "Apruebo. Confianza alta. Fotos claras, gracias.",
      { decision: "approve", confidence: Confidence.HIGH, feedback: "Fotos claras, gracias." },
    ],
    [
      "Rejeito. As fotos são de outro lugar.",
      { decision: "reject", feedback: "As fotos são de outro lugar." },
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
    // Said after the decision word, a "no", a condition or a question takes the decision back.
    "Aprobar no, faltan fotos",
    "Aprovar não",
    "approve no",
    "Approve not yet, waiting for photos",
    "Approve, if the photos are fixed",
    "Approve if the photos are fixed",
    "Approve, or not?",
    "Approve, not sure",
    // A decision word inside a longer sentence is not a decision.
    "Reject any future reports without photos though",
    "Approve next time if you add photos",
    // A run-on with more after the decision is asked again.
    "Approve high confidence good work",
    // Taken back after a contrast, in a later sentence or line, or by a doubt anywhere.
    "Aprobar, pero no",
    "Aprovar, mas não",
    "Approve, but not yet",
    "Approve. Not yet.",
    "Approve\nnot yet",
    "Aprobar. No, faltan fotos.",
    "Approve. Not sure.",
    "Approve. Wait.",
    "Approve. Just kidding.",
    "Approve, as long as the photos are fixed",
    "Apruebo, siempre que manden fotos",
    "Apruebo, si mandan fotos",
    "Maybe approve. Probably fine.",
    "Approve, I think",
    "Approve. Tal vez.",
  ])("takes no decision from %j", (text) => {
    expect(readReviewAnswer(text, "decision").decision).toBeUndefined();
  });

  it("takes no decision from feedback that mentions one", () => {
    expect(
      readReviewAnswer("Great work. Reject any future reports without photos though.", "feedback")
    ).toEqual({ feedback: "Great work. Reject any future reports without photos though." });
    expect(readReviewAnswer("Approve next time if you add photos", "feedback")).toEqual({
      feedback: "Approve next time if you add photos",
    });
  });

  it("takes no confidence from a question, a doubt or two different levels", () => {
    expect(readReviewAnswer("High? not sure", "confidence")).toEqual({});
    expect(readReviewAnswer("High confidence?", "confidence")).toEqual({});
    expect(readReviewAnswer("high, but I'm not sure", "confidence")).toEqual({});
    expect(readReviewAnswer("Approve. Low confidence. High confidence.", "decision")).toEqual({
      decision: "approve",
    });
    // Words beside a level at the confidence question are not feedback: that is asked next.
    expect(readReviewAnswer("High, thanks!", "confidence")).toEqual({
      confidence: Confidence.HIGH,
    });
  });

  it("reads an approval written with a yes, an emoji or the invited confidence", () => {
    expect(readReviewAnswer("Apruebo, sí, buen trabajo", "decision")).toEqual({
      decision: "approve",
      feedback: "sí, buen trabajo",
    });
    expect(readReviewAnswer("Approve 👍", "decision")).toEqual({ decision: "approve" });
    expect(readReviewAnswer("Aprobado ✅", "decision")).toEqual({ decision: "approve" });
    expect(readReviewAnswer("Approve with high confidence", "decision")).toEqual({
      decision: "approve",
      confidence: Confidence.HIGH,
    });
    expect(readReviewAnswer("Aprovo com confiança alta", "decision")).toEqual({
      decision: "approve",
      confidence: Confidence.HIGH,
    });
  });

  it("keeps the spacing of the feedback around what was read", () => {
    expect(readReviewAnswer("Great job. Approve. Keep it up.", "decision").feedback).toBe(
      "Great job. Keep it up."
    );
    expect(readReviewAnswer("Thanks, approve, great work", "decision").feedback).toBe(
      "Thanks, great work"
    );
    expect(
      readReviewAnswer("Clear photos, approve, high confidence, keep going", "decision")
    ).toEqual({
      decision: "approve",
      confidence: Confidence.HIGH,
      feedback: "Clear photos, keep going",
    });
    expect(
      readReviewAnswer("Photos are clear; approve; high confidence; thanks", "decision").feedback
    ).toBe("Photos are clear; thanks");
    expect(readReviewAnswer("Great job.\nApprove.\nKeep it up.", "decision").feedback).toBe(
      "Great job.\nKeep it up."
    );
    // A level and a different bare level settle neither.
    expect(readReviewAnswer("Approve, high confidence. Low.", "decision")).toEqual({
      decision: "approve",
    });
  });

  it("keeps the steward's feedback in their own words", () => {
    expect(
      readReviewAnswer("High confidence that these photos are from another garden", "feedback")
    ).toEqual({ feedback: "High confidence that these photos are from another garden" });
    expect(readReviewAnswer("Clear photos, approve.", "decision")).toEqual({
      decision: "approve",
      feedback: "Clear photos",
    });
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
