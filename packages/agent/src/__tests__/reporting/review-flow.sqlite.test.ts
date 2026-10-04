import { envelopeIssues, type ResourceView } from "@green-goods/shared/modules/agent-reporting";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TestBrowser } from "./support/browser";
import {
  adaAccount,
  confirmLinkAndPublish,
  latestLink,
  openSigningPage,
  reportOutcome,
  reserve,
  stewardAccount,
} from "./support/flows";
import { TAS } from "./support/fixtures";
import { ADA, BOLA, Harness } from "./support/harness";

/**
 * Steward review through chat and the signing page: a linked operator lists pending work, records
 * an explicit decision, and signs it as themselves. Roles, self-review and the review envelope are
 * checked against the fake chain's resolver rules; this is orchestration proof, not live proof.
 */
let harness: Harness;

beforeEach(() => {
  harness = new Harness();
});

afterEach(() => {
  harness.close();
});

function sentTexts(): string[] {
  return harness.transport.sent.map((sent) => sent.message.text);
}

/** Ada publishes one report so there is real work waiting for review. */
async function publishedWork(): Promise<`0x${string}`> {
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
  const [workUID] = [...harness.chain.works.keys()];
  if (!workUID) throw new Error("No work was published");
  return workUID;
}

/** Bola agrees to processing and links the steward account through the browser and chat. */
async function linkedSteward(): Promise<void> {
  harness.chain.grantRole(TAS.address, stewardAccount.address, { operator: true });
  await harness.say(BOLA, "REVIEW");
  await harness.press(BOLA, "I agree");
  const browser = new TestBrowser(harness.app);
  await browser.open(latestLink(harness));
  const proof = await browser.prove(stewardAccount);
  expect(await harness.say(BOLA, `PAIR ${proof.body.pairingCode}`)).toEqual([
    `Your account ${stewardAccount.address.toLowerCase()} is now linked.\nYour gardens: TAS.`,
  ]);
}

async function openDecisionPage(): Promise<{ browser: TestBrowser; view: ResourceView }> {
  const browser = new TestBrowser(harness.app);
  await browser.open(latestLink(harness));
  await browser.prove(stewardAccount);
  const access = await browser.access();
  const scope = access.body.scope as { resourceKind: string; resourceId: string };
  expect(scope.resourceKind).toBe("review");
  const view = (
    await browser.request<ResourceView>("GET", `/messaging/reviews/${scope.resourceId}`)
  ).body;
  return { browser, view };
}

async function decide(decision: "Approve" | "Reject", feedback: string): Promise<string[]> {
  await harness.say(BOLA, "REVIEW");
  await harness.say(BOLA, "1");
  await harness.press(BOLA, decision);
  if (decision === "Approve") await harness.press(BOLA, "High");
  return harness.say(BOLA, feedback);
}

