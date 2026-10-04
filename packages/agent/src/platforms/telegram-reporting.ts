/**
 * Telegram as a reporting chat channel, on the Agent's existing bot.
 *
 * While the `channel_telegram` control is on, private chats belong to the reporting core; with it
 * off, and always for groups, the bot's own handlers answer as before. This file is where the core
 * meets Telegram: updates become its inbound events, its replies become Bot API messages and its
 * media references become `getFile` downloads.
 *
 * File download URLs carry the bot token, so neither they nor raw client errors are logged here.
 */

import { type Context, type Middleware, type Telegram, TelegramError } from "telegraf";
import type { InlineKeyboardButton, Message, Update } from "telegraf/types";
import { loggers } from "../services/logger";
import { parseCommand } from "../services/reporting/coordinator/commands";
import { acceptChannelEvent } from "../services/reporting/inbox";
import type { ReportingCore } from "../services/reporting/runtime";
import type {
  InboundMediaFetcher,
  InboundMediaReference,
  InboundMessageEvent,
  OutboundRequest,
  OutboundResult,
  OutboundTransport,
} from "../services/reporting/transport";

const log = loggers.platform;

/** Telegram's limit on one message's text, in UTF-16 code units. */
const MAX_TEXT = 4096;
const SEND_TIMEOUT_MS = 15_000;
/** Bot API 7.11 copy_text; Telegraf 4.16 has not added it to its button union. */
type ReportingButton = InlineKeyboardButton | { text: string; copy_text: { text: string } };

/**
 * Telegraf types a request's signal with the abort-controller polyfill; its fetch accepts the
 * runtime's own AbortSignal, which is what this passes.
 */
type ApiSignal = NonNullable<Parameters<Telegram["callApi"]>[2]>["signal"];
const timeoutSignal = (ms: number) => AbortSignal.timeout(ms) as unknown as ApiSignal;

/**
 * A bot's realm is its numeric ID, the part of the token before the colon. The ID stays the same
 * when the token is revoked and reissued, so chat identities survive a token rotation.
 */
export function telegramRealm(token: string): string | null {
  const botId = /^(\d+):[\w-]+$/.exec(token)?.[1];
  return botId ? `telegram:${botId}` : null;
}

/**
 * Turns a private-chat update into the core's inbound event. Returns null for what reporting does
 * not take: groups and channels, edits, and messages with neither text nor a file.
 */
export function toReportingEvent(
  update: Update,
  realm: string,
  receivedAt: number
): InboundMessageEvent | null {
  if ("callback_query" in update) {
    const query = update.callback_query;
    if (query.message?.chat.type !== "private" || !("data" in query) || !query.data) return null;
    return {
      kind: "message",
      providerRealm: realm,
      eventId: `callback:${query.id}`,
      providerMessageId: `callback:${query.id}`,
      chat: { externalChatId: String(query.message.chat.id), kind: "direct" },
      sender: { externalSubjectId: String(query.from.id) },
      sentAt: receivedAt,
      // Only the reply ID: button labels such as "Confirm" must not read as typed commands.
      replyId: query.data,
      ...(query.from.language_code ? { locale: query.from.language_code } : {}),
    };
  }
  if (!("message" in update)) return null;
  const { message } = update;
  if (message.chat.type !== "private" || !message.from) return null;
  const text =
    "text" in message
      ? commandWords(message.text)
      : "caption" in message
        ? message.caption
        : undefined;
  const media = mediaOf(message);
  if (!text && !media) return null;
  return {
    kind: "message",
    providerRealm: realm,
    // A message ID is unique within its chat, so an update Telegram delivers twice is one event.
    eventId: `message:${message.chat.id}:${message.message_id}`,
    providerMessageId: String(message.message_id),
    chat: { externalChatId: String(message.chat.id), kind: "direct" },
    sender: { externalSubjectId: String(message.from.id) },
    sentAt: message.date * 1000,
    ...(text ? { text } : {}),
    ...(media ? { media: [media] } : {}),
    ...("reply_to_message" in message && message.reply_to_message
      ? { replyToProviderMessageId: String(message.reply_to_message.message_id) }
      : {}),
    ...(message.from.language_code ? { locale: message.from.language_code } : {}),
  };
}

