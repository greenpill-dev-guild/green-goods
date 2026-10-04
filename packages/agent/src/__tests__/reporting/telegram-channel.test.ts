import { Telegram } from "telegraf";
import type { Update } from "telegraf/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTelegramMediaFetcher,
  createTelegramTransport,
  telegramRealm,
  toReportingEvent,
} from "../../platforms/telegram-reporting";
import type { OutboundRequest } from "../../services/reporting/transport";
import { FakeTelegramApi, TEST_BOT_REALM, TEST_BOT_TOKEN } from "./support/telegram-api";

/**
 * The Telegram channel adapter at its provider boundary: updates in, Bot API calls out. The
 * transport and media cases drive the real Telegraf client against a loopback Bot API, so this
 * file opts out of the unit lane's Telegraf stub.
 */
vi.unmock("telegraf");

const PERSON = { id: 7001, is_bot: false, first_name: "Ada", language_code: "pt" };
const DM = { id: 7001, type: "private", first_name: "Ada" };

function privateMessage(fields: Record<string, unknown>): Update {
  const message = { message_id: 11, date: 1_790_000_000, chat: DM, from: PERSON, ...fields };
  return { update_id: 911, message } as unknown as Update;
}

describe("Telegram updates", () => {
  it("turns private messages, files and button presses into reporting events", () => {
    expect(telegramRealm(TEST_BOT_TOKEN)).toBe(TEST_BOT_REALM);
    expect(
      toReportingEvent(privateMessage({ text: "I planted twelve seedlings" }), TEST_BOT_REALM, 5)
    ).toEqual({
      kind: "message",
      providerRealm: TEST_BOT_REALM,
      eventId: "message:7001:11",
      providerMessageId: "11",
      chat: { externalChatId: "7001", kind: "direct" },
      sender: { externalSubjectId: "7001" },
      sentAt: 1_790_000_000_000,
      text: "I planted twelve seedlings",
      locale: "pt",
    });

    const photo = privateMessage({
      caption: "The fence line",
      photo: [
        { file_id: "small", file_unique_id: "s", width: 90, height: 90 },
        { file_id: "large", file_unique_id: "l", width: 1280, height: 960, file_size: 204_800 },
      ],
    });
    expect(toReportingEvent(photo, TEST_BOT_REALM, 5)).toMatchObject({
      text: "The fence line",
      media: [{ providerMediaId: "large", declaredMime: "image/jpeg", declaredSize: 204_800 }],
    });
    const voice = privateMessage({
      voice: { file_id: "v1", file_unique_id: "v", duration: 4, mime_type: "audio/ogg" },
    });
    expect(toReportingEvent(voice, TEST_BOT_REALM, 5)?.media).toEqual([
      { providerMediaId: "v1", declaredMime: "audio/ogg" },
    ]);

    const press = {
      update_id: 950,
      callback_query: {
        id: "cb-1",
        from: PERSON,
        chat_instance: "chat-instance",
        data: "p:prompt-1:0",
        message: { message_id: 12, date: 0, chat: DM },
      },
    } as unknown as Update;
    expect(toReportingEvent(press, TEST_BOT_REALM, 5)).toEqual({
      kind: "message",
      providerRealm: TEST_BOT_REALM,
      eventId: "callback:cb-1",
      providerMessageId: "callback:cb-1",
      chat: { externalChatId: "7001", kind: "direct" },
      sender: { externalSubjectId: "7001" },
      sentAt: 5,
      replyId: "p:prompt-1:0",
      locale: "pt",
    });
  });

  it("leaves groups, stickers and edits to the bot's own handlers", () => {
    const group = {
      update_id: 1,
      message: {
        message_id: 1,
        date: 0,
        chat: { id: -1001, type: "supergroup", title: "Garden" },
        from: PERSON,
        text: "Seedlings are in",
      },
    } as unknown as Update;
    const edit = {
      update_id: 2,
      edited_message: { message_id: 11, date: 0, edit_date: 1, chat: DM, from: PERSON, text: "x" },
    } as unknown as Update;
    expect(toReportingEvent(group, TEST_BOT_REALM, 0)).toBeNull();
    expect(
      toReportingEvent(privateMessage({ sticker: { file_id: "st" } }), TEST_BOT_REALM, 0)
    ).toBeNull();
    expect(toReportingEvent(edit, TEST_BOT_REALM, 0)).toBeNull();
  });

  it.each([
    ["/start", "start"],
    ["/start@GreenGoodsBot pair_123456", "start"],
    ["/help", "help"],
    ["/confirm 1234", "confirm 1234"],
    ["/connect", "connect"],
    ["/lang es", "lang es"],
    ["/approve 3", "help"],
    ["/path/to/file", "/path/to/file"],
  ])("reads %s as %s", (text, words) => {
    expect(toReportingEvent(privateMessage({ text }), TEST_BOT_REALM, 0)?.text).toBe(words);
  });
});

