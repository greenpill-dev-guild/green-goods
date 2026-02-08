/**
 * HTTP API Server
 *
 * Fastify server for webhooks and health endpoints.
 * Designed for multi-platform webhook support.
 *
 * SECURITY: Platform parameters are validated against an allowlist.
 */

import Fastify, { type FastifyInstance } from "fastify";
import { loggers } from "../services/logger";

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

export interface ServerConfig {
  port: number;
  host?: string;
  logger?: boolean;
}

export interface ServerDeps {
  isAIReady: () => boolean;
}

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
          // Future: WhatsApp Cloud API webhook integration
          // See: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
          return reply.status(501).send({ error: "WhatsApp webhooks not yet implemented" });

        case "sms":
          // Future: Twilio SMS webhook integration
          // See: https://www.twilio.com/docs/messaging/guides/webhook-request
          return reply.status(501).send({ error: "SMS webhooks not yet implemented" });

        case "discord":
          // Future: Discord webhook/bot integration
          // See: https://discord.com/developers/docs/interactions/receiving-and-responding
          return reply.status(501).send({ error: "Discord webhooks not yet implemented" });
      }
    }
  );

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
