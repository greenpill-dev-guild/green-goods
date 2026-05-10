/**
 * Group Capture Handler Tests
 */

import fs from "fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGroupCaptureHandler } from "../handlers/group-capture";
import { closeDB, getDB, getNewChatMessages, initDB } from "../services/db";
import type { InboundMessage, TopicAllowlistEntry } from "../types";

const TEST_DB_DIR = "data/test";
const TEST_DB_PATH = `${TEST_DB_DIR}/group-capture-${process.pid}-${Date.now()}.db`;

const SUPPORT_CHAT = "-1002847752257";
const BUG_THREAD = "311";
const IDEA_THREAD = "312";

const ALLOWLIST: TopicAllowlistEntry[] = [
  { chatId: SUPPORT_CHAT, threadId: BUG_THREAD, inferredType: "bug" },
  { chatId: SUPPORT_CHAT, threadId: IDEA_THREAD, inferredType: "idea" },
];

beforeAll(() => {
  if (!fs.existsSync(TEST_DB_DIR)) fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  initDB(TEST_DB_PATH);
});

afterAll(async () => {
  await closeDB();
  for (const file of [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});

function buildMessage(overrides: Partial<InboundMessage> = {}): InboundMessage {
  const now = Date.now();
  return {
    id: `${now}`,
    platform: "telegram",
    chat: { id: SUPPORT_CHAT, type: "supergroup", threadId: BUG_THREAD },
    sender: { platformId: "user-1", displayName: "Test Reporter" },
    content: { type: "text", text: "the map keeps freezing on my phone" },
    timestamp: now,
    ...overrides,
  };
}

describe("createGroupCaptureHandler", () => {
  it("returns silent response and persists messages from allowlisted topics", async () => {
    const handler = createGroupCaptureHandler(ALLOWLIST);
    const message = buildMessage();

    const response = await handler(message);
    expect(response.text).toBe("");

    const captured = await getNewChatMessages({ chatId: SUPPORT_CHAT, threadId: BUG_THREAD });
    const found = captured.find(
      (entry) => entry.messageId === message.id && entry.senderPlatformId === "user-1"
    );
    expect(found).toBeDefined();
    expect(found?.inferredType).toBe("bug");
    expect(found?.text).toBe("the map keeps freezing on my phone");
  });

  it("tags messages from the idea thread as inferred_type=idea", async () => {
    const handler = createGroupCaptureHandler(ALLOWLIST);
    const message = buildMessage({
      id: `idea-${Date.now()}`,
      chat: { id: SUPPORT_CHAT, type: "supergroup", threadId: IDEA_THREAD },
      content: { type: "text", text: "would love a photo gallery for garden work" },
    });

    await handler(message);

    const captured = await getNewChatMessages({
      chatId: SUPPORT_CHAT,
      threadId: IDEA_THREAD,
      inferredType: "idea",
    });
    expect(captured.find((entry) => entry.messageId === message.id)?.inferredType).toBe("idea");
  });

  it("drops messages from non-allowlisted topics", async () => {
    const handler = createGroupCaptureHandler(ALLOWLIST);
    const before = (await getNewChatMessages({ chatId: SUPPORT_CHAT })).length;
    const message = buildMessage({
      id: `off-topic-${Date.now()}`,
      chat: { id: SUPPORT_CHAT, type: "supergroup", threadId: "999" },
    });

    const response = await handler(message);
    expect(response.text).toBe("");

    const after = (await getNewChatMessages({ chatId: SUPPORT_CHAT })).length;
    expect(after).toBe(before);
  });

  it("drops messages from non-allowlisted chats even with a matching thread id", async () => {
    const handler = createGroupCaptureHandler(ALLOWLIST);
    const message = buildMessage({
      id: `wrong-chat-${Date.now()}`,
      chat: { id: "-100999999999", type: "supergroup", threadId: BUG_THREAD },
    });

    const response = await handler(message);
    expect(response.text).toBe("");

    const captured = await getNewChatMessages({ chatId: "-100999999999" });
    expect(captured).toHaveLength(0);
  });

  it("drops messages with no thread id (general chat thread)", async () => {
    const handler = createGroupCaptureHandler(ALLOWLIST);
    const message = buildMessage({
      id: `no-thread-${Date.now()}`,
      chat: { id: SUPPORT_CHAT, type: "supergroup" },
    });

    await handler(message);

    const captured = await getNewChatMessages({ chatId: SUPPORT_CHAT });
    expect(captured.find((entry) => entry.messageId === message.id)).toBeUndefined();
  });

  it("captures photo attachments with caption as the persisted text", async () => {
    const handler = createGroupCaptureHandler(ALLOWLIST);
    const message = buildMessage({
      id: `photo-${Date.now()}`,
      content: {
        type: "image",
        imageUrl: "tg-file-123",
        mimeType: "image/jpeg",
        fileSize: 4096,
        width: 1024,
        height: 768,
        caption: "screenshot of the broken map",
      },
    });

    await handler(message);

    const captured = await getNewChatMessages({ chatId: SUPPORT_CHAT, threadId: BUG_THREAD });
    const found = captured.find((entry) => entry.messageId === message.id);
    expect(found?.text).toBe("screenshot of the broken map");
    expect(found?.attachments).toHaveLength(1);
    expect(found?.attachments?.[0]?.kind).toBe("photo");
    expect(found?.attachments?.[0]?.telegramFileId).toBe("tg-file-123");
    expect(found?.attachments?.[0]?.fileSize).toBe(4096);
  });

  it("preserves reply metadata inside an allowlisted topic", async () => {
    const handler = createGroupCaptureHandler(ALLOWLIST);
    const message = buildMessage({
      id: `reply-${Date.now()}`,
      replyToMessageId: "12345",
      content: { type: "text", text: "same issue when replying in-thread" },
    });

    await handler(message);

    const captured = await getNewChatMessages({ chatId: SUPPORT_CHAT, threadId: BUG_THREAD });
    const found = captured.find((entry) => entry.messageId === message.id);
    expect(found?.replyToMessageId).toBe("12345");
    expect(found?.threadId).toBe(BUG_THREAD);
  });

  it("captures video attachments", async () => {
    const handler = createGroupCaptureHandler(ALLOWLIST);
    const message = buildMessage({
      id: `video-${Date.now()}`,
      content: {
        type: "video",
        videoUrl: "tg-video-456",
        mimeType: "video/mp4",
        fileSize: 1_500_000,
        duration: 8,
        width: 1280,
        height: 720,
      },
    });

    await handler(message);

    const captured = await getNewChatMessages({ chatId: SUPPORT_CHAT, threadId: BUG_THREAD });
    const found = captured.find((entry) => entry.messageId === message.id);
    expect(found?.attachments?.[0]?.kind).toBe("video");
    expect(found?.attachments?.[0]?.duration).toBe(8);
  });

  it("captures document attachments (e.g. screenshots saved as PNG)", async () => {
    const handler = createGroupCaptureHandler(ALLOWLIST);
    const message = buildMessage({
      id: `doc-${Date.now()}`,
      content: {
        type: "document",
        documentUrl: "tg-doc-789",
        mimeType: "image/png",
        fileSize: 8_192,
        filename: "screenshot.png",
      },
    });

    await handler(message);

    const captured = await getNewChatMessages({ chatId: SUPPORT_CHAT, threadId: BUG_THREAD });
    const found = captured.find((entry) => entry.messageId === message.id);
    expect(found?.attachments?.[0]?.kind).toBe("document");
    expect(found?.attachments?.[0]?.mimeType).toBe("image/png");
  });

  it("captures voice attachments", async () => {
    const handler = createGroupCaptureHandler(ALLOWLIST);
    const message = buildMessage({
      id: `voice-${Date.now()}`,
      content: {
        type: "voice",
        audioUrl: "tg-voice-123",
        mimeType: "audio/ogg",
        duration: 9,
        fileSize: 32_768,
      },
    });

    await handler(message);

    const captured = await getNewChatMessages({ chatId: SUPPORT_CHAT, threadId: BUG_THREAD });
    const found = captured.find((entry) => entry.messageId === message.id);
    expect(found?.attachments?.[0]?.kind).toBe("voice");
    expect(found?.attachments?.[0]?.telegramFileId).toBe("tg-voice-123");
    expect(found?.attachments?.[0]?.duration).toBe(9);
    expect(found?.attachments?.[0]?.fileSize).toBe(32_768);
  });

  it("drops empty messages with no text and no attachments", async () => {
    const handler = createGroupCaptureHandler(ALLOWLIST);
    const message = buildMessage({
      id: `empty-${Date.now()}`,
      content: { type: "text", text: "" },
    });

    await handler(message);
    const captured = await getNewChatMessages({ chatId: SUPPORT_CHAT, threadId: BUG_THREAD });
    expect(captured.find((entry) => entry.messageId === message.id)).toBeUndefined();
  });

  it("with empty allowlist, drops everything silently (group capture disabled)", async () => {
    const handler = createGroupCaptureHandler([]);
    const message = buildMessage({ id: `disabled-${Date.now()}` });

    const response = await handler(message);
    expect(response.text).toBe("");
  });
});
