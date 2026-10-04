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

describe("Community Garden invitation", () => {
  it("sends a Join link on CONNECT when a linked account has no gardens", async () => {
    await harness.say(ADA, "START");
    await harness.press(ADA, "I agree");
    await harness.press(ADA, "Connect account");
    await pair();
    expect((await harness.say(ADA, "CONNECT"))[0]).toContain("join the Community Garden");
    expect(harness.transport.sent.at(-1)?.message.link?.label).toBe("Join the Community Garden");
  });

  it("offers the same account-bound link when the report's Community Garden role is missing", async () => {
    const summary = await reportUntilSummary(harness);
    await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
    await pair();
    const consent = harness.transport.texts().at(-1) ?? "";
    const token = /PUBLISH (\d{4})/.exec(consent)?.[1];
    if (!token) throw new Error("Missing publication consent");
    const reply = await harness.say(ADA, `PUBLISH ${token}`);
    expect(reply.join("\n")).toContain("Join the Community Garden");
    expect(harness.transport.sent.at(-1)?.message.link?.label).toBe("Join the Community Garden");
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