describe("Telegram delivery", () => {
  let api: FakeTelegramApi;
  let telegram: Telegram;

  beforeEach(async () => {
    api = await new FakeTelegramApi().start();
    telegram = new Telegram(TEST_BOT_TOKEN, { apiRoot: api.url });
  });

  afterEach(async () => {
    await api.stop();
  });

  const request = (message: OutboundRequest["message"]): OutboundRequest => ({
    providerRealm: TEST_BOT_REALM,
    externalChatId: "7001",
    message,
    idempotencyKey: "outbox-1",
  });

  it("sends choices as buttons, a public link as a button and a local link in the text", async () => {
    const transport = createTelegramTransport(telegram);
    const choices = [
      { id: "p:q1:0", label: "TAS" },
      { id: "p:q1:more", label: "More options" },
    ];
    expect(await transport.send(request({ text: "Which garden?", choices }))).toEqual({
      status: "accepted",
      providerMessageId: "100",
    });
    const verify = "Verify your account.";
    const production = "https://www.greengoods.app/agent/reporting/r1";
    const local = "https://localhost:3001/agent/reporting/r2";
    await transport.send(request({ text: verify, link: { url: production, label: "Verify" } }));
    await transport.send(request({ text: verify, link: { url: local, label: "Verify" } }));

    expect(api.messages()).toEqual([
      {
        chat_id: "7001",
        text: "Which garden?",
        reply_markup: {
          inline_keyboard: [
            [{ text: "TAS", callback_data: "p:q1:0" }],
            [{ text: "More options", callback_data: "p:q1:more" }],
          ],
        },
      },
      {
        chat_id: "7001",
        text: verify,
        reply_markup: { inline_keyboard: [[{ text: "Verify", url: production }]] },
      },
      { chat_id: "7001", text: `${verify}\n\nVerify: ${local}` },
    ]);
  });

  it("splits text over Telegram's limit at a line break and keeps the buttons on the last part", async () => {
    const choices = [{ id: "p:q2:confirm", label: "Confirm" }];
    const text = `${"a".repeat(3000)}\n${"b".repeat(3000)}`;
    expect(await createTelegramTransport(telegram).send(request({ text, choices }))).toEqual({
      status: "accepted",
      providerMessageId: "101",
    });
    expect(api.messages()).toEqual([
      { chat_id: "7001", text: "a".repeat(3000) },
      {
        chat_id: "7001",
        text: "b".repeat(3000),
        reply_markup: { inline_keyboard: [[{ text: "Confirm", callback_data: "p:q2:confirm" }]] },
      },
    ]);
  });

  it("retries rate limits and Telegram failures, stops on refusals and flags a lost response", async () => {
    api.reply({
      ok: false,
      error_code: 429,
      description: "Too Many Requests: retry after 3",
      parameters: { retry_after: 3 },
    });
    api.reply({
      ok: false,
      error_code: 403,
      description: "Forbidden: bot was blocked by the user",
    });
    api.reply({ ok: false, error_code: 502, description: "Bad Gateway" });
    const transport = createTelegramTransport(telegram);
    const thanks = request({ text: "Thank you!" });

    expect(await transport.send(thanks)).toEqual({
      status: "retryable",
      errorCode: "telegram_429",
      retryAfterMs: 3000,
    });
    expect(await transport.send(thanks)).toEqual({ status: "terminal", errorCode: "telegram_403" });
    expect(await transport.send(thanks)).toEqual({
      status: "retryable",
      errorCode: "telegram_502",
    });
    await api.stop();
    expect(await transport.send(thanks)).toEqual({
      status: "uncertain",
      errorCode: "telegram_network",
    });
  });

  it("downloads a file within the limit and refuses oversized reads, redirects and other bots", async () => {
    const fetcher = createTelegramMediaFetcher(telegram, TEST_BOT_REALM);
    const limits = { maxBytes: 10, timeoutMs: 2_000 };
    api.files.set("files/photo-1", { body: new Uint8Array([1, 2, 3, 4]) });
    api.files.set("files/large", { body: new Uint8Array(64) });
    api.files.set("files/moved", {
      status: 302,
      headers: { location: "https://elsewhere.example/file" },
    });

    expect(await fetcher.fetch(TEST_BOT_REALM, { providerMediaId: "photo-1" }, limits)).toEqual({
      bytes: new Uint8Array([1, 2, 3, 4]),
    });
    // One byte past the limit is enough for the core to call the file too large.
    const large = await fetcher.fetch(TEST_BOT_REALM, { providerMediaId: "large" }, limits);
    expect(large.bytes.byteLength).toBe(11);
    await expect(
      fetcher.fetch(TEST_BOT_REALM, { providerMediaId: "moved" }, limits)
    ).rejects.toThrow("status 302");
    await expect(
      fetcher.fetch("telegram:9999", { providerMediaId: "photo-1" }, limits)
    ).rejects.toThrow("does not serve that realm");
    expect(api.calls.map((call) => call.method)).toEqual(["getFile", "getFile", "getFile"]);
  });
});
