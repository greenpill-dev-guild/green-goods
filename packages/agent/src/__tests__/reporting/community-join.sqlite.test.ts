import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TestBrowser } from "./support/browser";
import { AIYELOJA, TAS } from "./support/fixtures";
import { adaAccount, latestLink, reportUntilSummary } from "./support/flows";
import { ADA, Harness, summaryToken } from "./support/harness";

let harness: Harness;
beforeEach(() => {
  harness = new Harness({ settings: { communityGarden: TAS.address } });
});
afterEach(() => {
  harness.close();
});

async function pair() {
  const browser = new TestBrowser(harness.app);
  await browser.open(latestLink(harness));
  const proof = await browser.prove(adaAccount);
  await harness.say(ADA, String(proof.body.pairingCode));
}

/** A confirmed Community Garden report from a newly linked account, taken to the publish step. */
async function publishToCommunityGarden(beforePublishing: () => void) {
  const summary = await reportUntilSummary(harness);
  await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
  await pair();
  beforePublishing();
  const consent = harness.transport.texts().at(-1) ?? "";
  const token = /PUBLISH (\d{4})/.exec(consent)?.[1];
  if (!token) throw new Error("Missing publication consent");
  return (await harness.say(ADA, `PUBLISH ${token}`)).join("\n");
}

describe("Community Garden invitation", () => {
  it("sends a Join link on CONNECT when a linked account has no gardens", async () => {
    await harness.say(ADA, "START");
    await harness.press(ADA, "I agree");
    await harness.press(ADA, "Connect account");
    await pair();
    expect((await harness.say(ADA, "CONNECT"))[0]).toContain("join the Community Garden");
    expect(harness.transport.sent.at(-1)?.message.link?.label).toBe("Join the Community Garden");
  });

  // The garden is open to join, so a role in some other garden is no reason to send its member
  // to a steward instead.
  it.each([
    ["has no garden", false],
    ["is in another garden", true],
  ])("offers the same account-bound link for a Community Garden report when the account %s", async (_case, elsewhere) => {
    const reply = await publishToCommunityGarden(() => {
      if (elsewhere)
        harness.chain.grantRole(AIYELOJA.address, adaAccount.address, { gardener: true });
    });
    expect(reply).toContain("Join the Community Garden");
    expect(harness.transport.sent.at(-1)?.message.link?.label).toBe("Join the Community Garden");
    // Once they have joined, any reply reads the role again: the button is not the only way on.
    harness.chain.grantRole(TAS.address, adaAccount.address, { gardener: true });
    expect((await harness.say(ADA, "ok, I joined")).join("\n")).toContain(
      "Open this page to review and sign the exact publication"
    );
  });

  it("sends the account to a steward while the Community Garden would refuse its join", async () => {
    const reply = await publishToCommunityGarden(() => harness.chain.closed.add(TAS.address));
    expect(reply).toContain("ask a garden steward");
    expect(reply).not.toContain("Join the Community Garden");
  });

  it("does not offer Join on CONNECT when the account already belongs to another garden", async () => {
    await harness.say(ADA, "START");
    await harness.press(ADA, "I agree");
    await harness.press(ADA, "Connect account");
    await pair();
    harness.chain.grantRole(AIYELOJA.address, adaAccount.address, { gardener: true });
    const reply = await harness.say(ADA, "CONNECT");
    expect(reply.join("\n")).toContain("Aiyeloja Family Garden");
    expect(reply.join("\n")).not.toContain("Join the Community Garden");
  });

  it("warns that newly joined gardens can take time to appear after pairing", async () => {
    await harness.say(ADA, "START");
    await harness.press(ADA, "I agree");
    await harness.press(ADA, "Connect account");
    const browser = new TestBrowser(harness.app);
    await browser.open(latestLink(harness));
    const proof = await browser.prove(adaAccount);
    const reply = await harness.say(ADA, String(proof.body.pairingCode));
    expect(reply.join("\n")).toContain("can take a few minutes");
  });
});
