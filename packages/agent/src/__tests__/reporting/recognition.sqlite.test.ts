import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { challengeById } from "../../services/reporting/browser-access";
import {
  issueContinuation,
  requestById,
  type ContinuationRequest,
} from "../../services/reporting/continuations";
import { RECOGNITION_TTL_MS } from "../../services/reporting/recognition";
import { TestBrowser } from "./support/browser";
import { adaAccount, bolaAccount, latestLink, reportUntilSummary } from "./support/flows";
import { ADA, BOLA, Harness, summaryToken } from "./support/harness";

let harness: Harness;
beforeEach(() => {
  harness = new Harness();
});
afterEach(() => {
  harness.close();
});

function anotherLink(request: ContinuationRequest, overrides: Partial<ContinuationRequest> = {}) {
  return issueContinuation(harness.core, {
    purpose: request.purpose,
    participantId: request.participantId,
    subjectId: request.subjectId,
    bindingId: request.bindingId,
    conversationId: request.conversationId,
    providerRealm: request.providerRealm,
    resourceKind: request.resourceKind,
    resourceId: request.resourceId,
    resourceRevision: request.resourceRevision,
    resourceDigest: request.resourceDigest,
    expectedAccount: request.expectedAccount,
    identityEpoch: request.identityEpoch,
    ...overrides,
  }).url;
}

async function pairedBrowser() {
  const summary = await reportUntilSummary(harness);
  await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
  const browser = new TestBrowser(harness.app);
  expect((await browser.open(latestLink(harness))).body.state).toBe("issued");
  const challenge = challengeById(harness.core, browser.challengeId ?? "");
  if (!challenge) throw new Error("Missing browser challenge");
  const request = requestById(harness.core, challenge.requestId);
  if (!request) throw new Error("Missing continuation");
  const proof = await browser.prove(adaAccount);
  expect(proof.body.state).toBe("proof_verified");
  // A code alone is accepted only while this browser is waiting for chat pairing.
  await harness.say(ADA, String(proof.body.pairingCode));
  const poll = await browser.request("GET", `/messaging/challenges/${browser.challengeId}`);
  expect(poll.body.state).toBe("paired");
  expect([...browser.cookies.keys()].some((name) => name.includes("recognition"))).toBe(true);
  return { browser, request };
}

describe("short browser recognition", () => {
  it("skips proof only in the paired browser for the same account and current identity", async () => {
    const { browser, request } = await pairedBrowser();
    const url = anotherLink(request);
    expect((await browser.open(url)).body).toMatchObject({
      state: "paired",
      account: adaAccount.address.toLowerCase(),
    });
  });

  it("does not recognize a different browser", async () => {
    const { request } = await pairedBrowser();
    const url = anotherLink(request);
    expect((await new TestBrowser(harness.app).open(url)).body.state).toBe("issued");
  });

  it("does not recognize a link that expects another account", async () => {
    const { browser, request } = await pairedBrowser();
    expect(
      (await browser.open(anotherLink(request, { expectedAccount: bolaAccount.address }))).body
        .state
    ).toBe("issued");
  });

  it("does not recognize another chat's link in the same browser", async () => {
    const { browser } = await pairedBrowser();
    await harness.say(BOLA, "START");
    await harness.press(BOLA, "I agree");
    await harness.say(BOLA, "CONNECT");
    expect((await browser.open(latestLink(harness))).body.state).toBe("issued");
  });

  it("expires after 15 minutes and never recognizes a recovery link", async () => {
    const { browser, request } = await pairedBrowser();
    expect(
      (await browser.open(anotherLink(request, { purpose: "recovery", resourceKind: "recovery" })))
        .body.state
    ).toBe("issued");
    harness.clock.advance(RECOGNITION_TTL_MS + 1);
    expect((await browser.open(anotherLink(request))).body.state).toBe("issued");
  });

  it("rejects a cookie from a previous identity epoch", async () => {
    const { browser, request } = await pairedBrowser();
    const next = request.identityEpoch + 1;
    harness.core.db
      .query("UPDATE participants SET identity_epoch = $epoch WHERE id = $id")
      .run({ epoch: next, id: request.participantId });
    harness.core.db
      .query("UPDATE channel_bindings SET identity_epoch = $epoch WHERE id = $id")
      .run({ epoch: next, id: request.bindingId });
    expect((await browser.open(anotherLink(request, { identityEpoch: next }))).body.state).toBe(
      "issued"
    );
  });
});
