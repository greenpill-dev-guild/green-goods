import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TestBrowser } from "./support/browser";
import { adaAccount, bolaAccount, latestLink, reportUntilSummary } from "./support/flows";
import { TAS } from "./support/fixtures";
import { ADA, Harness, type Person, summaryToken } from "./support/harness";

/**
 * Moving an account to a new chat: fresh account proof, new-chat possession and one epoch
 * transition, through the real stores and browser API. Viem keys sign real messages.
 */
let harness: Harness;

beforeEach(() => {
  harness = new Harness();
});

afterEach(() => {
  harness.close();
});

const NEW_PHONE: Person = {
  realm: "synthetic:wefa",
  chatId: "chat-ada-new",
  subjectId: "+2340000000077",
};

function one<T>(sql: string, params: Record<string, string | number> = {}): T {
  return harness.core.db.query(sql).get(params) as T;
}

function codeFrom(texts: string[]): string {
  const code = texts
    .map((text) => /code on the Green Goods recovery page: (\d{6})/.exec(text)?.[1])
    .find(Boolean);
  if (!code) throw new Error("no recovery code was sent");
  return code;
}

/** Ada links her wallet on her first phone and leaves a draft open there. */
async function linkedOwnerWithDraft(): Promise<void> {
  harness.chain.grantRole(TAS.address, adaAccount.address, { gardener: true });
  const summary = await reportUntilSummary(harness);
  await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
  const browser = new TestBrowser(harness.app);
  await browser.open(latestLink(harness));
  const proof = await browser.prove(adaAccount);
  await harness.say(ADA, `PAIR ${proof.body.pairingCode}`);
}

async function startRecovery(person: Person = NEW_PHONE): Promise<TestBrowser> {
  await harness.say(person, "RECOVER");
  await harness.press(person, "I agree");
  const browser = new TestBrowser(harness.app);
  expect((await browser.open(latestLink(harness))).body.purpose).toBe("recovery");
  return browser;
}

describe("recovery", () => {
  it("moves the account and its unfinished report to the new chat and closes the old one", async () => {
    await linkedOwnerWithDraft();
    const participant = one<{ participant_id: string }>(
      "SELECT participant_id FROM account_bindings"
    ).participant_id;
    const epoch = one<{ identity_epoch: number }>(
      "SELECT identity_epoch FROM participants WHERE id = $id",
      {
        id: participant,
      }
    ).identity_epoch;

    const browser = await startRecovery();
    const sentBefore = harness.transport.sent.length;
    expect((await browser.prove(adaAccount)).status).toBe(200);
    await harness.drain();
    const code = codeFrom(
      harness.transport.sent.slice(sentBefore).map((sent) => sent.message.text)
    );
    // The old chat is suspended as soon as the owner's proof arrives.
    expect(await harness.say(ADA, "status")).toEqual([
      expect.stringContaining("paused while your account moves to another chat"),
    ]);

    const channel = await browser.request(
      "POST",
      `/messaging/recovery/${browser.challengeId}/channel`,
      {
        body: { code },
      }
    );
    expect(channel.body).toMatchObject({ ok: true, state: "channel_verified" });
    const applied = await browser.request(
      "POST",
      `/messaging/recovery/${browser.challengeId}/confirm`
    );
    expect(applied.body).toMatchObject({ ok: true, state: "applied" });
    // A lost response is safe to retry.
    expect(
      (await browser.request("POST", `/messaging/recovery/${browser.challengeId}/confirm`)).body
    ).toMatchObject({
      state: "applied",
    });
    await harness.drain();

    expect(
      one("SELECT identity_epoch FROM participants WHERE id = $id", { id: participant })
    ).toEqual({
      identity_epoch: epoch + 1,
    });
    expect(harness.transport.sent.at(-1)?.message.text).toContain(
      "This chat is now linked to your account."
    );
    // The unfinished report continues in the new chat.
    expect((await harness.say(NEW_PHONE, "status"))[0]).toContain("TAS");
    // The old chat is no longer processed for this owner and learns nothing.
    expect(await harness.say(ADA, "status")).toEqual([]);
  });

  it("lets only one of two concurrent recoveries win", async () => {
    await linkedOwnerWithDraft();
    const first = await startRecovery();
    const second = await startRecovery({
      ...NEW_PHONE,
      chatId: "chat-ada-third",
      subjectId: "+2340000000088",
    });
    const before = harness.transport.sent.length;
    await first.prove(adaAccount);
    await second.prove(adaAccount);
    await harness.drain();
    const codes = harness.transport.sent.slice(before).flatMap((sent) => {
      const match = /recovery page: (\d{6})/.exec(sent.message.text);
      return match?.[1] ? [match[1]] : [];
    });
    expect(codes).toHaveLength(2);
    await first.request("POST", `/messaging/recovery/${first.challengeId}/channel`, {
      body: { code: codes[0] },
    });
    await second.request("POST", `/messaging/recovery/${second.challengeId}/channel`, {
      body: { code: codes[1] },
    });
    const outcomes = [
      await first.request("POST", `/messaging/recovery/${first.challengeId}/confirm`),
      await second.request("POST", `/messaging/recovery/${second.challengeId}/confirm`),
    ].map((response) => response.status);
    expect(outcomes.sort()).toEqual([200, 409]);
    expect(one("SELECT count(*) AS n FROM channel_bindings WHERE status = 'active'")).toEqual({
      n: 1,
    });
  });

  it("refuses an account that is not linked without suspending the owner's chat", async () => {
    await linkedOwnerWithDraft();
    const browser = await startRecovery();
    // An unrelated account learns nothing and suspends nothing.
    expect((await browser.prove(bolaAccount)).status).toBe(403);
    expect(one("SELECT count(*) AS n FROM channel_bindings WHERE status = 'suspended'")).toEqual({
      n: 0,
    });
  });

  it("refuses a wrong code and a forwarded browser link", async () => {
    await linkedOwnerWithDraft();
    const owner = await startRecovery();
    await owner.prove(adaAccount);
    const wrong = await owner.request("POST", `/messaging/recovery/${owner.challengeId}/channel`, {
      body: { code: "000000" },
    });
    expect(wrong.status).toBe(403);
    // A forwarded recovery link in another browser has no pre-authentication cookie for it.
    const forwarded = new TestBrowser(harness.app);
    const attempt = await forwarded.request(
      "POST",
      `/messaging/recovery/${owner.challengeId}/confirm`
    );
    expect(attempt.status).toBe(401);
  });
});
