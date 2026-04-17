/**
 * HTTP API Server
 *
 * Fastify server for webhooks, health endpoints, and routine-facing API.
 * Designed for multi-platform webhook support.
 *
 * SECURITY: Platform parameters are validated against an allowlist.
 * SECURITY: /api/* routes require Bearer token authentication.
 */

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import * as db from "../services/db";
import { loggers } from "../services/logger";
import type { FeedbackStatus, FeedbackType, Platform } from "../types";

const log = loggers.api;

// ============================================================================
// SECURITY: Platform Allowlist
// ============================================================================

/**
 * Allowed platform identifiers for webhook endpoints.
 * Only these platforms can receive webhooks.
 */
const ALLOWED_PLATFORMS = ["telegram", "whatsapp", "sms", "discord"] as const;
type AllowedPlatform = (typeof ALLOWED_PLATFORMS)[number];

function isAllowedPlatform(platform: string): platform is AllowedPlatform {
  return ALLOWED_PLATFORMS.includes(platform as AllowedPlatform);
}

// ============================================================================
// TYPES
// ============================================================================

export interface ServerConfig {
  port: number;
  host?: string;
  logger?: boolean;
}

export interface ServerDeps {
  isAIReady: () => boolean;
  botApiToken?: string;
  notifier?: {
    notify: (platform: string, platformId: string, message: string) => Promise<void>;
  };
}

// ============================================================================
// AUTH MIDDLEWARE
// ============================================================================

const VALID_FEEDBACK_TYPES = new Set<string>(["bug", "idea"]);
const VALID_FEEDBACK_STATUSES = new Set<string>(["triaged", "responded"]);
const VALID_NOTIFY_PLATFORMS = new Set<string>(["telegram", "discord", "whatsapp", "sms"]);

function requireApiAuth(deps: ServerDeps) {
  return async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!deps.botApiToken) {
      return reply.status(503).send({ error: "API authentication not configured" });
    }
    const auth = _request.headers.authorization;
    if (!auth || auth !== `Bearer ${deps.botApiToken}`) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  };
}

// ============================================================================
// SERVER
// ============================================================================

/**
 * Create and configure the Fastify server
 */
export function createServer(deps: ServerDeps, config?: Partial<ServerConfig>): FastifyInstance {
  const app = Fastify({
    logger: config?.logger ?? true,
  });

  // Health endpoints
  app.get("/health", async () => ({
    status: "ok",
    timestamp: Date.now(),
    uptime: process.uptime(),
    services: {
      ai: deps.isAIReady() ? "ready" : "loading",
    },
  }));

  app.get("/ready", async (request, reply) => {
    if (!deps.isAIReady()) {
      return reply.status(503).send({
        status: "not_ready",
        message: "AI model is still loading",
      });
    }
    return { status: "ready", timestamp: Date.now() };
  });

  // Generic webhook endpoint for future platforms
  // SECURITY: Platform parameter is validated against allowlist
  app.post<{ Params: { platform: string }; Body: unknown }>(
    "/webhook/:platform",
    async (request, reply) => {
      const { platform } = request.params;

      // SECURITY: Validate platform against allowlist before processing
      if (!isAllowedPlatform(platform)) {
        log.warn({ platform }, "Rejected webhook request for unknown platform");
        return reply.status(400).send({ error: "Invalid platform" });
      }

      switch (platform) {
        case "telegram":
          // Handled by bot.handleUpdate in main index.ts
          return { ok: true };

        case "whatsapp":
          return reply.status(501).send({ error: "WhatsApp webhooks not yet implemented" });

        case "sms":
          return reply.status(501).send({ error: "SMS webhooks not yet implemented" });

        case "discord":
          return reply.status(501).send({ error: "Discord webhooks not yet implemented" });
      }
    }
  );

  // ==========================================================================
  // ROUTINE-FACING API (/api/*)
  // ==========================================================================

  const authHook = requireApiAuth(deps);

  // GET /api/feedback — Read new feedback for routine consumption
  app.get<{
    Querystring: { since?: string; type?: string };
  }>("/api/feedback", { preHandler: authHook }, async (request) => {
    const { since, type } = request.query;

    const parsed = since ? parseInt(since, 10) : undefined;
    const sinceMs = parsed !== undefined && !Number.isNaN(parsed) ? parsed : undefined;
    const feedbackType =
      type && VALID_FEEDBACK_TYPES.has(type) ? (type as FeedbackType) : undefined;

    const feedback = await db.getNewFeedback(sinceMs, feedbackType);

    return {
      feedback,
      count: feedback.length,
    };
  });

  // PATCH /api/feedback/:id — Update feedback status
  app.patch<{
    Params: { id: string };
    Body: { status: string };
  }>("/api/feedback/:id", { preHandler: authHook }, async (request, reply) => {
    const { id } = request.params;
    const { status } = request.body || {};

    if (!status || !VALID_FEEDBACK_STATUSES.has(status)) {
      return reply.status(400).send({
        error: "Invalid status. Must be one of: triaged, responded",
      });
    }

    const existing = await db.getFeedback(id);
    if (!existing) {
      return reply.status(404).send({ error: "Feedback not found" });
    }

    await db.updateFeedbackStatus(id, status as FeedbackStatus);
    return { ok: true };
  });

  // POST /api/notify — Send a message to a user via the bot
  app.post<{
    Body: {
      platform: string;
      platformId: string;
      message: string;
      feedbackId?: string;
    };
  }>("/api/notify", { preHandler: authHook }, async (request, reply) => {
    if (!deps.notifier) {
      return reply.status(503).send({ error: "Notifier not available" });
    }

    const { platform, platformId, message, feedbackId } = request.body || {};

    if (!platform || !platformId || !message) {
      return reply.status(400).send({ error: "Required fields: platform, platformId, message" });
    }

    if (!VALID_NOTIFY_PLATFORMS.has(platform)) {
      return reply.status(400).send({
        error: `Invalid platform. Must be one of: ${[...VALID_NOTIFY_PLATFORMS].join(", ")}`,
      });
    }

    await deps.notifier.notify(platform as Platform, platformId, message);

    if (feedbackId) {
      const existing = await db.getFeedback(feedbackId);
      if (existing) {
        await db.updateFeedbackStatus(feedbackId, "responded");
      }
    }

    return { ok: true };
  });

  return app;
}

/**
 * Start the server
 */
export async function startServer(app: FastifyInstance, config: ServerConfig): Promise<void> {
  try {
    await app.listen({
      port: config.port,
      host: config.host || "0.0.0.0",
    });
    log.info({ port: config.port, host: config.host }, "🚀 Server listening");
  } catch (err) {
    log.error({ err }, "Server failed to start");
    throw err;
  }
}
