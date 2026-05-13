/**
 * Telegram Platform Adapter
 *
 * Handles Telegram-specific message transformation and bot setup.
 * All Telegram logic lives in this one file.
 *
 * SECURITY:
 * - Uses mkdtemp for secure temp file creation (unpredictable names)
 * - Enforces download size limits to prevent DOS
 * - Uses timeouts on all network operations
 */

import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import { type Context, session, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { agentMessage, type AgentLocale, type AgentMessageKey } from "../i18n";
import { loggers } from "../services/logger";
import type {
  ChatType,
  InboundMessage,
  MessageContent,
  OutboundResponse,
  Platform,
} from "../types";

const log = loggers.platform;

// ============================================================================
// SECURITY CONSTANTS
// ============================================================================

/** Maximum file download size (20MB - Telegram's limit for bots) */
const MAX_DOWNLOAD_SIZE_BYTES = 20 * 1024 * 1024;

/** Download timeout in milliseconds */
const DOWNLOAD_TIMEOUT_MS = 30_000;

/** Maximum photo download size (10MB) */
const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

// ============================================================================
// TYPES
// ============================================================================

export interface TelegramConfig {
  token: string;
  webhookSecret?: string;
}

export type MessageHandler = (message: InboundMessage) => Promise<OutboundResponse>;

// ============================================================================
// MESSAGE TRANSFORMATION
// ============================================================================

function toChatContext(ctx: Context): { id: string; type: ChatType; threadId?: string } | null {
  const chat = ctx.chat;
  if (!chat) return null;
  const type = chat.type as ChatType;
  if (type !== "private" && type !== "group" && type !== "supergroup" && type !== "channel") {
    return null;
  }
  const msg = ctx.message;
  const threadId =
    msg && "message_thread_id" in msg && typeof msg.message_thread_id === "number"
      ? String(msg.message_thread_id)
      : undefined;
  return { id: String(chat.id), type, threadId };
}

/**
 * Transform Telegraf context to platform-agnostic InboundMessage
 */
export function toInboundMessage(ctx: Context): InboundMessage | null {
  if (!ctx.from) return null;

  const chat = toChatContext(ctx);
  if (!chat) return null;

  const platform: Platform = "telegram";
  const sender = {
    platformId: String(ctx.from.id),
    displayName: ctx.from.first_name,
  };
  const timestamp = Date.now();

  if (ctx.callbackQuery && "data" in ctx.callbackQuery) {
    return {
      id: String(ctx.callbackQuery.message?.message_id || "callback"),
      platform,
      chat,
      sender,
      content: {
        type: "callback",
        data: ctx.callbackQuery.data,
        messageId: String(ctx.callbackQuery.message?.message_id),
      },
      locale: ctx.from.language_code,
      timestamp,
    };
  }

  const msg = ctx.message;
  if (!msg) return null;

  const content = extractContent(ctx);
  if (!content) return null;
  const replyToMessageId =
    "reply_to_message" in msg && msg.reply_to_message
      ? String(msg.reply_to_message.message_id)
      : undefined;

  return {
    id: String(msg.message_id),
    platform,
    chat,
    replyToMessageId,
    sender,
    content,
    locale: ctx.from.language_code,
    timestamp,
  };
}

function extractContent(ctx: Context): MessageContent | null {
  const msg = ctx.message;
  if (!msg) return null;

  if ("photo" in msg && msg.photo && msg.photo.length > 0) {
    const largestPhoto = msg.photo[msg.photo.length - 1];
    return {
      type: "image",
      imageUrl: largestPhoto.file_id,
      mimeType: "image/jpeg", // Telegram converts all photos to JPEG
      fileSize: largestPhoto.file_size,
      width: largestPhoto.width,
      height: largestPhoto.height,
      caption: "caption" in msg ? (msg.caption as string) : undefined,
    };
  }

  if ("video" in msg && msg.video) {
    return {
      type: "video",
      videoUrl: msg.video.file_id,
      mimeType: msg.video.mime_type || "video/mp4",
      fileSize: msg.video.file_size,
      duration: msg.video.duration,
      width: msg.video.width,
      height: msg.video.height,
      caption: "caption" in msg ? (msg.caption as string) : undefined,
    };
  }

  if ("document" in msg && msg.document) {
    return {
      type: "document",
      documentUrl: msg.document.file_id,
      mimeType: msg.document.mime_type || "application/octet-stream",
      fileSize: msg.document.file_size,
      filename: msg.document.file_name,
      caption: "caption" in msg ? (msg.caption as string) : undefined,
    };
  }

  if ("voice" in msg && msg.voice) {
    return {
      type: "voice",
      audioUrl: msg.voice.file_id,
      mimeType: msg.voice.mime_type || "audio/ogg",
      duration: msg.voice.duration,
      fileSize: msg.voice.file_size,
    };
  }

  if ("text" in msg && msg.text) {
    const text = msg.text;

    if (text.startsWith("/")) {
      const parts = text.split(" ");
      const commandWithBot = parts[0].substring(1);
      const command = commandWithBot.split("@")[0];
      return {
        type: "command",
        name: command,
        args: parts.slice(1),
      };
    }

    return { type: "text", text };
  }

  return null;
}

/**
 * Transform OutboundResponse to Telegram reply format
 */
export function toTelegramReply(response: OutboundResponse): {
  text: string;
  options: {
    parse_mode?: "Markdown" | "HTML";
    reply_markup?: { inline_keyboard: { text: string; callback_data?: string; url?: string }[][] };
  };
} {
  const options: {
    parse_mode?: "Markdown" | "HTML";
    reply_markup?: { inline_keyboard: { text: string; callback_data?: string; url?: string }[][] };
  } = {};

  if (response.parseMode === "markdown") {
    options.parse_mode = "Markdown";
  } else if (response.parseMode === "html") {
    options.parse_mode = "HTML";
  }

  if (response.buttons?.length) {
    const buttons = response.buttons.map((btn) =>
      btn.url
        ? { text: btn.label, url: btn.url }
        : { text: btn.label, callback_data: btn.callbackData }
    );
    options.reply_markup = { inline_keyboard: [buttons] };
  }

  return { text: response.text, options };
}

// ============================================================================
// VOICE PROCESSING
// ============================================================================

/**
 * Securely download a file with size limits and timeout.
 *
 * SECURITY:
 * - Checks Content-Length before downloading to prevent DOS
 * - Enforces timeout to prevent hanging connections
 * - Tracks bytes received to catch servers that lie about Content-Length
 */
async function downloadFile(
  url: string,
  dest: string,
  maxSize: number = MAX_DOWNLOAD_SIZE_BYTES
): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    let bytesReceived = 0;
    let timeoutId: NodeJS.Timeout | null = null;

    const cleanup = (error?: Error) => {
      if (timeoutId) clearTimeout(timeoutId);
      file.close();
      fs.unlink(dest, () => {});
      if (error) reject(error);
    };

    const request = https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          cleanup();
          return downloadFile(redirectUrl, dest, maxSize).then(resolve).catch(reject);
        }
      }

      const contentLength = parseInt(response.headers["content-length"] || "0", 10);
      if (contentLength > maxSize) {
        cleanup(
          new Error(`File too large: ${contentLength} bytes exceeds limit of ${maxSize} bytes`)
        );
        return;
      }

      response.on("data", (chunk: Buffer) => {
        bytesReceived += chunk.length;
        // Double-check size in case Content-Length was missing or lied
        if (bytesReceived > maxSize) {
          cleanup(new Error(`Download exceeded size limit of ${maxSize} bytes`));
          request.destroy();
        }
      });

      response.pipe(file);

      file.on("finish", () => {
        if (timeoutId) clearTimeout(timeoutId);
        file.close();
        resolve();
      });

      file.on("error", (err) => {
        cleanup(err);
      });
    });

    request.on("error", (err) => {
      cleanup(err);
    });

    timeoutId = setTimeout(() => {
      request.destroy();
      cleanup(new Error(`Download timeout after ${DOWNLOAD_TIMEOUT_MS}ms`));
    }, DOWNLOAD_TIMEOUT_MS);
  });
}

