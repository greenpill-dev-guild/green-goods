import sharp from "sharp";
import { Telegram, type Telegraf } from "telegraf";
import type { Update } from "telegraf/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTelegramBot } from "../../platforms/telegram";
import {
  createTelegramMediaFetcher,
  createTelegramReporting,
  createTelegramTransport,
} from "../../platforms/telegram-reporting";
import { channelControl } from "../../services/reporting/channels";
import { setControl } from "../../services/reporting/controls";
import { loadDraft } from "../../services/reporting/drafts";
import { processMedia } from "../../services/reporting/media/process";
import type { ReportingCore } from "../../services/reporting/runtime";
import { drain } from "../../services/reporting/worker";
import { textResponse } from "../../types";
import { TestBrowser } from "./support/browser";
import { TAS } from "./support/fixtures";
import { adaAccount } from "./support/flows";
import { Harness } from "./support/harness";
import { FakeTelegramApi, TEST_BOT_REALM, TEST_BOT_TOKEN } from "./support/telegram-api";

/**
 * Telegram on the Agent's own bot: real Telegraf update handling in front of the real reporting
 * core and SQLite, with the Bot API served by a loopback fake. The bot's own handlers are doubles.
 */
let harness: Harness;
let api: FakeTelegramApi;
let updateId = 0;
const legacy = {
  direct: vi.fn(async () => textResponse("Handled by the bot")),
  group: vi.fn(async () => textResponse("")),
};

const PERSON = { id: 7001, is_bot: false, first_name: "Ada", language_code: "en" };
const DM = { id: 7001, type: "private", first_name: "Ada" };
const BOT_INFO = { id: 4242, is_bot: true, first_name: "Green Goods", username: "GreenGoodsBot" };

beforeEach(async () => {
  harness = new Harness();
  api = await new FakeTelegramApi().start();
  updateId = 0;
  legacy.direct.mockClear();
  legacy.group.mockClear();
});

afterEach(async () => {
  harness.close();
  await api.stop();
});

function bot(core: ReportingCore = harness.core): Telegraf {
  const reporting = createTelegramReporting(core, TEST_BOT_REALM, () => harness.clock.now());
  const telegraf = createTelegramBot(
    { token: TEST_BOT_TOKEN, apiRoot: api.url },
    legacy.direct,
    legacy.group,
    reporting
  );
  telegraf.botInfo = BOT_INFO as Telegraf["botInfo"];
  return telegraf;
}

function direct(fields: Record<string, unknown>): Update {
  updateId += 1;
  const message = { message_id: updateId, date: 1_790_000_000, chat: DM, from: PERSON, ...fields };
  return { update_id: updateId, message } as unknown as Update;
}

function press(label: string): Update {
  const rows = [...api.messages()]
    .reverse()
    .map((message) => message.reply_markup as { inline_keyboard?: InlineRows } | undefined)
    .flatMap((markup) => markup?.inline_keyboard ?? []);
  const data = rows.flat().find((button) => button.text === label)?.callback_data;
  if (!data) throw new Error(`No button labelled ${label}`);
  updateId += 1;
  const message = { message_id: 1, date: 0, chat: DM };
  const query = { id: `press-${updateId}`, from: PERSON, chat_instance: "chat", data, message };
  return { update_id: updateId, callback_query: query } as unknown as Update;
}

type InlineRows = Array<Array<{ text: string; callback_data?: string; url?: string }>>;

const buttonsOf = (message: Record<string, unknown> | undefined) =>
  (
    (message?.reply_markup as { inline_keyboard?: InlineRows } | undefined)?.inline_keyboard ?? []
  ).flat();

/** Runs every queue, sending through Telegram and downloading files through the bot. */
async function drainThroughTelegram(): Promise<void> {
  const telegram = new Telegram(TEST_BOT_TOKEN, { apiRoot: api.url });
  const fetcher = createTelegramMediaFetcher(telegram, TEST_BOT_REALM);
  const deps = harness.deps({
    process_media: (job) =>
      processMedia(
        {
          core: harness.core,
          media: harness.media(),
          fetcher,
          tools: harness.documents,
          audio: harness.audio,
          catalog: harness.catalog,
          openai: harness.openai,
        },
        job
      ),
  });
  await drain({ ...deps, transport: createTelegramTransport(telegram) });
}

function openTelegramChannel(): void {
  setControl(harness.core, channelControl("telegram"), true, { actor: "operator", reason: "test" });
}

const sentTexts = () => api.messages().map((message) => String(message.text));

