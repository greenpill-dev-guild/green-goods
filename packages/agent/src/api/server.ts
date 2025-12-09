/**
 * HTTP API Server
 *
 * Fastify server for webhooks and health endpoints.
 * Designed for multi-platform webhook support.
 */

import Fastify, { type FastifyInstance } from "fastify";
import { loggers } from "../services/logger";

const log = loggers.api;

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
  app.post<{ Params: { platform: string }; Body: unknown }>(
    "/webhook/:platform",
    async (request, reply) => {
      const { platform } = request.params;

      switch (platform) {
        case "telegram":
          // Handled by bot.handleUpdate in main index.ts
          return { ok: true };

        case "whatsapp":
          // TODO: WhatsApp Cloud API webhook
          return reply.status(501).send({ error: "WhatsApp webhooks not yet implemented" });

        case "sms":
          // TODO: Twilio webhook
          return reply.status(501).send({ error: "SMS webhooks not yet implemented" });

        case "discord":
          // TODO: Discord webhook
          return reply.status(501).send({ error: "Discord webhooks not yet implemented" });

        default:
          return reply.status(404).send({ error: `Unknown platform: ${platform}` });
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