function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error) {
    log.error({ err: error, filePath }, "Failed to cleanup temp file");
  }
}

export interface VoiceProcessor {
  downloadAndTranscribe: (fileId: string) => Promise<string>;
}

export interface PhotoProcessor {
  downloadPhoto: (fileId: string) => Promise<Buffer>;
}

/**
 * Creates a voice processor that securely handles audio files.
 *
 * SECURITY: Uses mkdtemp for unpredictable temp directory names,
 * preventing symlink attacks and file collisions.
 */
export function createVoiceProcessor(
  bot: Telegraf,
  transcribe: (audioPath: string) => Promise<string>
): VoiceProcessor {
  return {
    async downloadAndTranscribe(fileId: string): Promise<string> {
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "gg-agent-voice-"));
      const tempPath = path.join(tempDir, "audio.ogg");
      const wavPath = path.join(tempDir, "audio.wav");

      try {
        const fileLink = await bot.telegram.getFileLink(fileId);
        await downloadFile(fileLink.href, tempPath);
        return await transcribe(tempPath);
      } finally {
        // Clean up temp files and directory
        cleanupFile(tempPath);
        cleanupFile(wavPath);
        try {
          await fs.promises.rmdir(tempDir);
        } catch {
          // Directory may not be empty if other files were created
          log.warn({ tempDir }, "Could not remove temp directory");
        }
      }
    },
  };
}

