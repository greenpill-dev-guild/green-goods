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
import { loggers } from "../services/logger";
import type { InboundMessage, MessageContent, OutboundResponse, Platform } from "../types";

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
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          cleanup();
          return downloadFile(redirectUrl, dest, maxSize).then(resolve).catch(reject);
        }
      }

      // Check Content-Length before downloading
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

    // Set download timeout
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
      // Create secure temp directory with unpredictable name
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
        // Get file link from Telegram
        const fileLink = await bot.telegram.getFileLink(fileId);
        const url = fileLink.toString();

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

        try {
          // Download file to buffer with timeout
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) {
            throw new Error(`Failed to download: ${response.statusText}`);
          }

          // Check Content-Length before downloading
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
    ctx.reply("❌ An error occurred. Please try again.").catch((replyErr) => {
      log.warn({ replyErr, chatId: ctx.chat?.id }, "Failed to send error message to user");
    });
  });

  return bot;
}
