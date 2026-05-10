/**
 * /api/messages endpoint tests
 *
 * Covers Bearer auth, filter validation, status transitions, and the
 * attachments proxy. The proxy test uses a stubbed Telegraf so we don't
 * make real network calls.
 */

import fs from "fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Telegraf } from "telegraf";
import { createServer } from "../api/server";
import { addChatMessage, closeDB, initDB, updateChatMessageStatus } from "../services/db";

const TEST_DB_DIR = "data/test";
const TEST_DB_PATH = `${TEST_DB_DIR}/api-messages-${process.pid}-${Date.now()}.db`;
const BEARER = "test-bearer-token";

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

function authHeaders(): Record<string, string> {
  return { authorization: `Bearer ${BEARER}` };
}

describe("GET /api/messages", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requires Bearer auth", async () => {
    const app = createServer(
      { isAIReady: () => true, botApiToken: BEARER, chatMessageSweepIntervalMs: 0 },
      { logger: false }
    );

    const response = await app.request("/api/messages?chat_id=-100");
    expect(response.status).toBe(401);
  });

  it("returns all captures when chat_id is omitted (agent-side allowlist scopes capture already)", async () => {
    const app = createServer(
      { isAIReady: () => true, botApiToken: BEARER, chatMessageSweepIntervalMs: 0 },
      { logger: false }
    );

    const response = await app.request("/api/messages", { headers: authHeaders() });
    expect(response.status).toBe(200);
  });

  it("rejects invalid status values", async () => {
    const app = createServer(
      { isAIReady: () => true, botApiToken: BEARER, chatMessageSweepIntervalMs: 0 },
      { logger: false }
    );

    const response = await app.request("/api/messages?chat_id=-100&status=responded", {
      headers: authHeaders(),
    });
    expect(response.status).toBe(400);
  });

  it("supports status=all for read-only clustering across processed captures", async () => {
    const seed = Date.now();
    const newId = `api-all-new-${seed}`;
    const triagedId = `api-all-triaged-${seed}`;
    await addChatMessage({
      id: newId,
      platform: "telegram",
      chatId: "-1002847752257",
      threadId: "311",
      messageId: `${seed}-new`,
      senderPlatformId: "user-all-1",
      text: "new cluster signal",
      inferredType: "bug",
      postedAt: seed,
    });
    await addChatMessage({
      id: triagedId,
      platform: "telegram",
      chatId: "-1002847752257",
      threadId: "311",
      messageId: `${seed}-triaged`,
      senderPlatformId: "user-all-2",
      text: "triaged cluster signal",
      inferredType: "bug",
      postedAt: seed + 1,
    });
    await updateChatMessageStatus(triagedId, "triaged");

    const app = createServer(
      { isAIReady: () => true, botApiToken: BEARER, chatMessageSweepIntervalMs: 0 },
      { logger: false }
    );

    const response = await app.request("/api/messages?inferred_type=bug&status=all", {
      headers: authHeaders(),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { messages: Array<{ id: string }> };
    const ids = body.messages.map((message) => message.id);
    expect(ids).toContain(newId);
    expect(ids).toContain(triagedId);
  });

  it("rejects invalid inferred_type values", async () => {
    const app = createServer(
      { isAIReady: () => true, botApiToken: BEARER, chatMessageSweepIntervalMs: 0 },
      { logger: false }
    );

    const response = await app.request("/api/messages?chat_id=-100&inferred_type=feature_request", {
      headers: authHeaders(),
    });
    expect(response.status).toBe(400);
  });

  it("returns rows with embedded attachment metadata and a download URL", async () => {
    const seed = Date.now();
    await addChatMessage(
      {
        id: `api-msg-${seed}`,
        platform: "telegram",
        chatId: "-1002847752257",
        threadId: "311",
        messageId: `${seed}`,
        senderPlatformId: "user-99",
        senderDisplayName: "Reporter",
        text: "the upload button is broken",
        inferredType: "bug",
        postedAt: seed,
      },
      [
        {
          ordinal: 0,
          kind: "photo",
          telegramFileId: "tg-file-1",
          mimeType: "image/jpeg",
          fileSize: 9001,
        },
      ]
    );

    const app = createServer(
      { isAIReady: () => true, botApiToken: BEARER, chatMessageSweepIntervalMs: 0 },
      { logger: false }
    );

    const response = await app.request(
      "/api/messages?chat_id=-1002847752257&thread_id=311&inferred_type=bug",
      { headers: authHeaders() }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      messages: Array<{
        id: string;
        attachments: Array<{ ordinal: number; downloadUrl: string }>;
      }>;
      count: number;
    };
    const found = body.messages.find((m) => m.id === `api-msg-${seed}`);
    expect(found).toBeDefined();
    expect(found?.attachments?.[0]?.downloadUrl).toBe(
      `/api/messages/api-msg-${seed}/attachments/0`
    );
  });
});