// ============================================================================
// NOTIFIER
// ============================================================================

export interface Notifier {
  notify: (platform: string, platformId: string, message: string) => Promise<void>;
}

export function createNotifier(bot: Telegraf): Notifier {
  return {
    async notify(platform: string, platformId: string, message: string): Promise<void> {
      if (platform !== "telegram") {
        log.warn({ platform }, "Cannot notify non-Telegram user from Telegram adapter");
        return;
      }
      await bot.telegram.sendMessage(Number(platformId), message, { parse_mode: "Markdown" });
    },
  };
}

// ============================================================================
// PHOTO PROCESSING
// ============================================================================

/**
 * Creates a photo processor with security limits.
 *
 * SECURITY: Enforces size limits and timeouts on photo downloads.
 */
export function createPhotoProcessor(bot: Telegraf): PhotoProcessor {
  return {
    async downloadPhoto(fileId: string): Promise<Buffer> {
      try {
        const fileLink = await bot.telegram.getFileLink(fileId);
        const url = fileLink.toString();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

        try {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) {
            throw new Error(`Failed to download: ${response.statusText}`);
          }

          const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
          if (contentLength > MAX_PHOTO_SIZE_BYTES) {
            throw new Error(
              `Photo too large: ${contentLength} bytes exceeds limit of ${MAX_PHOTO_SIZE_BYTES} bytes`
            );
          }

          const arrayBuffer = await response.arrayBuffer();

          // Double-check size after download
          if (arrayBuffer.byteLength > MAX_PHOTO_SIZE_BYTES) {
            throw new Error(
              `Photo too large: ${arrayBuffer.byteLength} bytes exceeds limit of ${MAX_PHOTO_SIZE_BYTES} bytes`
            );
          }

          return Buffer.from(arrayBuffer);
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          log.error({ fileId }, `Photo download timeout after ${DOWNLOAD_TIMEOUT_MS}ms`);
          throw new Error("Photo download timed out");
        }
        log.error({ err: error, fileId }, "Failed to download photo from Telegram");
        throw error;
      }
    },
  };
}

// ============================================================================
// BOT CREATION
// ============================================================================

/**
 * Pick the right handler for an inbound message based on chat type and content.
 *
 * Returns `null` to ignore the message entirely (no handler dispatch, no reply).
 *
 * Routing rules:
 *   - channel: ignored.
 *   - private DM: text / voice / image / command / callback go through
 *     `handleMessage` (full session-aware dispatch). Video and document are
 *     ignored — they're not part of the work-submission flow and would
 *     otherwise hit the "Unsupported message type" fall-through.
 *   - group / supergroup: command + callback content is ignored. Other content
 *     (text, photo, video, document, voice) goes through `handleGroupCapture`
 *     for silent persistence — bot does NOT reply.
 */
export function chooseHandler(
  inbound: InboundMessage,
  handleMessage: MessageHandler,
  handleGroupCapture: MessageHandler
): MessageHandler | null {
  if (inbound.chat.type === "channel") return null;

  const isGroup = inbound.chat.type === "group" || inbound.chat.type === "supergroup";

  if (!isGroup) {
    // Private DM. Video and document aren't part of any DM flow today —
    // ignore rather than fall through to "Unsupported message type".
    if (inbound.content.type === "video" || inbound.content.type === "document") {
      return null;
    }
    return handleMessage;
  }

  if (inbound.content.type === "command" || inbound.content.type === "callback") {
    // Operator commands/callbacks can expose work IDs, addresses, tx hashes, or
    // wallet state. In groups, the topic-capture bot is intentionally silent.
    return null;
  }
  return handleGroupCapture;
}