describe("steward review", () => {
  it("records an approval signed by the steward's own account", async () => {
    const workUID = await publishedWork();
    await linkedSteward();

    expect(await harness.say(BOLA, "REVIEW")).toEqual([
      "Work waiting for your review in TAS. Choose one to start:\n1. Tree planting (TAS)",
    ]);
    expect(await harness.say(BOLA, "1")).toEqual([
      `Do you approve or reject “Tree planting” by ${adaAccount.address.toLowerCase()}?\n1. Approve\n2. Reject`,
    ]);
    expect(await harness.press(BOLA, "Approve")).toEqual([
      "How confident are you in this work?\n1. Low\n2. Medium\n3. High",
    ]);
    await harness.press(BOLA, "High");
    const summary = await harness.say(BOLA, "Well documented, thank you");
    expect(summary[0]).toContain(
      "• Decision: Approve\n• Confidence: High\n• Feedback: Well documented, thank you\n• Method: human review"
    );
    const token = /CONFIRM (\d{4})/.exec(summary[0] ?? "")?.[1];
    expect(await harness.say(BOLA, `CONFIRM ${token}`)).toEqual([
      "Open this page to check and sign your decision with your wallet.",
    ]);

    const { browser, view } = await openDecisionPage();
    expect(view).toMatchObject({ kind: "review", state: "awaitingSignature", gardenLabel: "TAS" });
    const envelope = view.operation?.envelope;
    if (!envelope || envelope.kind !== "review") throw new Error("Expected a review envelope");
    expect(envelope.fields).toMatchObject({
      workUID,
      approved: true,
      confidence: 3,
      verificationMethod: 1,
      reviewNotesCID: "",
      feedback: "Well documented, thank you",
    });
    expect(
      envelopeIssues(envelope, {
        deployment: harness.chain.deployment,
        account: stewardAccount.address,
      })
    ).toEqual([]);

    const attempt = await reserve(browser, view, envelope);
    expect(attempt.status).toBe(200);
    const hash = harness.chain.submit({
      attester: stewardAccount.address,
      to: envelope.call.to,
      data: envelope.call.data,
    });
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: hash,
    });
    await harness.drain();
    expect(sentTexts().at(-1)).toBe(`Your review is recorded ✅\nTransaction: ${hash}`);
    expect(harness.chain.works.get(workUID)?.approved).toBe(true);
    expect(harness.core.db.query("SELECT lifecycle FROM review_intents").get()).toEqual({
      lifecycle: "recorded",
    });
  });

  it("requires feedback for a rejection and records confidence NONE", async () => {
    await publishedWork();
    await linkedSteward();
    await harness.say(BOLA, "REVIEW");
    await harness.say(BOLA, "1");
    expect(await harness.press(BOLA, "Reject")).toEqual([
      "Tell the gardener why you're rejecting this work (it will be public).",
    ]);
    // SKIP is only for approvals; the question is asked again.
    expect(await harness.say(BOLA, "SKIP")).toEqual([
      "Tell the gardener why you're rejecting this work (it will be public).",
    ]);
    const summary = await harness.say(BOLA, "The photos show a different site");
    expect(summary[0]).toContain("• Decision: Reject\n• Confidence: None");
    const token = /CONFIRM (\d{4})/.exec(summary[0] ?? "")?.[1];
    await harness.say(BOLA, `CONFIRM ${token}`);
    const { view } = await openDecisionPage();
    const envelope = view.operation?.envelope;
    if (!envelope || envelope.kind !== "review") throw new Error("Expected a review envelope");
    expect(envelope.fields).toMatchObject({
      approved: false,
      confidence: 0,
      verificationMethod: 1,
    });
  });

  it("never offers or accepts a steward's own work", async () => {
    await publishedWork();
    harness.chain.grantRole(TAS.address, adaAccount.address, { gardener: true, operator: true });
    expect(await harness.say(ADA, "REVIEW")).toEqual(["There's no work waiting for your review."]);
  });

  it("tells a linked account without an operator role that it cannot review", async () => {
    await publishedWork();
    await linkedSteward();
    harness.chain.grantRole(TAS.address, stewardAccount.address, {});
    expect(await harness.say(BOLA, "REVIEW")).toEqual([
      "Your account isn't a steward of any garden, so there's no work for you to review.",
    ]);
  });

  it("denies signing when the operator role was removed after confirmation", async () => {
    await publishedWork();
    await linkedSteward();
    const summary = await decide("Approve", "Looks right");
    const token = /CONFIRM (\d{4})/.exec(summary[0] ?? "")?.[1];
    await harness.say(BOLA, `CONFIRM ${token}`);
    const { browser, view } = await openDecisionPage();
    const envelope = view.operation?.envelope;
    if (!envelope) throw new Error("Expected an envelope");
    harness.chain.grantRole(TAS.address, stewardAccount.address, { gardener: true });
    expect((await reserve(browser, view, envelope)).status).toBe(403);
  });

  it("returns a declined decision signature to the steward for reconfirmation", async () => {
    await publishedWork();
    await linkedSteward();
    const summary = await decide("Approve", "Looks right");
    const token = /CONFIRM (\d{4})/.exec(summary[0] ?? "")?.[1];
    await harness.say(BOLA, `CONFIRM ${token}`);
    const { browser, view } = await openDecisionPage();
    const envelope = view.operation?.envelope;
    if (!envelope) throw new Error("Expected an envelope");
    const attempt = await reserve(browser, view, envelope);
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "rejected_before_send",
      reason: "user_rejected",
    });
    await harness.drain();
    expect(sentTexts().at(-2)).toBe(
      "The signature was declined, so your review wasn't recorded. Here it is again; confirm it when you're ready."
    );
    expect(sentTexts().at(-1)).toContain("• Decision: Approve");
    expect(
      harness.core.db
        .query(
          "SELECT count(*) AS n FROM confirmations WHERE review_intent_id IS NOT NULL AND invalidated_at IS NULL"
        )
        .get()
    ).toEqual({ n: 0 });
  });
});
