import { Confidence } from "@green-goods/shared/types/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reportingText } from "../../services/reporting/copy";
import { openPrompt } from "../../services/reporting/prompts";
import { openReviewFor, reviewState } from "../../services/reporting/reviews";
import { TestBrowser } from "./support/browser";
import { TAS } from "./support/fixtures";
import {
  adaAccount,
  confirmLinkAndPublish,
  latestLink,
  openSigningPage,
  reportOutcome,
  reserve,
  stewardAccount,
} from "./support/flows";
import { BOLA, Harness, type Person } from "./support/harness";

/**
 * A steward's review in conversation, with every model off, in English, Spanish and Portuguese,
 * checked by what the decision holds after each turn. Authority and signing are covered in
 * review-flow.sqlite.test.ts; this is the talking.
 */
let harness: Harness;

beforeEach(() => {
  harness = new Harness();
});

afterEach(() => {
  harness.close();
});

const WORDS = {
  en: {
    review: "REVIEW",
    all: "Approve. High confidence. Clear photos and counts, thank you.",
    feedback: "Clear photos and counts, thank you.",
    praise: "Looks good to me, thank you!",
    reject: "Reject.",
    why: "The photos show a different site",
    correction: "Actually reject, the photos show a different site",
    refused: "Approve not yet, waiting for photos",
    approveOnly: "Approve. High confidence.",
    unsure: "Reject? Not sure yet.",
    mentions: "I can't approve this without photos of the site",
  },
  es: {
    review: "REVIEW",
    all: "Apruebo. Confianza alta. Fotos y conteos claros, gracias.",
    feedback: "Fotos y conteos claros, gracias.",
    praise: "Me parece bien, ¡gracias!",
    reject: "Rechazo.",
    why: "Las fotos son de otro lugar",
    correction: "En realidad rechazo, las fotos son de otro lugar",
    refused: "Aprobar no, faltan fotos",
    approveOnly: "Apruebo. Confianza alta.",
    unsure: "¿Rechazo? No estoy seguro.",
    mentions: "No puedo aprobar sin fotos del sitio",
  },
  pt: {
    review: "REVIEW",
    all: "Aprovo. Confiança alta. Fotos e contagens claras, obrigado.",
    feedback: "Fotos e contagens claras, obrigado.",
    praise: "Parece bom para mim, obrigado!",
    reject: "Rejeito.",
    why: "As fotos são de outro lugar",
    correction: "Na verdade rejeito, as fotos são de outro lugar",
    refused: "Aprovar não, faltam fotos",
    approveOnly: "Aprovo. Confiança alta.",
    unsure: "Rejeito? Não tenho certeza.",
    mentions: "Não posso aprovar sem fotos do local",
  },
} as const;

type Locale = keyof typeof WORDS;

/** Ada publishes one report at TAS, so there is work waiting for a steward. */
async function publishedWork(): Promise<void> {
  await confirmLinkAndPublish(harness);
  const { browser, view, envelope } = await openSigningPage(harness);
  const attempt = await reserve(browser, view, envelope);
  const hash = harness.chain.submit({
    attester: adaAccount.address,
    to: envelope.call.to,
    data: envelope.call.data,
  });
  await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
    kind: "broadcast",
    transactionHash: hash,
  });
  await harness.drain();
}

/** What the steward's open decision holds, and the question the chat has open. */
function decision(_steward: Person) {
  const row = harness.core.db
    .query(
      `SELECT b.participant_id AS participant, e.conversation_id AS conversation
       FROM channel_bindings b JOIN inbox_events e ON e.channel_subject_id = b.channel_subject_id
       WHERE b.status IN ('provisional','active') ORDER BY e.arrival_seq DESC LIMIT 1`
    )
    .get() as { participant: string; conversation: string };
  const review = openReviewFor(harness.core, row.participant, row.conversation);
  const prompt = openPrompt(harness.core, row.conversation);
  return {
    decision: review?.content.decision ?? null,
    confidence: review?.content.confidence ?? null,
    feedback: review?.content.feedback ?? null,
    revision: review?.revision ?? null,
    state: review ? reviewState(review) : null,
    question: prompt?.kind ?? null,
    token: prompt?.token ?? null,
  };
}