export function createTelegramBot(
  config: TelegramConfig,
  handleMessage: MessageHandler,
  handleGroupCapture: MessageHandler
): Telegraf {
  const bot = new Telegraf(config.token);

  bot.use(session());

  bot.on("callback_query", async (ctx) => {
    const inbound = toInboundMessage(ctx);
    if (!inbound) {
      await ctx.answerCbQuery(agentMessage(ctx.from?.language_code, "error.internal"));
      return;
    }

    const handler = chooseHandler(inbound, handleMessage, handleGroupCapture);
    if (!handler) {
      await ctx.answerCbQuery();
      return;
    }

    const response = await handler(inbound);
    const { text, options } = toTelegramReply(response);

    await ctx.answerCbQuery();
    try {
      await ctx.editMessageReplyMarkup(undefined);
    } catch {
      // Ignore if can't edit
    }

    if (text) {
      await ctx.reply(text, options as Parameters<typeof ctx.reply>[1]);
    }
  });

  const dispatchMessage = async (ctx: Context): Promise<void> => {
    const inbound = toInboundMessage(ctx);
    if (!inbound) return;

    const handler = chooseHandler(inbound, handleMessage, handleGroupCapture);
    if (!handler) return;

    const response = await handler(inbound);
    if (!response.text) return; // silent capture path

    const { text, options } = toTelegramReply(response);
    await ctx.reply(text, options as Parameters<typeof ctx.reply>[1]);
  };

  bot.on(message("voice"), dispatchMessage);
  bot.on(message("text"), dispatchMessage);
  bot.on(message("photo"), dispatchMessage);
  bot.on(message("video"), dispatchMessage);
  bot.on(message("document"), dispatchMessage);

  // Error handling — only reply with an error in private chats. In groups we
  // stay silent on capture failures so we never spam the support topic.
  bot.catch((err, ctx) => {
    log.error({ err, chatId: ctx.chat?.id, chatType: ctx.chat?.type }, "Bot error");
    if (ctx.chat?.type !== "private") return;
    ctx.reply(`❌ ${agentMessage(ctx.from?.language_code, "error.internal")}`).catch((replyErr) => {
      log.warn({ replyErr, chatId: ctx.chat?.id }, "Failed to send error message to user");
    });
  });

  return bot;
}

/**
 * Register slash commands for **private DMs only**. The autocomplete menu in
 * groups stays empty so reporters discover the topic-based capture path
 * instead of looking for `/bug` and `/idea` commands that no longer exist.
 */
const PRIVATE_DM_COMMANDS: Array<{ command: string; descriptionKey: AgentMessageKey }> = [
  { command: "start", descriptionKey: "command.start" },
  { command: "join", descriptionKey: "command.join" },
  { command: "status", descriptionKey: "command.status" },
  { command: "pending", descriptionKey: "command.pending" },
  { command: "approve", descriptionKey: "command.approve" },
  { command: "reject", descriptionKey: "command.reject" },
  { command: "help", descriptionKey: "command.help" },
];

function privateDmCommands(locale: AgentLocale): Array<{ command: string; description: string }> {
  return PRIVATE_DM_COMMANDS.map(({ command, descriptionKey }) => ({
    command,
    description: agentMessage(locale, descriptionKey),
  }));
}

export async function registerSlashCommands(bot: Telegraf): Promise<void> {
  const privateScope = { type: "all_private_chats" } as const;
  await bot.telegram.setMyCommands(privateDmCommands("en"), { scope: privateScope });
  await bot.telegram.setMyCommands(privateDmCommands("es"), {
    scope: privateScope,
    language_code: "es",
  });
  await bot.telegram.setMyCommands(privateDmCommands("pt"), {
    scope: privateScope,
    language_code: "pt",
  });
  // Explicitly clear the group autocomplete menu so retired /bug + /idea
  // commands and any historical state are removed.
  await bot.telegram.setMyCommands([], { scope: { type: "all_group_chats" } });
}
