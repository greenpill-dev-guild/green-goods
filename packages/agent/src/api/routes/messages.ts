import type { Hono } from "hono";
import * as db from "../../services/db";
import { loggers } from "../../services/logger";
import type { ChatMessageStatus } from "../../types";
import { readBodyWithLimit, readJsonBody } from "../http/body";
import type { ApiRouteContext } from "../http/route-context";

const log = loggers.api;
const VALID_CHAT_MESSAGE_QUERY_STATUSES = new Set<string>([
  "new",
  "processing",
  "triaged",
  "rejected",
  "all",
]);
const VALID_CHAT_MESSAGE_PATCH_STATUSES = new Set<ChatMessageStatus>([
  "new",
  "processing",
  "triaged",
  "rejected",
]);
const VALID_CAPTURE_TYPES = new Set<string>(["bug", "idea"]);
const MAX_ATTACHMENT_PROXY_BYTES = 25 * 1024 * 1024; // 25MB — Telegram document/video limit for bots
const ATTACHMENT_DOWNLOAD_TIMEOUT_MS = 30_000;
const CHAT_MESSAGE_PROCESSING_LOCK_MS = 6 * 60 * 60 * 1000;

export function registerMessageRoutes(app: Hono, ctx: ApiRouteContext): void {
  const { auth: authHook, deps } = ctx;

  // GET /api/messages — read captured topic messages for routine consumption.
  //
  // Returns rows with embedded attachment metadata. Each attachment carries a
  // same-origin `downloadUrl` pointing at the proxy endpoint below, so the
  // routine can download bytes back without ever seeing the bot token.
  app.get("/api/messages", authHook, async (c) => {
    const chatId = c.req.query("chat_id");
    const threadId = c.req.query("thread_id");
    const status = c.req.query("status");
    const since = c.req.query("since");
    const inferredType = c.req.query("inferred_type");
    const limit = c.req.query("limit");

    if (status && !VALID_CHAT_MESSAGE_QUERY_STATUSES.has(status)) {
      return c.json(
        {
          error: `Invalid status. Must be one of: ${[...VALID_CHAT_MESSAGE_QUERY_STATUSES].join(", ")}`,
        },
        400
      );
    }

    if (inferredType && !VALID_CAPTURE_TYPES.has(inferredType)) {
      return c.json(
        {
          error: `Invalid inferred_type. Must be one of: ${[...VALID_CAPTURE_TYPES].join(", ")}`,
        },
        400
      );
    }

    const parsedSince = since ? parseInt(since, 10) : undefined;
    const sinceMs =
      parsedSince !== undefined && !Number.isNaN(parsedSince) ? parsedSince : undefined;

    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const limitValue =
      parsedLimit !== undefined && !Number.isNaN(parsedLimit) ? parsedLimit : undefined;

    const messages = await db.getNewChatMessages({
      chatId: chatId || undefined,
      threadId: threadId || undefined,
      status: status === "all" ? "all" : ((status as ChatMessageStatus | undefined) ?? "new"),
      since: sinceMs,
      inferredType: inferredType
        ? (inferredType as Parameters<typeof db.getNewChatMessages>[0]["inferredType"])
        : undefined,
      limit: limitValue,
    });

    const enriched = messages.map((message) => ({
      ...message,
      attachments: (message.attachments ?? []).map((attachment) => ({
        ordinal: attachment.ordinal,
        kind: attachment.kind,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
        duration: attachment.duration,
        width: attachment.width,
        height: attachment.height,
        downloadUrl: `/api/messages/${message.id}/attachments/${attachment.ordinal}`,
      })),
    }));

    return c.json({
      messages: enriched,
      count: enriched.length,
    });
  });

  // PATCH /api/messages/:id — claim or update captured-message status.
  // `processing` is an atomic claim from `new` (or stale processing); final
  // statuses are `triaged` / `rejected`. `new` is only for explicit recovery.
  app.patch("/api/messages/:id", authHook, async (c) => {
    const id = c.req.param("id");
    const body = await readJsonBody<{ status?: string }>(c.req.raw);
    const status = body?.status;

    if (!status || !VALID_CHAT_MESSAGE_PATCH_STATUSES.has(status as ChatMessageStatus)) {
      return c.json(
        {
          error: `Invalid status. Must be one of: ${[...VALID_CHAT_MESSAGE_PATCH_STATUSES].join(", ")}`,
        },
        400
      );
    }

    const existing = await db.getChatMessage(id);
    if (!existing) {
      return c.json({ error: "Chat message not found" }, 404);
    }

    if (status === "processing") {
      const now = deps.now?.() ?? Date.now();
      const claimed = await db.claimChatMessage(id, now - CHAT_MESSAGE_PROCESSING_LOCK_MS, now);
      if (!claimed) {
        return c.json({ error: "Chat message already claimed", status: existing.status }, 409);
      }
      return c.json({ ok: true, status: "processing" });
    }

    if (status === "new" && existing.status !== "processing") {
      return c.json(
        { error: "Only processing messages can be returned to new", status: existing.status },
        409
      );
    }

    await db.updateChatMessageStatus(id, status as ChatMessageStatus);
    return c.json({ ok: true });
  });

  // GET /api/messages/:id/attachments/:ordinal — proxy media bytes from
  // Telegram. We never redirect (the redirect URL contains the bot token);
  // we download the body server-side with a hard byte limit and forward only
  // safe response headers.
  app.get("/api/messages/:id/attachments/:ordinal", authHook, async (c) => {
    if (!deps.telegramBot) {
      return c.json({ error: "Telegram bot not available" }, 503);
    }

    const id = c.req.param("id");
    const ordinalRaw = c.req.param("ordinal");
    const ordinal = parseInt(ordinalRaw, 10);
    if (Number.isNaN(ordinal) || ordinal < 0) {
      return c.json({ error: "Invalid ordinal" }, 400);
    }

    const attachment = await db.getChatMessageAttachment(id, ordinal);
    if (!attachment) {
      return c.json({ error: "Attachment not found" }, 404);
    }

    let fileLink: URL;
    try {
      fileLink = await deps.telegramBot.telegram.getFileLink(attachment.telegramFileId);
    } catch (error) {
      log.warn(
        { err: error, id, ordinal, telegramFileId: attachment.telegramFileId },
        "Failed to resolve Telegram file link"
      );
      return c.json({ error: "Upstream file unavailable" }, 502);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ATTACHMENT_DOWNLOAD_TIMEOUT_MS);

    try {
      const upstream = await fetch(fileLink.toString(), {
        signal: controller.signal,
        redirect: "manual",
      });
      if (!upstream.ok || !upstream.body) {
        log.warn(
          { id, ordinal, status: upstream.status },
          "Telegram returned non-OK for file download"
        );
        return c.json({ error: "Upstream file unavailable" }, 502);
      }

      const declaredLength = upstream.headers.get("content-length");
      if (declaredLength) {
        const declared = Number(declaredLength);
        if (Number.isFinite(declared) && declared > MAX_ATTACHMENT_PROXY_BYTES) {
          return c.json({ error: "Attachment too large" }, 413);
        }
      }

      const contentType =
        attachment.mimeType ?? upstream.headers.get("content-type") ?? "application/octet-stream";
      const bytes = await readBodyWithLimit(upstream.body, MAX_ATTACHMENT_PROXY_BYTES);
      if (!bytes) {
        return c.json({ error: "Attachment too large" }, 413);
      }

      const headers = new Headers({
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      });
      headers.set("Content-Length", String(bytes.byteLength));

      const responseBody = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(responseBody).set(bytes);
      return new Response(responseBody, { status: 200, headers });
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      log.warn({ err: error, id, ordinal, isAbort }, "Failed to proxy Telegram attachment");
      return c.json({ error: isAbort ? "Upstream timeout" : "Upstream file unavailable" }, 502);
    } finally {
      clearTimeout(timeout);
    }
  });
}
