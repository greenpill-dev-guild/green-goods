/**
 * Telegram Transformer
 *
 * Transforms Telegram-specific types to/from platform-agnostic core types.
 */

import type { Context } from "telegraf";
import type { InboundMessage, MessageContent, Platform } from "../../core/contracts/message";
import type { OutboundResponse } from "../../core/contracts/response";

/**
 * Transform a Telegraf context to an InboundMessage
 */
export function telegramToInbound(ctx: Context): InboundMessage | null {
  if (!ctx.from) return null;

  const platform: Platform = "telegram";
  const sender = {
    platformId: String(ctx.from.id),
    displayName: ctx.from.first_name,
  };
  const timestamp = Date.now();

  // Extract message ID
  let messageId = "unknown";

  // Handle callback queries
  if (ctx.callbackQuery && "data" in ctx.callbackQuery) {
    messageId = String(ctx.callbackQuery.message?.message_id || "callback");
    return {
      id: messageId,
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

  // Handle message types
  const message = ctx.message;
  if (!message) return null;

  messageId = String(message.message_id);

  const content = extractContent(ctx);
  if (!content) return null;

  return {
    id: messageId,
    platform,
    sender,
    content,
    locale: ctx.from.language_code,
    timestamp,
  };
}

/**
 * Extract message content from Telegraf context
 */
function extractContent(ctx: Context): MessageContent | null {
  const message = ctx.message;
  if (!message) return null;

  // Voice message
  if ("voice" in message && message.voice) {
    // We'll need to get the file link separately
    return {
      type: "voice",
      audioUrl: message.voice.file_id, // Store file_id, resolve URL later
      mimeType: message.voice.mime_type || "audio/ogg",
      duration: message.voice.duration,
    };
  }

  // Text message
  if ("text" in message && message.text) {
    const text = message.text;

    // Check if it's a command
    if (text.startsWith("/")) {
      const parts = text.split(" ");
      const commandWithBot = parts[0].substring(1); // Remove leading /
      const command = commandWithBot.split("@")[0]; // Remove @botname if present
      const args = parts.slice(1);

      return {
        type: "command",
        name: command,
        args,
      };
    }

    return {
      type: "text",
      text,
    };
  }

  // Photo message
  if ("photo" in message && message.photo) {
    const photo = message.photo[message.photo.length - 1]; // Get largest size
    return {
      type: "image",
      imageUrl: photo.file_id,
      mimeType: "image/jpeg",
      caption: "caption" in message ? message.caption : undefined,
    };
  }

  return null;
}

/**
 * Transform OutboundResponse to Telegram reply options
 */
export function outboundToTelegram(response: OutboundResponse): {
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

  // Parse mode
  if (response.parseMode === "markdown") {
    options.parse_mode = "Markdown";
  } else if (response.parseMode === "html") {
    options.parse_mode = "HTML";
  }

  // Inline buttons
  if (response.buttons && response.buttons.length > 0) {
    const buttons = response.buttons.map((btn) => {
      if (btn.url) {
        return { text: btn.label, url: btn.url };
      }
      return { text: btn.label, callback_data: btn.callbackData };
    });
    options.reply_markup = { inline_keyboard: [buttons] };
  }

  return {
    text: response.text,
    options,
  };
}
