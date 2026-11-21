import { envelopeIssues, type ResourceView } from "@green-goods/shared/modules/agent-reporting";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setControl } from "../../services/reporting/controls";
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
import { ADA, BOLA, Harness, summaryToken } from "./support/harness";

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

/**
 * Bola agrees to processing and links the steward account through the browser and chat. Pairing
 * carries on with the review Bola asked for, so its replies end with the work waiting.
 */
async function linkedSteward(): Promise<string[]> {
  harness.chain.grantRole(TAS.address, stewardAccount.address, { operator: true });
  await harness.say(BOLA, "REVIEW");
  await harness.press(BOLA, "I agree");
  const browser = new TestBrowser(harness.app);
  await browser.open(latestLink(harness));
  const proof = await browser.prove(stewardAccount);
  const [linked, ...review] = await harness.say(BOLA, `PAIR ${proof.body.pairingCode}`);
  expect(linked).toBe(
    `Your account ${stewardAccount.address.toLowerCase()} is now linked.\nYour gardens: TAS.`
  );
  return review;
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
    // Bola asked to review before linking, so linking shows the work without REVIEW being sent again.
    expect(await linkedSteward()).toEqual([
      "Work waiting for your review in TAS. Choose one to start:\n1. Tree planting (TAS)",
    ]);
    // A decision's answers have nothing to do with a garden's activities, so none are read, even
    // for a steward whose account is in a single garden.
    const activityReads = harness.catalog.calls;
    expect(await harness.say(BOLA, "1")).toEqual([
      `Do you approve or reject “Tree planting” by ${adaAccount.address.toLowerCase()}?\n1. Approve\n2. Reject`,
    ]);
    expect(await harness.press(BOLA, "Approve")).toEqual([
      "How confident are you in this work?\n1. Low\n2. Medium\n3. High",
    ]);
    await harness.press(BOLA, "High");
    // ACCOUNT at the feedback question is a command, so the word never becomes public feedback:
    // it shows the account, and the question stays open for the real feedback.
    expect(await harness.say(BOLA, "ACCOUNT")).toEqual([
      `This chat is connected to ${stewardAccount.address.toLowerCase()}.\nYour gardens: TAS.\nTo use a different account, send SWITCH.`,
    ]);
    const summary = await harness.say(BOLA, "Well documented, thank you");
    expect(harness.catalog.calls).toBe(activityReads);
    expect(summary[0]).toContain(
      "• Decision: Approve\n• Confidence: High\n• Feedback: Well documented, thank you\n• Method: human review"
    );
    const token = /CONFIRM (\d{4})/.exec(summary[0] ?? "")?.[1];
    expect((await harness.say(BOLA, `CONFIRM ${token}`))[0]).toContain(
      "Open this page to check and sign your decision with your wallet."
    );

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
    const { decisionUID } = harness.core.db
      .query(
        "SELECT attestation_uid AS decisionUID FROM execution_operations WHERE kind = 'review'"
      )
      .get() as { decisionUID: string };
    // Three 32-byte identifiers that must not trade places: the decision's own attestation, the
    // transaction that carried it, and the work it decided.
    expect(new Set([decisionUID, hash, workUID]).size).toBe(3);
    const recorded = harness.transport.sent.at(-1)?.message;
    expect(recorded?.text).toBe("Your review is recorded ✅");
    expect(recorded?.records).toEqual([
      {
        url: `https://arbitrum.easscan.org/attestation/view/${decisionUID}`,
        label: "View attestation",
      },
      { url: `https://arbiscan.io/tx/${hash}`, label: "View transaction" },
      { url: `https://arbitrum.easscan.org/attestation/view/${workUID}`, label: "View the work" },
    ]);
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
    // While the decision's question is showing, a story would only put it again, so NEW says the
    // review comes first and STATUS shows the question it waits on.
    expect(await harness.say(BOLA, "NEW")).toEqual([
      "You have a review in progress. Send CANCEL to discard it or keep going with it.",
    ]);
    expect(await harness.say(BOLA, "STATUS")).toEqual([
      `Do you approve or reject “Tree planting” by ${adaAccount.address.toLowerCase()}?\n1. Approve\n2. Reject`,
    ]);
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

  it("keeps an open decision ahead of a new report after STOP, START and consent", async () => {
    await publishedWork();
    await linkedSteward();
    await harness.say(BOLA, "REVIEW");
    await harness.say(BOLA, "1");
    const decision = `Do you approve or reject “Tree planting” by ${adaAccount.address.toLowerCase()}?\n1. Approve\n2. Reject`;
    // STOP closes the decision's question and leaves the decision open.
    expect((await harness.say(BOLA, "STOP"))[0]).toMatch(/^You've stopped the assistant\./);
    expect((await harness.say(BOLA, "START"))[0]).toContain("Do you agree?");
    await harness.press(BOLA, "I agree");
    expect(await harness.say(BOLA, "NEW")).toEqual([
      "You have a review in progress. Send CANCEL to discard it or keep going with it.",
      decision,
    ]);
    expect(await harness.say(BOLA, "STATUS")).toEqual([decision]);
    // With its question showing again, a story goes to the decision, not to a report beside it.
    expect(await harness.say(BOLA, "Weeded the beds this morning")).toEqual([decision]);
    expect(harness.core.db.query("SELECT count(*) AS n FROM work_drafts").get()).toEqual({ n: 1 });
  });

  it("says once when a decision's signing link expires unused, and RETRY sends a fresh one", async () => {
    const LINK_EXPIRED =
      "Your signing link expired before anything was sent, so your review wasn't recorded. Your decision is saved; reply RETRY for a new link.";
    await publishedWork();
    await linkedSteward();
    const summary = await decide("Approve", "Looks right");
    const token = /CONFIRM (\d{4})/.exec(summary[0] ?? "")?.[1];
    await harness.say(BOLA, `CONFIRM ${token}`);
    const expired = latestLink(harness);

    harness.clock.advance(harness.core.settings.linkChallengeTtlMs);
    await harness.drain();
    expect(sentTexts().at(-1)).toBe(LINK_EXPIRED);
    harness.clock.advance(60 * 60_000);
    await harness.drain();
    expect(sentTexts().filter((text) => text === LINK_EXPIRED)).toHaveLength(1);
    expect(await harness.say(BOLA, "STATUS")).toEqual([LINK_EXPIRED]);

    const fresh = await harness.say(BOLA, "RETRY");
    expect(fresh[0]).toContain("Open this page to check and sign your decision with your wallet.");
    expect(latestLink(harness)).not.toBe(expired);

    // The fresh link signs the decision already confirmed, and records it.
    const { browser, view } = await openDecisionPage();
    const envelope = view.operation?.envelope;
    if (!envelope) throw new Error("Expected an envelope");
    const attempt = await reserve(browser, view, envelope);
    expect(attempt.status).toBe(200);
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: harness.chain.submit({
        attester: stewardAccount.address,
        to: envelope.call.to,
        data: envelope.call.data,
      }),
    });
    await harness.drain();
    expect(sentTexts().at(-1)).toBe("Your review is recorded ✅");
    // The fresh link's own expiry comes after the send, so it says nothing.
    const said = sentTexts().length;
    harness.clock.advance(
      harness.core.settings.linkChallengeTtlMs + harness.core.settings.browserSessionTtlMs
    );
    await harness.drain();
    expect(sentTexts().slice(said)).not.toContain(LINK_EXPIRED);
  });

  it("sends a lapsed decision's fresh link on RETRY even while a report is open beside it", async () => {
    await publishedWork();
    await linkedSteward();
    const summary = await decide("Approve", "Looks right");
    const token = /CONFIRM (\d{4})/.exec(summary[0] ?? "")?.[1];
    await harness.say(BOLA, `CONFIRM ${token}`);
    const expired = latestLink(harness);
    // The steward starts a report of their own while the decision waits for its signature.
    await harness.say(BOLA, "Today I planted twelve baobab seedlings by the fence");
    expect(harness.core.db.query("SELECT count(*) AS n FROM work_drafts").get()).toEqual({ n: 2 });
    // The decision's link is the last one the chat sent, so NEW LINK refreshes it, lapsed or not.
    const live = await harness.say(BOLA, "new link");
    expect(live[0]).toContain("Open this page to check and sign your decision with your wallet.");
    expect(latestLink(harness)).not.toBe(expired);
    harness.clock.advance(harness.core.settings.linkChallengeTtlMs);
    await harness.drain();

    const lapsed = latestLink(harness);
    const fresh = await harness.say(BOLA, "RETRY");
    expect(fresh[0]).toContain("Open this page to check and sign your decision with your wallet.");
    expect(latestLink(harness)).not.toBe(lapsed);
  });

  it("sends NEW LINK to the report when its link went out after the decision's, in the same instant", async () => {
    await publishedWork();
    await linkedSteward();
    const summary = await decide("Approve", "Looks right");
    const token = /CONFIRM (\d{4})/.exec(summary[0] ?? "")?.[1];
    await harness.say(BOLA, `CONFIRM ${token}`);
    // The steward then reports work of their own and is sent its publishing link. The test clock
    // has not moved, so both links carry the same time and only their order tells them apart.
    harness.chain.grantRole(TAS.address, stewardAccount.address, {
      gardener: true,
      operator: true,
    });
    await harness.say(BOLA, "Today I planted twelve baobab seedlings by the fence");
    await harness.press(BOLA, "Tree planting");
    await harness.say(BOLA, "12");
    await harness.say(BOLA, "2");
    const report = await harness.say(BOLA, "3 hours");
    expect((await harness.say(BOLA, `CONFIRM ${summaryToken(report)}`))[0]).toContain(
      "Open this page to review and sign the exact publication"
    );
    harness.clock.advance(harness.core.settings.linkChallengeTtlMs);
    await harness.drain();

    expect((await harness.say(BOLA, "new link"))[0]).toContain(
      "Open this page to review and sign the exact publication with your wallet."
    );
  });

  it("never offers or accepts a steward's own work", async () => {
    await publishedWork();
    harness.chain.grantRole(TAS.address, adaAccount.address, { gardener: true, operator: true });
    expect(await harness.say(ADA, "REVIEW")).toEqual(["There's no work waiting for your review."]);
  });

  it("keeps what a steward said about someone's work out of what a model later reads", async () => {
    await publishedWork();
    await linkedSteward();
    await decide("Approve", "The counts look inflated to me");
    await harness.say(BOLA, "CANCEL");
    setControl(harness.core, "model_processing", true, { actor: "test", reason: "review turns" });
    harness.interpreter.responses = [
      { intent: "unclear", gardenKey: null, actionUID: null, facts: [], models: ["fixture-model"] },
    ];
    await harness.say(BOLA, "I also weeded the north beds today");

    const request = harness.interpreter.requests.at(-1);
    expect(request?.message.text).toBe("I also weeded the north beds today");
    expect(JSON.stringify(request)).not.toMatch(/inflated|approve or reject|How confident/i);
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

  it("answers a steward's follow-ups with the stopped check once a decision's check gives up", async () => {
    await publishedWork();
    await linkedSteward();
    const summary = await decide("Approve", "Looks right");
    const token = /CONFIRM (\d{4})/.exec(summary[0] ?? "")?.[1];
    await harness.say(BOLA, `CONFIRM ${token}`);
    const { browser, view } = await openDecisionPage();
    const envelope = view.operation?.envelope;
    if (!envelope) throw new Error("Expected an envelope");
    expect((await reserve(browser, view, envelope)).status).toBe(200);
    // The page is closed before it reports, and the decision never lands.
    harness.clock.advance(harness.core.settings.walletResponseWindowMs);
    await harness.drain();
    for (let pass = 0; pass < 45; pass += 1) {
      harness.clock.advance(30_000);
      await harness.drain();
    }
    const stopped =
      "I've checked the chain and still can't find your review, so I've stopped checking. I won't send it again. If it doesn't show on the work, write to contact@greengoods.app.";
    expect(sentTexts().filter((text) => text === stopped)).toHaveLength(1);
    expect(await harness.say(BOLA, "STATUS")).toEqual([stopped]);
    expect(await harness.say(BOLA, "EDIT")).toEqual([stopped]);
    expect(await harness.say(BOLA, "CANCEL")).toEqual([stopped]);
  });

  it("tells a steward a sent decision is still confirming, and when its check stops with the attestation unread", async () => {
    await publishedWork();
    await linkedSteward();
    const summary = await decide("Approve", "Looks right");
    const token = /CONFIRM (\d{4})/.exec(summary[0] ?? "")?.[1];
    await harness.say(BOLA, `CONFIRM ${token}`);
    const { browser, view } = await openDecisionPage();
    const envelope = view.operation?.envelope;
    if (!envelope) throw new Error("Expected an envelope");
    const attempt = await reserve(browser, view, envelope);
    const hash = harness.chain.submit({
      attester: stewardAccount.address,
      to: envelope.call.to,
      data: envelope.call.data,
    });
    harness.chain.hidden.add(hash);
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: hash,
    });
    await harness.drain();
    const passes = async (count: number) => {
      for (let pass = 0; pass < count; pass += 1) {
        harness.clock.advance(30_000);
        await harness.drain();
      }
    };
    const confirming =
      "Sent. Confirming is taking longer than usual. You can leave, and you don't need to send it again. I'll message you when your review is recorded.";
    await passes(6);
    expect(sentTexts().filter((text) => text === confirming)).toHaveLength(1);

    // The decision is mined, but its attestation is never read back.
    harness.chain.hidden.delete(hash);
    harness.chain.attestationsUnread = true;
    await passes(45);
    const unread =
      "The transaction is confirmed, but I still can't read its attestation details, so I've stopped checking. You don't need to sign or send anything again. If your review doesn't show on the work, write to contact@greengoods.app.";
    expect(sentTexts().filter((text) => text === unread)).toHaveLength(1);
    expect(await harness.say(BOLA, "STATUS")).toEqual([unread]);
  });

  // PRD-1568: the page could not report the proposal's hash first, so the proposal comes alone.
  it("tells a steward a decision a Safe only proposed waits for its signers, and records it once run", async () => {
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
      kind: "safe_proposal",
      safeTxHash: `0x${"5a".repeat(32)}`,
    });
    await harness.drain();
    const safeSigners =
      "Waiting for the Safe's signers. Your Safe has the proposal. It goes through once enough of the Safe's owners sign it. I'll message you when your review is recorded.";
    expect(sentTexts().filter((text) => text === safeSigners)).toHaveLength(1);
    expect(await harness.say(BOLA, "STATUS")).toEqual([safeSigners]);

    harness.chain.submit({
      attester: stewardAccount.address,
      to: envelope.call.to,
      data: envelope.call.data,
    });
    harness.clock.advance(10 * 60_000);
    await harness.drain();
    expect(sentTexts().at(-1)).toBe("Your review is recorded ✅");
  });
});
