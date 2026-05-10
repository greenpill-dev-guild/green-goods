/**
 * Group Capture Handler
 *
 * Silently persists messages posted in allowlisted Telegram supergroup forum
 * topics so the `bug-intake` cloud routine can pull them via `/api/messages`.
 *
 * The bot does NOT reply, react, or DM the reporter. Acknowledgement happens
 * downstream via Discord per-capture posts (and the routine's daily summary).
 *
 * Routing rules:
 *   - Drop messages from chats / topics not present in the allowlist.
 *   - Drop messages whose content type isn't capturable (commands, callbacks).
 *   - Persist text + optional media attachments atomically.
 *
 * Returns an empty `OutboundResponse` so the platform adapter skips `ctx.reply`.
 */

import * as db from "../services/db";
import { loggers } from "../services/logger";
import {
  type AttachmentKind,
  type DocumentContent,
  type ImageContent,
  type InboundMessage,
  type NewChatMessageAttachmentInput,
  type OutboundResponse,
  type TopicAllowlistEntry,
  type VideoContent,
  type VoiceContent,
  isDocumentContent,
  isImageContent,
  isTextContent,
  isVideoContent,
  isVoiceContent,
  textResponse,
} from "../types";

const log = loggers.handlers;

const SILENT_RESPONSE: OutboundResponse = textResponse("");

export type GroupCaptureHandler = (message: InboundMessage) => Promise<OutboundResponse>;

interface AllowlistKey {
  chatId: string;
  threadId: string | undefined;
}

function buildAllowlistMap(entries: TopicAllowlistEntry[]): Map<string, TopicAllowlistEntry> {
  const map = new Map<string, TopicAllowlistEntry>();
  for (const entry of entries) {
    map.set(`${entry.chatId}:${entry.threadId}`, entry);
  }
  return map;
}

function findAllowlistEntry(
  map: Map<string, TopicAllowlistEntry>,
  key: AllowlistKey
): TopicAllowlistEntry | undefined {
  if (!key.threadId) return undefined;
  return map.get(`${key.chatId}:${key.threadId}`);
}

function buildAttachments(content: InboundMessage["content"]): {
  text: string;
  attachments: NewChatMessageAttachmentInput[];
} {
  if (isImageContent(content)) {
    const image = content as ImageContent;
    return {
      text: image.caption ?? "",
      attachments: [
        {
          ordinal: 0,
          kind: "photo" satisfies AttachmentKind,
          telegramFileId: image.imageUrl,
          mimeType: image.mimeType,
          fileSize: image.fileSize,
          width: image.width,
          height: image.height,
        },
      ],
    };
  }
  if (isVideoContent(content)) {
    const video = content as VideoContent;
    return {
      text: video.caption ?? "",
      attachments: [
        {
          ordinal: 0,
          kind: "video" satisfies AttachmentKind,
          telegramFileId: video.videoUrl,
          mimeType: video.mimeType,
          fileSize: video.fileSize,
          duration: video.duration,
          width: video.width,
          height: video.height,
        },
      ],
    };
  }
  if (isDocumentContent(content)) {
    const document = content as DocumentContent;
    return {
      text: document.caption ?? "",
      attachments: [
        {
          ordinal: 0,
          kind: "document" satisfies AttachmentKind,
          telegramFileId: document.documentUrl,
          mimeType: document.mimeType,
          fileSize: document.fileSize,
        },
      ],
    };
  }
  if (isTextContent(content)) {
    return { text: content.text, attachments: [] };
  }
  if (isVoiceContent(content)) {
    const voice = content as VoiceContent;
    return {
      text: "",
      attachments: [
        {
          ordinal: 0,
          kind: "voice" satisfies AttachmentKind,
          telegramFileId: voice.audioUrl,
          mimeType: voice.mimeType,
          fileSize: voice.fileSize,
          duration: voice.duration,
        },
      ],
    };
  }
  return { text: "", attachments: [] };
}

export function createGroupCaptureHandler(
  topicAllowlist: TopicAllowlistEntry[]
): GroupCaptureHandler {
  const map = buildAllowlistMap(topicAllowlist);

  if (map.size === 0) {
    log.warn(
      "Group capture is disabled — TELEGRAM_BUGS_TOPIC and TELEGRAM_IDEAS_TOPIC are both unset. Bot will stay silent in groups."
    );
  }

  return async (message: InboundMessage): Promise<OutboundResponse> => {
    const entry = findAllowlistEntry(map, {
      chatId: message.chat.id,
      threadId: message.chat.threadId,
    });
    if (!entry) {
      // Out-of-scope chat or topic — silently drop.
      return SILENT_RESPONSE;
    }

    const { text, attachments } = buildAttachments(message.content);

    // Drop messages with no text and no media — pure reactions, etc.
    if (!text && attachments.length === 0) {
      return SILENT_RESPONSE;
    }

    const id = `${message.platform}:${message.chat.id}:${message.id}`;

    try {
      await db.addChatMessage(
        {
          id,
          platform: message.platform,
          chatId: message.chat.id,
          threadId: message.chat.threadId,
          messageId: message.id,
          senderPlatformId: message.sender.platformId,
          senderDisplayName: message.sender.displayName,
          text,
          replyToMessageId: message.replyToMessageId,
          inferredType: entry.inferredType,
          postedAt: message.timestamp,
        },
        attachments
      );
      log.info(
        {
          id,
          chatId: message.chat.id,
          threadId: message.chat.threadId,
          inferredType: entry.inferredType,
          attachmentCount: attachments.length,
        },
        "Captured group message"
      );
    } catch (error) {
      log.error(
        { err: error, id, chatId: message.chat.id, threadId: message.chat.threadId },
        "Failed to persist captured group message"
      );
      // Stay silent in groups even on persist failure — the team will notice
      // a gap in the routine output rather than the bot announcing an error.
    }

    return SILENT_RESPONSE;
  };
}