describe("Telegram reporting on the existing bot", () => {
  it("applies a channel pause and resume to the same running bot without capturing legacy replies", async () => {
    openTelegramChannel();
    const telegraf = bot();
    await telegraf.handleUpdate(direct({ text: "/start" }));
    await drainThroughTelegram();
    expect(legacy.direct).not.toHaveBeenCalled();

    setControl(harness.core, channelControl("telegram"), false, {
      actor: "operator",
      reason: "pause",
    });
    await telegraf.handleUpdate(direct({ text: "/status" }));
    expect(legacy.direct).toHaveBeenCalledTimes(1);
    expect(sentTexts().at(-1)).toBe("Handled by the bot");
    expect(harness.core.db.query("SELECT count(*) AS n FROM inbox_events").get()).toEqual({ n: 1 });

    openTelegramChannel();
    await telegraf.handleUpdate(direct({ text: "/status" }));
    expect(legacy.direct).toHaveBeenCalledTimes(1);
    expect(harness.core.db.query("SELECT count(*) AS n FROM inbox_events").get()).toEqual({ n: 2 });
  });
  it("takes private chats only while the channel is on and always leaves groups to the bot", async () => {
    const telegraf = bot();
    await telegraf.handleUpdate(direct({ text: "Hello" }));
    expect(legacy.direct).toHaveBeenCalledTimes(1);
    expect(sentTexts()).toEqual(["Handled by the bot"]);

    openTelegramChannel();
    const start = direct({ text: "/start" });
    await telegraf.handleUpdate(start);
    await telegraf.handleUpdate(start);
    await telegraf.handleUpdate({
      update_id: 99,
      message: {
        message_id: 99,
        date: 0,
        chat: { id: -1001, type: "supergroup", title: "Garden" },
        from: PERSON,
        text: "Seedlings are in",
      },
    } as unknown as Update);

    expect(legacy.direct).toHaveBeenCalledTimes(1);
    expect(legacy.group).toHaveBeenCalledTimes(1);
    // The redelivered /start is one event.
    expect(harness.core.db.query("SELECT count(*) AS n FROM inbox_events").get()).toEqual({ n: 1 });
    await drainThroughTelegram();
    const notice = api.messages().at(-1);
    expect(notice?.chat_id).toBe("7001");
    expect(JSON.stringify(notice?.reply_markup)).toContain("I agree");
  });

  it("runs a report through Telegram buttons and downloads its photo through the bot", async () => {
    openTelegramChannel();
    const telegraf = bot();
    await telegraf.handleUpdate(
      direct({ text: "Today I planted twelve baobab seedlings by the fence" })
    );
    await drainThroughTelegram();
    await telegraf.handleUpdate(press("I agree"));
    await drainThroughTelegram();
    await telegraf.handleUpdate(direct({ text: "1" }));
    await drainThroughTelegram();
    await telegraf.handleUpdate(press("Tree planting"));
    await drainThroughTelegram();

    const photo = await sharp({
      create: { width: 64, height: 48, channels: 3, background: "#2d6a4f" },
    })
      .jpeg()
      .toBuffer();
    api.files.set("files/photo-large", { body: new Uint8Array(photo) });
    const sizes = [
      { file_id: "photo-small", file_unique_id: "s", width: 32, height: 24 },
      { file_id: "photo-large", file_unique_id: "l", width: 64, height: 48 },
    ];
    await telegraf.handleUpdate(direct({ photo: sizes }));
    await drainThroughTelegram();

    expect(legacy.direct).not.toHaveBeenCalled();
    expect(api.calls.filter((call) => call.method === "answerCallbackQuery")).toHaveLength(2);
    expect(api.calls.filter((call) => call.method === "editMessageReplyMarkup")).toHaveLength(2);
    expect(api.calls.find((call) => call.method === "getFile")?.payload).toEqual({
      file_id: "photo-large",
    });
    expect(sentTexts()).toContain("Photo added to your report.");
    const { id } = harness.core.db.query("SELECT id FROM work_drafts").get() as { id: string };
    expect(loadDraft(harness.core, id)?.content.evidence).toHaveLength(1);
  });

  it("keeps changing the garden a tap away after taking an account's only garden", async () => {
    openTelegramChannel();
    harness.chain.grantRole(TAS.address, adaAccount.address, { gardener: true });
    const telegraf = bot();
    const tell = async (update: Update) => {
      await telegraf.handleUpdate(update);
      await drainThroughTelegram();
    };
    await tell(direct({ text: "/start" }));
    await tell(press("I agree"));
    await tell(direct({ text: "/connect" }));
    const link =
      api
        .messages()
        .flatMap(buttonsOf)
        .find((button) => button.url)?.url ?? "";
    const browser = new TestBrowser(harness.app);
    await browser.open(link);
    const proof = await browser.prove(adaAccount);
    await tell(direct({ text: String(proof.body.pairingCode) }));
    await tell(direct({ text: "Today I planted twelve baobab seedlings by the fence" }));

    // With buttons to tap, the announcement names no command words.
    const taken = api.messages().find((message) => String(message.text).startsWith("TAS is"));
    expect(taken?.text).toBe("TAS is your only garden, so I'll use it for this report.");
    expect(buttonsOf(taken).map((button) => button.text)).toEqual([
      "Change garden",
      "Join another garden",
    ]);
    expect(sentTexts().at(-1)).toContain("Which activity in TAS");
    // The activity question is the open one by now, and the button still changes the garden.
    await tell(press("Change garden"));
    expect(sentTexts().at(-1)).toBe(
      "Which of your gardens is this report for?\n1. TAS\n2. Join another garden"
    );
  });

  it("does not acknowledge an update it could not store", async () => {
    openTelegramChannel();
    const failing = {
      ...harness.core,
      db: {
        query: () => {
          throw new Error("disk I/O error");
        },
      },
    } as unknown as ReportingCore;

    await expect(bot(failing).handleUpdate(direct({ text: "Hello" }))).rejects.toThrow(
      "Reporting could not store a Telegram update"
    );
    expect(legacy.direct).not.toHaveBeenCalled();
    expect(api.messages()).toEqual([]);
  });
});
