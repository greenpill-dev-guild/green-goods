/**
 * HTTP API Server
 *
 * Fastify server for webhooks and health endpoints.
 */

import Fastify, { type FastifyInstance } from "fastify";
import type { Orchestrator } from "../core/orchestrator";

export interface ServerConfig {
  port: number;
  host?: string;
  logger?: boolean;
}

export interface ServerDeps {
  orchestrator: Orchestrator;
  telegramToken: string;
  isAIReady: () => boolean;
}

/**
 * Create and configure the Fastify server
 */
export function createServer(deps: ServerDeps, config: ServerConfig): FastifyInstance {
  const app = Fastify({
    logger: config.logger ?? true,
  });

  // Register routes
  registerHealthRoutes(app, deps);
  registerWebhookRoutes(app, deps);

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
    console.log(`🚀 Server listening on port ${config.port}`);
  } catch (err) {
    app.log.error(err);
    throw err;
  }
}

/**
 * Register health check routes
 */
function registerHealthRoutes(app: FastifyInstance, deps: ServerDeps): void {
  app.get("/health", async () => {
    return {
      status: "ok",
      timestamp: Date.now(),
      uptime: process.uptime(),
      services: {
        ai: deps.isAIReady() ? "ready" : "loading",
      },
    };
  });

  app.get("/ready", async (request, reply) => {
    const isReady = deps.isAIReady();
    if (!isReady) {
      return reply.status(503).send({
        status: "not_ready",
        message: "AI model is still loading",
      });
    }
    return {
      status: "ready",
      timestamp: Date.now(),
    };
  });
}

/**
 * Register webhook routes
 */
function registerWebhookRoutes(app: FastifyInstance, _deps: ServerDeps): void {
  // Telegram webhook endpoint
  app.post<{
    Body: unknown;
    Headers: { "x-telegram-bot-api-secret-token"?: string };
  }>("/webhook/telegram", async (request, reply) => {
    // Verify Telegram webhook secret if configured
    const secretToken = request.headers["x-telegram-bot-api-secret-token"];
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (expectedSecret && secretToken !== expectedSecret) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // The actual webhook handling is done by Telegraf's webhook mode
    // This endpoint is primarily for health checks and custom processing
    // In webhook mode, Telegraf handles the /webhook/telegram route itself

    return { ok: true };
  });

  // Generic webhook for future platforms
  app.post<{
    Params: { platform: string };
    Body: unknown;
  }>("/webhook/:platform", async (request, reply) => {
    const { platform } = request.params;

    switch (platform) {
      case "telegram":
        // Handled separately above
        return { ok: true };

      case "discord":
        // TODO: Implement Discord webhook handling
        return reply.status(501).send({
          error: "Discord webhooks not yet implemented",
        });

      case "whatsapp":
        // TODO: Implement WhatsApp webhook handling
        return reply.status(501).send({
          error: "WhatsApp webhooks not yet implemented",
        });

      default:
        return reply.status(404).send({
          error: `Unknown platform: ${platform}`,
        });
    }
  });
}