describe("PATCH /api/messages/:id", () => {
  it("rejects unknown statuses", async () => {
    const app = createServer(
      { isAIReady: () => true, botApiToken: BEARER, chatMessageSweepIntervalMs: 0 },
      { logger: false }
    );

    const response = await app.request("/api/messages/some-id", {
      method: "PATCH",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ status: "responded" }),
    });
    expect(response.status).toBe(400);
  });

  it("returns 404 for unknown ids", async () => {
    const app = createServer(
      { isAIReady: () => true, botApiToken: BEARER, chatMessageSweepIntervalMs: 0 },
      { logger: false }
    );

    const response = await app.request("/api/messages/does-not-exist", {
      method: "PATCH",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ status: "triaged" }),
    });
    expect(response.status).toBe(404);
  });

  it("transitions a real row to triaged", async () => {
    const seed = Date.now();
    const id = `patch-msg-${seed}`;
    await addChatMessage({
      id,
      platform: "telegram",
      chatId: "-1002847752257",
      threadId: "311",
      messageId: `${seed}`,
      senderPlatformId: "user-100",
      text: "actionable bug",
      inferredType: "bug",
      postedAt: seed,
    });

    const app = createServer(
      { isAIReady: () => true, botApiToken: BEARER, chatMessageSweepIntervalMs: 0 },
      { logger: false }
    );

    const response = await app.request(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ status: "triaged" }),
    });
    expect(response.status).toBe(200);

    // Subsequent GET with status=new should not return it
    const after = await app.request(
      "/api/messages?chat_id=-1002847752257&thread_id=311&status=new",
      { headers: authHeaders() }
    );
    const body = (await after.json()) as { messages: Array<{ id: string }> };
    expect(body.messages.find((m) => m.id === id)).toBeUndefined();
  });

  it("atomically claims a row for processing before routine work", async () => {
    const seed = Date.now();
    const id = `claim-api-msg-${seed}`;
    await addChatMessage({
      id,
      platform: "telegram",
      chatId: "-1002847752257",
      threadId: "311",
      messageId: `${seed}`,
      senderPlatformId: "user-claim",
      text: "claim me once",
      inferredType: "bug",
      postedAt: seed,
    });

    const app = createServer(
      { isAIReady: () => true, botApiToken: BEARER, chatMessageSweepIntervalMs: 0 },
      { logger: false }
    );

    const first = await app.request(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ status: "processing" }),
    });
    expect(first.status).toBe(200);

    const second = await app.request(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ status: "processing" }),
    });
    expect(second.status).toBe(409);
  });
});

