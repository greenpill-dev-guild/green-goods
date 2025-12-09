/**
 * Telegram Platform Adapter
 *
 * Handles Telegram-specific message transformation and bot setup.
 * All Telegram logic lives in this one file.
 */

import fs from "fs";
import https from "https";
import path from "path";
import { type Context, session, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { loggers } from "../services/logger";
import type { InboundMessage, MessageContent, OutboundResponse, Platform } from "../types";

const log = loggers.platform;

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

/**
 * Transform Telegraf context to platform-agnostic InboundMessage
 */
export function toInboundMessage(ctx: Context): InboundMessage | null {
  if (!ctx.from) return null;

  const platform: Platform = "telegram";
  const sender = {
    platformId: String(ctx.from.id),
    displayName: ctx.from.first_name,
  };
  const timestamp = Date.now();

  // Handle callback queries (button presses)
  if (ctx.callbackQuery && "data" in ctx.callbackQuery) {
    return {
      id: String(ctx.callbackQuery.message?.message_id || "callback"),
      platform,
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

  return {
    id: String(msg.message_id),
    platform,
    sender,
    content,
    locale: ctx.from.language_code,
    timestamp,
  };
}

function extractContent(ctx: Context): MessageContent | null {
  const msg = ctx.message;
  if (!msg) return null;

  // Photo message - get highest resolution
  if ("photo" in msg && msg.photo && msg.photo.length > 0) {
    const largestPhoto = msg.photo[msg.photo.length - 1]; // Last item is highest res
    return {
      type: "image",
      imageUrl: largestPhoto.file_id, // Resolve to actual URL later via getFileLink
      mimeType: "image/jpeg", // Telegram converts all photos to JPEG
      caption: "caption" in msg ? (msg.caption as string) : undefined,
    };
  }

  // Voice message
  if ("voice" in msg && msg.voice) {
    return {
      type: "voice",
      audioUrl: msg.voice.file_id, // Resolve to URL later
      mimeType: msg.voice.mime_type || "audio/ogg",
      duration: msg.voice.duration,
    };
  }

  // Text message
  if ("text" in msg && msg.text) {
    const text = msg.text;

    // Check if command
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

  // Photo message
  if ("photo" in msg && msg.photo) {
    const photo = msg.photo[msg.photo.length - 1];
    return {
      type: "image",
      imageUrl: photo.file_id,
      mimeType: "image/jpeg",
      caption: "caption" in msg ? msg.caption : undefined,
    };
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

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            fs.unlinkSync(dest);
            return downloadFile(redirectUrl, dest).then(resolve).catch(reject);
          }
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
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

export function createVoiceProcessor(
  bot: Telegraf,
  transcribe: (audioPath: string) => Promise<string>
): VoiceProcessor {
  return {
    async downloadAndTranscribe(fileId: string): Promise<string> {
      const tempPath = path.resolve(`temp_${fileId}.ogg`);
      const wavPath = tempPath.replace(".ogg", ".wav");

      try {
        const fileLink = await bot.telegram.getFileLink(fileId);
        await downloadFile(fileLink.href, tempPath);
        return await transcribe(tempPath);
      } finally {
        cleanupFile(tempPath);
        cleanupFile(wavPath);
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

export function createPhotoProcessor(bot: Telegraf): PhotoProcessor {
  return {
    async downloadPhoto(fileId: string): Promise<Buffer> {
      try {
        // Get file link from Telegram
        const fileLink = await bot.telegram.getFileLink(fileId);
        const url = fileLink.toString();

        // Download file to buffer
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to download: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (error) {
        log.error({ err: error, fileId }, "Failed to download photo from Telegram");
        throw error;
      }
    },
  };
}

// ============================================================================
// BOT CREATION
// ============================================================================

export function createTelegramBot(config: TelegramConfig, handleMessage: MessageHandler): Telegraf {
  const bot = new Telegraf(config.token);

  bot.use(session());

  // Handle callback queries (button presses)
  bot.on("callback_query", async (ctx) => {
    const inbound = toInboundMessage(ctx);
    if (!inbound) {
      await ctx.answerCbQuery("Error processing request");
      return;
    }

    const response = await handleMessage(inbound);
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

  // Handle voice messages
  bot.on(message("voice"), async (ctx) => {
    const inbound = toInboundMessage(ctx);
    if (!inbound) return;

    const response = await handleMessage(inbound);
    const { text, options } = toTelegramReply(response);

    if (text) {
      await ctx.reply(text, options as Parameters<typeof ctx.reply>[1]);
    }
  });

  // Handle text messages
  bot.on(message("text"), async (ctx) => {
    const inbound = toInboundMessage(ctx);
    if (!inbound) return;

    const response = await handleMessage(inbound);
    const { text, options } = toTelegramReply(response);

    if (text) {
      await ctx.reply(text, options as Parameters<typeof ctx.reply>[1]);
    }
  });

  // Handle photo messages
  bot.on(message("photo"), async (ctx) => {
    const inbound = toInboundMessage(ctx);
    if (!inbound) return;

    const response = await handleMessage(inbound);
    const { text, options } = toTelegramReply(response);

    if (text) {
      await ctx.reply(text, options as Parameters<typeof ctx.reply>[1]);
    }
  });

  // Error handling
  bot.catch((err, ctx) => {
    log.error({ err, chatId: ctx.chat?.id }, "Bot error");
    ctx.reply("❌ An error occurred. Please try again.").catch(() => {});
  });

  return bot;
}