/**
 * Telegram's slash commands become the core's plain command words: `/start` is START and
 * `/confirm 1234` is CONFIRM 1234. A command the core does not know, such as the bot's old
 * `/approve`, asks for help instead of becoming report text. A `/start` deep-link payload is
 * dropped, because the core's START takes no argument.
 */
function commandWords(text: string): string {
  const match = /^\/([a-z0-9_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!match) return text;
  const name = (match[1] ?? "").toLowerCase();
  const words = name === "start" ? name : [name, match[2]?.trim()].filter(Boolean).join(" ");
  return parseCommand(words) ? words : "help";
}

/** The file a message carries: the largest photo size, or its document, voice note, audio or video. */
function mediaOf(message: Message): InboundMediaReference | null {
  if ("photo" in message) {
    const largest = message.photo[message.photo.length - 1];
    if (!largest) return null;
    // Telegram re-encodes every photo it stores as JPEG.
    return {
      providerMediaId: largest.file_id,
      declaredMime: "image/jpeg",
      ...(largest.file_size ? { declaredSize: largest.file_size } : {}),
    };
  }
  const file =
    "document" in message
      ? message.document
      : "voice" in message
        ? message.voice
        : "audio" in message
          ? message.audio
          : "video" in message
            ? message.video
            : "video_note" in message
              ? message.video_note
              : null;
  if (!file) return null;
  return {
    providerMediaId: file.file_id,
    ...("mime_type" in file && file.mime_type ? { declaredMime: file.mime_type } : {}),
    ...("file_name" in file && file.file_name ? { declaredName: file.file_name } : {}),
    ...(file.file_size ? { declaredSize: file.file_size } : {}),
  };
}

/** Sends the core's replies through the Bot API; choices become buttons carrying the reply IDs. */
export function createTelegramTransport(telegram: Telegram): OutboundTransport {
  return {
    async send(request) {
      const { choices = [], link, text } = request.message;
      const linkButton = link && isPublicHttps(link.url) ? link : null;
      const body = link && !linkButton ? `${text}\n\n${link.label}: ${link.url}` : text;
      const keyboard: ReportingButton[][] = choices.map((choice) => [
        { text: choice.label, callback_data: choice.id },
      ]);
      if (linkButton) {
        keyboard.push([{ text: linkButton.label, url: linkButton.url }]);
        // Only a link the writer marked for copying gets the second button: one to a page where
        // an account signs. Telegram refuses copy text longer than 256 characters.
        if (linkButton.copyLabel && linkButton.url.length <= 256)
          keyboard.push([{ text: linkButton.copyLabel, copy_text: { text: linkButton.url } }]);
      }
      const parts = splitText(body);
      try {
        for (const part of parts.slice(0, -1)) await sendText(telegram, request, part, []);
        const sent = await sendText(telegram, request, parts[parts.length - 1] ?? "", keyboard);
        return { status: "accepted", providerMessageId: String(sent.message_id) };
      } catch (error) {
        return sendFailure(error);
      }
    },
  };
}

function sendText(
  telegram: Telegram,
  request: OutboundRequest,
  text: string,
  keyboard: ReportingButton[][]
): Promise<Message.TextMessage> {
  return telegram.callApi(
    "sendMessage",
    {
      chat_id: request.externalChatId,
      text,
      ...(request.threadId ? { message_thread_id: Number(request.threadId) } : {}),
      ...(keyboard.length > 0
        ? { reply_markup: { inline_keyboard: keyboard as InlineKeyboardButton[][] } }
        : {}),
    },
    { signal: timeoutSignal(SEND_TIMEOUT_MS) }
  );
}

/**
 * Rate limits and Telegram's own failures are retried; its other refusals (a blocked bot, an
 * unknown chat) are final. Without a response, Telegram may already have delivered the message.
 */
function sendFailure(error: unknown): OutboundResult {
  if (!(error instanceof TelegramError)) {
    const timedOut = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    return { status: "uncertain", errorCode: timedOut ? "telegram_timeout" : "telegram_network" };
  }
  const errorCode = `telegram_${error.code}`;
  if (error.code === 429) {
    const retryAfterSeconds = error.parameters?.retry_after ?? 1;
    return { status: "retryable", errorCode, retryAfterMs: retryAfterSeconds * 1000 };
  }
  return error.code >= 500 ? { status: "retryable", errorCode } : { status: "terminal", errorCode };
}

/**
 * Link buttons are for public addresses. A link to a local address (the Client dev server outside
 * production) goes in the text instead: it only opens on the machine that runs it, and Telegram may
 * refuse it on a button, which would fail the whole message.
 */
function isPublicHttps(url: string): boolean {
  const { protocol, hostname } = new URL(url);
  return (
    protocol === "https:" &&
    hostname.includes(".") &&
    !hostname.endsWith(".localhost") &&
    !/^[\d.]+$/.test(hostname)
  );
}

/** Splits text over Telegram's limit, preferring line breaks and never halving a surrogate pair. */
function splitText(text: string): string[] {
  const parts: string[] = [];
  let rest = text;
  while (rest.length > MAX_TEXT) {
    const newline = rest.lastIndexOf("\n", MAX_TEXT);
    let cut = newline > MAX_TEXT / 2 ? newline : MAX_TEXT;
    const before = rest.charCodeAt(cut - 1);
    if (before >= 0xd800 && before <= 0xdbff) cut -= 1;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, "");
  }
  parts.push(rest);
  return parts;
}

