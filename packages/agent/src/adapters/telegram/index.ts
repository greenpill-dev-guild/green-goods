/**
 * Telegram Adapter
 *
 * Thin Telegraf wrapper that transforms events and calls the orchestrator.
 */

import { Telegraf, session, type Context } from "telegraf";
import { message } from "telegraf/filters";
import fs from "fs";
import path from "path";
import https from "https";
import type { Orchestrator, VoiceProcessor, Notifier } from "../../core/orchestrator";
import type { AIPort } from "../../ports/ai";
import { telegramToInbound, outboundToTelegram } from "./transformer";

/**
 * Extended context with orchestrator
 */
interface BotContext extends Context {
  orchestrator?: Orchestrator;
}

/**
 * Downloads a file from URL to local filesystem.
 */
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

/**
 * Safely cleans up a temporary file.
 */
function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`Failed to cleanup file ${filePath}:`, error);
  }
}

/**
 * Create a voice processor for Telegram
 */
export function createTelegramVoiceProcessor(
  bot: Telegraf<BotContext>,
  ai: AIPort
): VoiceProcessor {
  return {
    async downloadAndTranscribe(fileId: string): Promise<string> {
      const tempPath = path.resolve(`temp_${fileId}.ogg`);
      const wavPath = tempPath.replace(".ogg", ".wav");

      try {
        // Get file link from Telegram
        const fileLink = await bot.telegram.getFileLink(fileId);

        // Download file
        await downloadFile(fileLink.href, tempPath);

        // Transcribe
        const text = await ai.transcribe(tempPath);
        return text;
      } finally {
        cleanupFile(tempPath);
        cleanupFile(wavPath);
      }
    },
  };
}

/**
 * Create a notifier for Telegram
 */
export function createTelegramNotifier(bot: Telegraf<BotContext>): Notifier {
  return {
    async notify(platform: string, platformId: string, message: string): Promise<void> {
      if (platform !== "telegram") {
        console.warn(`Cannot notify ${platform} user from Telegram adapter`);
        return;
      }

      await bot.telegram.sendMessage(Number(platformId), message, {
        parse_mode: "Markdown",
      });
    },
  };
}

/**
 * Create and configure the Telegram bot
 */
export function createTelegramBot(token: string, orchestrator: Orchestrator): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(token);

  // Session middleware
  bot.use(session());

  // Attach orchestrator to context
  bot.use((ctx, next) => {
    ctx.orchestrator = orchestrator;
    return next();
  });

  // Handle all updates through the orchestrator
  bot.on("callback_query", async (ctx) => {
    const inbound = telegramToInbound(ctx);
    if (!inbound) {
      await ctx.answerCbQuery("Error processing request");
      return;
    }

    const response = await orchestrator.handle(inbound);
    const { text, options } = outboundToTelegram(response);

    await ctx.answerCbQuery();

    // Remove buttons from original message
    try {
      await ctx.editMessageReplyMarkup(undefined);
    } catch {
      // Ignore if message can't be edited
    }

    if (text) {
      // Type assertion needed due to Telegraf's strict typing
      await ctx.reply(text, options as Parameters<typeof ctx.reply>[1]);
    }
  });

  // Handle voice messages
  bot.on(message("voice"), async (ctx) => {
    const inbound = telegramToInbound(ctx);
    if (!inbound) return;

    // For voice, we need to resolve the file URL before passing to orchestrator
    // The orchestrator's voiceProcessor will handle the actual download + transcribe
    const response = await orchestrator.handle(inbound);
    const { text, options } = outboundToTelegram(response);

    if (text) {
      await ctx.reply(text, options as Parameters<typeof ctx.reply>[1]);
    }
  });

  // Handle text messages
  bot.on(message("text"), async (ctx) => {
    const inbound = telegramToInbound(ctx);
    if (!inbound) return;

    const response = await orchestrator.handle(inbound);
    const { text, options } = outboundToTelegram(response);

    if (text) {
      await ctx.reply(text, options as Parameters<typeof ctx.reply>[1]);
    }
  });

  // Handle photo messages (for future media support)
  bot.on(message("photo"), async (ctx) => {
    await ctx.reply(
      "📷 Photo submissions are coming soon! For now, please describe your work in text or voice."
    );
  });

  // Error handling
  bot.catch((err, ctx) => {
    console.error("Bot error:", err);
    ctx.reply("❌ An error occurred. Please try again.").catch(() => {});
  });

  return bot;
}
