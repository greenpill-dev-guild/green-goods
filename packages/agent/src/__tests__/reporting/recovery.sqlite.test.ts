import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { issueContinuation } from "../../services/reporting/continuations";
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

  it("refuses an account that is not linked, a wrong code and a forwarded link", async () => {
    await linkedOwnerWithDraft();
    const browser = await startRecovery();
    // An unrelated account learns nothing and suspends nothing.
    expect((await browser.prove(bolaAccount)).status).toBe(403);
    expect(one("SELECT count(*) AS n FROM channel_bindings WHERE status = 'suspended'")).toEqual({
      n: 0,
    });

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

const WHATSAPP: Person = {
  realm: "whatsapp-fixture:wefa",
  chatId: "wa-ada",
  subjectId: "+2340000000001",
};
const TELEGRAM: Person = {
  realm: "telegram-fixture:green-goods",
  chatId: "tg-ada",
  subjectId: "1001",
};

async function proveNewChannel(person: Person) {
  const summary = await reportUntilSummary(harness, person);
  await harness.say(person, `CONFIRM ${summaryToken(summary)}`);
  const browser = new TestBrowser(harness.app);
  await browser.open(latestLink(harness));
  const proof = await browser.prove(adaAccount);
  return { browser, proof };
}
async function linkChannel(person: Person) {
  harness.chain.grantRole(TAS.address, adaAccount.address, { gardener: true });
  const result = await proveNewChannel(person);
  await harness.say(person, `PAIR ${result.proof.body.pairingCode}`);
  return result;
}

async function finishRecovery(browser: TestBrowser) {
  const before = harness.transport.sent.length;
  expect((await browser.prove(adaAccount)).status).toBe(200);
  await harness.drain();
  const code = codeFrom(harness.transport.sent.slice(before).map((sent) => sent.message.text));
  expect(
    (
      await browser.request("POST", `/messaging/recovery/${browser.challengeId}/channel`, {
        body: { code },
      })
    ).status
  ).toBe(200);
  expect(
    (await browser.request("POST", `/messaging/recovery/${browser.challengeId}/confirm`)).status
  ).toBe(200);
  await harness.drain();
}

describe("one account with independent Telegram and WhatsApp channels", () => {
  it("refuses a second proven account after another pairing established the participant", async () => {
    const first = await proveNewChannel(WHATSAPP);
    const binding = one<{
      participant_id: string;
      subject_id: string;
      binding_id: string;
      conversation_id: string;
    }>(
      `SELECT b.participant_id, s.id AS subject_id, b.id AS binding_id, i.conversation_id
       FROM channel_bindings b JOIN channel_subjects s ON s.id = b.channel_subject_id
       JOIN inbox_events i ON i.channel_subject_id = s.id WHERE s.provider_realm = $realm
       ORDER BY i.arrival_seq DESC LIMIT 1`,
      { realm: WHATSAPP.realm }
    );
    const { url } = issueContinuation(harness.core, {
      purpose: "link_account",
      participantId: binding.participant_id,
      subjectId: binding.subject_id,
      bindingId: binding.binding_id,
      conversationId: binding.conversation_id,
      providerRealm: WHATSAPP.realm,
      resourceKind: "account",
      resourceId: null,
      resourceRevision: null,
      resourceDigest: "link-second",
      expectedAccount: null,
      identityEpoch: 1,
    });
    const second = new TestBrowser(harness.app);
    await second.open(url);
    const otherProof = await second.prove(bolaAccount);
    expect(otherProof.status).toBe(200);
    await harness.say(WHATSAPP, `PAIR ${first.proof.body.pairingCode}`);
    await harness.say(WHATSAPP, `PAIR ${otherProof.body.pairingCode}`);
    expect(one("SELECT account_address FROM account_bindings WHERE status = 'active'")).toEqual({
      account_address: adaAccount.address.toLowerCase(),
    });
    expect(one("SELECT count(*) AS n FROM account_bindings")).toEqual({ n: 1 });
  });

  it("rejects a destination draft collision before suspending the old chat", async () => {
    await linkChannel(WHATSAPP);
    const replacement = { ...WHATSAPP, subjectId: "+2340000000077", chatId: "wa-ada-new" };
    const browser = await startRecovery(replacement);
    await harness.say(replacement, "Today I planted twelve baobab seedlings by the fence");
    expect((await browser.prove(adaAccount)).status).toBe(409);
    expect(one("SELECT count(*) AS n FROM channel_bindings WHERE status = 'suspended'")).toEqual({
      n: 0,
    });
    expect((await harness.say(WHATSAPP, "status"))[0]).toContain("TAS");
  });

  it("requires the new channel's exact pairing code and retains separate drafts and reply targets", async () => {
    await linkChannel(WHATSAPP);
    const owner = one<{ participant_id: string }>(
      "SELECT participant_id FROM account_bindings"
    ).participant_id;
    harness.core.db
      .query("UPDATE participants SET locale = 'en' WHERE id = $id")
      .run({ id: owner });
    const { proof } = await proveNewChannel(TELEGRAM);
    const incoming = one<{ participant_id: string }>(
      `SELECT b.participant_id FROM channel_bindings b
      JOIN channel_subjects s ON s.id = b.channel_subject_id WHERE s.provider_realm = $realm`,
      { realm: TELEGRAM.realm }
    ).participant_id;
    harness.core.db
      .query("UPDATE participants SET locale = 'pt' WHERE id = $id")
      .run({ id: incoming });
    await harness.say(TELEGRAM, "PAIR 000000");
    expect(
      one<{ n: number }>(
        "SELECT count(DISTINCT participant_id) AS n FROM channel_bindings WHERE status IN ('provisional','active')"
      ).n
    ).toBe(2);
    await harness.say(TELEGRAM, `PAIR ${proof.body.pairingCode}`);
    expect(
      one(
        "SELECT count(*) AS n FROM channel_bindings WHERE status = 'active' AND participant_id = $owner",
        { owner }
      )
    ).toEqual({ n: 2 });
    expect(
      one(
        "SELECT count(*) AS n FROM work_drafts WHERE participant_id = $owner AND lifecycle = 'open'",
        { owner }
      )
    ).toEqual({ n: 2 });
    expect(one("SELECT locale FROM participants WHERE id = $owner", { owner })).toEqual({
      locale: "en",
    });
    expect(
      one("SELECT count(*) AS n FROM source_entries WHERE participant_id = $incoming", { incoming })
    ).toEqual({ n: 0 });
    expect(
      one(
        "SELECT participant_id, identity_epoch FROM delivery_outbox ORDER BY dispatch_seq DESC LIMIT 1"
      )
    ).toEqual({ participant_id: owner, identity_epoch: 1 });
    for (const person of [WHATSAPP, TELEGRAM]) {
      expect((await harness.say(person, "status"))[0]).toContain("TAS");
      expect(harness.transport.sent.at(-1)).toMatchObject({
        providerRealm: person.realm,
        externalChatId: person.chatId,
      });
    }
  });

  it("refuses same-provider takeover even through another bot realm", async () => {
    await linkChannel(TELEGRAM);
    const other: Person = {
      ...TELEGRAM,
      realm: "telegram-fixture:other-bot",
      chatId: "other-tg",
      subjectId: "1002",
    };
    const { proof } = await proveNewChannel(other);
    expect((await harness.say(other, `PAIR ${proof.body.pairingCode}`))[0]).toContain("RECOVER");
    expect(one("SELECT count(*) AS n FROM channel_bindings WHERE status = 'active'")).toEqual({
      n: 1,
    });
    expect(one("SELECT count(*) AS n FROM account_bindings WHERE status = 'active'")).toEqual({
      n: 1,
    });
  });

  it("recovers WhatsApp without moving or suspending the Telegram conversation", async () => {
    await linkChannel(WHATSAPP);
    await linkChannel(TELEGRAM);
    const newWhatsApp = { ...WHATSAPP, subjectId: "+2340000000077", chatId: "wa-ada-new" };
    const browser = await startRecovery(newWhatsApp);
    const before = harness.transport.sent.length;
    await browser.prove(adaAccount);
    await harness.drain();
    const code = codeFrom(harness.transport.sent.slice(before).map((sent) => sent.message.text));
    expect((await harness.say(TELEGRAM, "status"))[0]).toContain("TAS");
    expect((await harness.say(WHATSAPP, "status"))[0]).toContain("paused");
    await browser.request("POST", `/messaging/recovery/${browser.challengeId}/channel`, {
      body: { code },
    });
    expect(
      (await browser.request("POST", `/messaging/recovery/${browser.challengeId}/confirm`)).status
    ).toBe(200);
    await harness.drain();
    expect(
      one(
        `SELECT b.status, b.identity_epoch FROM channel_bindings b JOIN channel_subjects s
      ON s.id = b.channel_subject_id WHERE s.provider_realm = $realm`,
        { realm: TELEGRAM.realm }
      )
    ).toEqual({ status: "active", identity_epoch: 2 });
    expect(
      one(
        `SELECT count(*) AS n FROM work_drafts d JOIN conversations c ON c.id = d.conversation_id
      WHERE d.lifecycle = 'open' AND c.provider_realm = $realm`,
        { realm: TELEGRAM.realm }
      )
    ).toEqual({ n: 1 });
    expect((await harness.say(TELEGRAM, "status"))[0]).toContain("TAS");
    expect((await harness.say(newWhatsApp, "status"))[0]).toContain("TAS");
    expect(await harness.say(WHATSAPP, "status")).toEqual([]);
  });

  it("does not attach a second channel while an owner recovery is pending", async () => {
    await linkChannel(WHATSAPP);
    const newWhatsApp = { ...WHATSAPP, subjectId: "+2340000000077", chatId: "wa-ada-new" };
    const recovery = await startRecovery(newWhatsApp);
    await recovery.prove(adaAccount);
    const { proof } = await proveNewChannel(TELEGRAM);
    expect((await harness.say(TELEGRAM, `PAIR ${proof.body.pairingCode}`))[0]).toContain("RECOVER");
    expect(one("SELECT count(*) AS n FROM account_bindings")).toEqual({ n: 1 });
    expect(one("SELECT count(*) AS n FROM channel_bindings WHERE status = 'active'")).toEqual({
      n: 0,
    });
  });

  it("allows a fresh second-channel proof after recovery advanced the identity epoch", async () => {
    await linkChannel(WHATSAPP);
    const newWhatsApp = { ...WHATSAPP, subjectId: "+2340000000077", chatId: "wa-ada-new" };
    await finishRecovery(await startRecovery(newWhatsApp));
    await linkChannel(TELEGRAM);
    expect(
      one(
        "SELECT count(*) AS n FROM channel_bindings WHERE status = 'active' AND identity_epoch = 2"
      )
    ).toEqual({ n: 2 });
    expect(one("SELECT count(*) AS n FROM account_bindings")).toEqual({ n: 1 });
  });
});