/** Downloads a Telegram file through the bot, within the core's size and time limits. */
export function createTelegramMediaFetcher(telegram: Telegram, realm: string): InboundMediaFetcher {
  return {
    async fetch(providerRealm, media, limits) {
      if (providerRealm !== realm) throw new Error("This bot does not serve that realm");
      const signal = AbortSignal.timeout(limits.timeoutMs);
      const file = await telegram.callApi(
        "getFile",
        { file_id: media.providerMediaId },
        { signal: signal as unknown as ApiSignal }
      );
      const url = await telegram.getFileLink(file);
      // Only Telegram's own file host: a local Bot API server's file path or a redirect is refused.
      if (url.origin !== new URL(telegram.options.apiRoot).origin) {
        throw new Error("Telegram returned a file outside its API host");
      }
      const response = await fetch(url, { signal, redirect: "manual" });
      if (response.status !== 200 || !response.body) {
        throw new Error(`Telegram file download failed with status ${response.status}`);
      }
      return { bytes: await readAtMost(response.body, limits.maxBytes + 1) };
    },
  };
}

/** Reads until `limit` bytes, so the caller sees an oversized file without downloading all of it. */
async function readAtMost(body: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    if (size >= limit) {
      await reader.cancel();
      break;
    }
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  const bytes = new Uint8Array(Math.min(size, limit));
  let offset = 0;
  for (const chunk of chunks) {
    const part = chunk.subarray(0, bytes.byteLength - offset);
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes;
}

/** Storing an update failed; the bot must surface it so Telegram delivers the update again. */
class TelegramIntakeError extends Error {
  override name = "TelegramIntakeError";
}

export interface TelegramReporting {
  /** Runs first for every update: reporting takes private chats while its channel is on. */
  middleware: Middleware<Context>;
  /** True for intake failures, which the bot must rethrow instead of answering as handled. */
  ownsError(error: unknown): boolean;
}

export function createTelegramReporting(
  core: ReportingCore,
  realm: string,
  now: () => number = Date.now
): TelegramReporting {
  return {
    async middleware(ctx, next) {
      const event = toReportingEvent(ctx.update, realm, now());
      if (!event) return next();
      let outcome: ReturnType<typeof acceptChannelEvent>;
      try {
        // Stored before the first await, so updates handled together keep their arrival order.
        outcome = acceptChannelEvent(core, event);
      } catch (error) {
        throw new TelegramIntakeError("Reporting could not store a Telegram update", {
          cause: error,
        });
      }
      if (outcome.status === "channel_closed") return next();
      if (ctx.callbackQuery) await settleButtonPress(ctx);
    },
    ownsError: (error) => error instanceof TelegramIntakeError,
  };
}

/** Stops the pressed button's spinner and removes its keyboard; the reply follows from the outbox. */
async function settleButtonPress(ctx: Context): Promise<void> {
  const results = await Promise.allSettled([
    ctx.answerCbQuery(),
    ctx.editMessageReplyMarkup(undefined),
  ]);
  for (const result of results) {
    if (result.status === "fulfilled") continue;
    // The press is already stored; an expired query or a deleted message costs only the tidy-up.
    const code = result.reason instanceof TelegramError ? result.reason.code : "network";
    log.warn({ code }, "Could not settle a Telegram button press");
  }
}