describe("GET /api/messages/:id/attachments/:ordinal", () => {
  it("returns 503 when telegramBot is not configured", async () => {
    const app = createServer(
      { isAIReady: () => true, botApiToken: BEARER, chatMessageSweepIntervalMs: 0 },
      { logger: false }
    );

    const response = await app.request("/api/messages/anything/attachments/0", {
      headers: authHeaders(),
    });
    expect(response.status).toBe(503);
  });

  it("returns 400 for non-numeric ordinals", async () => {
    const stubBot = { telegram: { getFileLink: vi.fn() } } as unknown as Telegraf;
    const app = createServer(
      {
        isAIReady: () => true,
        botApiToken: BEARER,
        telegramBot: stubBot,
        chatMessageSweepIntervalMs: 0,
      },
      { logger: false }
    );

    const response = await app.request("/api/messages/anything/attachments/abc", {
      headers: authHeaders(),
    });
    expect(response.status).toBe(400);
  });

  it("returns 404 for missing attachments", async () => {
    const stubBot = { telegram: { getFileLink: vi.fn() } } as unknown as Telegraf;
    const app = createServer(
      {
        isAIReady: () => true,
        botApiToken: BEARER,
        telegramBot: stubBot,
        chatMessageSweepIntervalMs: 0,
      },
      { logger: false }
    );

    const response = await app.request("/api/messages/missing/attachments/0", {
      headers: authHeaders(),
    });
    expect(response.status).toBe(404);
  });

  it("proxies bytes from Telegram with the stored mime type", async () => {
    const seed = Date.now();
    const id = `attach-msg-${seed}`;
    await addChatMessage(
      {
        id,
        platform: "telegram",
        chatId: "-1002847752257",
        threadId: "311",
        messageId: `${seed}`,
        senderPlatformId: "user-200",
        text: "look at this",
        inferredType: "bug",
        postedAt: seed,
      },
      [
        {
          ordinal: 0,
          kind: "photo",
          telegramFileId: "tg-file-proxy-1",
          mimeType: "image/jpeg",
        },
      ]
    );

    const upstreamBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(upstreamBytes, {
        status: 200,
        headers: { "content-type": "image/png", "content-length": String(upstreamBytes.length) },
      })
    );

    const stubBot = {
      telegram: {
        getFileLink: vi
          .fn()
          .mockResolvedValue(new URL("https://api.telegram.org/file/bot123/photos/test.jpg")),
      },
    } as unknown as Telegraf;

    const app = createServer(
      {
        isAIReady: () => true,
        botApiToken: BEARER,
        telegramBot: stubBot,
        chatMessageSweepIntervalMs: 0,
      },
      { logger: false }
    );

    const response = await app.request(`/api/messages/${id}/attachments/0`, {
      headers: authHeaders(),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("content-length")).toBe(String(upstreamBytes.length));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.telegram.org/file/bot123/photos/test.jpg",
      expect.objectContaining({ redirect: "manual" })
    );
    fetchSpy.mockRestore();
  });

  it("does not follow token-bearing upstream redirects", async () => {
    const seed = Date.now();
    const id = `redirect-attach-${seed}`;
    await addChatMessage(
      {
        id,
        platform: "telegram",
        chatId: "-1002847752257",
        threadId: "311",
        messageId: `${seed}`,
        senderPlatformId: "user-redirect",
        text: "redirect file",
        inferredType: "bug",
        postedAt: seed,
      },
      [{ ordinal: 0, kind: "photo", telegramFileId: "tg-redirect", mimeType: "image/jpeg" }]
    );

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://api.telegram.org/file/bot123/photos/redirected.jpg" },
      })
    );
    const stubBot = {
      telegram: {
        getFileLink: vi
          .fn()
          .mockResolvedValue(new URL("https://api.telegram.org/file/bot123/photos/test.jpg")),
      },
    } as unknown as Telegraf;
    const app = createServer(
      {
        isAIReady: () => true,
        botApiToken: BEARER,
        telegramBot: stubBot,
        chatMessageSweepIntervalMs: 0,
      },
      { logger: false }
    );

    const response = await app.request(`/api/messages/${id}/attachments/0`, {
      headers: authHeaders(),
    });
    expect(response.status).toBe(502);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.telegram.org/file/bot123/photos/test.jpg",
      expect.objectContaining({ redirect: "manual" })
    );
    fetchSpy.mockRestore();
  });

  it("rejects oversized upstream bodies even without content-length", async () => {
    const seed = Date.now();
    const id = `stream-huge-attach-${seed}`;
    await addChatMessage(
      {
        id,
        platform: "telegram",
        chatId: "-1002847752257",
        threadId: "311",
        messageId: `${seed}`,
        senderPlatformId: "user-202",
        text: "streaming large file",
        inferredType: "bug",
        postedAt: seed,
      },
      [{ ordinal: 0, kind: "video", telegramFileId: "tg-stream-huge", mimeType: "video/mp4" }]
    );

    const oversized = new Uint8Array(26 * 1024 * 1024);
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(oversized, {
        status: 200,
        headers: { "content-type": "video/mp4" },
      })
    );
    const stubBot = {
      telegram: {
        getFileLink: vi
          .fn()
          .mockResolvedValue(new URL("https://api.telegram.org/file/bot123/videos/big.mp4")),
      },
    } as unknown as Telegraf;
    const app = createServer(
      {
        isAIReady: () => true,
        botApiToken: BEARER,
        telegramBot: stubBot,
        chatMessageSweepIntervalMs: 0,
      },
      { logger: false }
    );

    const response = await app.request(`/api/messages/${id}/attachments/0`, {
      headers: authHeaders(),
    });
    expect(response.status).toBe(413);
    fetchSpy.mockRestore();
  });

  it("rejects upstream content-length above the proxy limit", async () => {
    const seed = Date.now();
    const id = `huge-attach-${seed}`;
    await addChatMessage(
      {
        id,
        platform: "telegram",
        chatId: "-1002847752257",
        threadId: "311",
        messageId: `${seed}`,
        senderPlatformId: "user-201",
        text: "large file",
        inferredType: "bug",
        postedAt: seed,
      },
      [
        {
          ordinal: 0,
          kind: "video",
          telegramFileId: "tg-huge",
          mimeType: "video/mp4",
        },
      ]
    );

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(new Uint8Array(4), {
        status: 200,
        headers: {
          "content-type": "video/mp4",
          "content-length": String(2 * 1024 * 1024 * 1024), // 2GB
        },
      })
    );

    const stubBot = {
      telegram: {
        getFileLink: vi
          .fn()
          .mockResolvedValue(new URL("https://api.telegram.org/file/bot123/videos/big.mp4")),
      },
    } as unknown as Telegraf;

    const app = createServer(
      {
        isAIReady: () => true,
        botApiToken: BEARER,
        telegramBot: stubBot,
        chatMessageSweepIntervalMs: 0,
      },
      { logger: false }
    );

    const response = await app.request(`/api/messages/${id}/attachments/0`, {
      headers: authHeaders(),
    });
    expect(response.status).toBe(413);
    fetchSpy.mockRestore();

    // Cleanup so subsequent tests aren't affected
    await updateChatMessageStatus(id, "rejected");
  });
});