describe.each(Object.keys(WORDS) as Locale[])("a steward's review, in %s", (locale) => {
  const words = WORDS[locale];
  const steward: Person = { ...BOLA, locale };

  /** The steward asks to review, agrees to the notice, links the account and opens the work. */
  async function reviewing(): Promise<string[]> {
    await publishedWork();
    harness.chain.grantRole(TAS.address, stewardAccount.address, { operator: true });
    await harness.say(steward, words.review);
    const agreed = await harness.press(steward, reportingText(locale, "consent.agree"));
    // Someone who came to review is thanked, and not asked about work they did.
    expect(agreed[0]).toBe(reportingText(locale, "consent.grantedPlain"));
    const browser = new TestBrowser(harness.app);
    await browser.open(latestLink(harness));
    const proof = await browser.prove(stewardAccount);
    // Linking carries on with the review: the work list comes without REVIEW being sent again.
    const linked = await harness.say(steward, `PAIR ${proof.body.pairingCode}`);
    expect(linked).toHaveLength(2);
    return harness.say(steward, "1");
  }

  it("takes decision, confidence and feedback from one answer, and shows the summary", async () => {
    const asked = await reviewing();
    expect(decision(steward).question).toBe("review_decision");
    expect(asked[0]).toContain(reportingText(locale, "review.approve"));

    const replies = await harness.say(steward, words.all);
    expect(decision(steward)).toMatchObject({
      decision: "approve",
      confidence: Confidence.HIGH,
      feedback: words.feedback,
      question: "confirm_review",
    });
    expect(replies).toHaveLength(1);
  });

  it("decides nothing from kind words, and asks a rejection for its reason", async () => {
    await reviewing();
    await harness.say(steward, words.praise);
    expect(decision(steward)).toMatchObject({ decision: null, question: "review_decision" });

    await harness.say(steward, words.reject);
    expect(decision(steward)).toMatchObject({
      decision: "reject",
      confidence: Confidence.NONE,
      feedback: null,
      question: "review_feedback",
    });
    await harness.say(steward, words.why);
    expect(decision(steward)).toMatchObject({ feedback: words.why, question: "confirm_review" });
  });

  it("takes a correction typed at the summary, and stops the earlier summary from confirming", async () => {
    await reviewing();
    await harness.say(steward, words.all);
    const shown = decision(steward);

    await harness.say(steward, words.correction);
    const corrected = decision(steward);
    expect(corrected).toMatchObject({
      decision: "reject",
      confidence: Confidence.NONE,
      question: "confirm_review",
    });
    expect(corrected.feedback).toBe(words.correction.slice(words.correction.indexOf(",") + 2));
    expect(corrected.revision).toBeGreaterThan(shown.revision ?? 0);
    await harness.say(steward, `CONFIRM ${shown.token}`);
    expect(decision(steward).state).toBe(corrected.state);
    expect(decision(steward).question).toBe("confirm_review");
  });

  it("asks a changed decision for its own feedback, and takes no decision from a refusal", async () => {
    await reviewing();
    await harness.say(steward, words.refused);
    expect(decision(steward)).toMatchObject({ decision: null, question: "review_decision" });

    await harness.say(steward, words.all);
    // "Reject" at the summary: the approval's thanks is not the rejection's reason.
    await harness.say(steward, words.reject);
    expect(decision(steward)).toMatchObject({
      decision: "reject",
      feedback: null,
      question: "review_feedback",
    });
    await harness.say(steward, words.why);
    expect(decision(steward)).toMatchObject({ feedback: words.why, question: "confirm_review" });
  });

  it("never keeps the other decision's words as feedback it could not read", async () => {
    await reviewing();
    await harness.say(steward, words.approveOnly);
    expect(decision(steward)).toMatchObject({ decision: "approve", question: "review_feedback" });
    await harness.say(steward, words.unsure);
    expect(decision(steward)).toMatchObject({
      decision: "approve",
      feedback: null,
      question: "review_feedback",
    });
  });

  it("takes a rejection's reason that only mentions approving", async () => {
    await reviewing();
    await harness.say(steward, words.reject);
    await harness.say(steward, words.mentions);
    expect(decision(steward)).toMatchObject({
      decision: "reject",
      feedback: words.mentions,
      question: "confirm_review",
    });
  });

  it("cancels a decision in the middle and records nothing", async () => {
    await reviewing();
    await harness.say(steward, words.reject);
    const replies = await harness.say(steward, "CANCEL");
    expect(replies).toEqual([reportingText(locale, "review.cancelled")]);
    expect(decision(steward)).toMatchObject({ decision: null, state: null });
    expect(harness.core.db.query("SELECT lifecycle FROM review_intents").all()).toEqual([
      { lifecycle: "cancelled" },
    ]);
  });
});
