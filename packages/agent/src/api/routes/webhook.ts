/**
 * Webhook Routes
 *
 * Webhook endpoints for receiving platform updates.
 */

import type { FastifyInstance } from "fastify";
import type { Orchestrator } from "../../core/orchestrator";

export interface WebhookDeps {
  orchestrator: Orchestrator;
  telegramToken: string;
}

/**
 * Register webhook routes
 */
export async function webhookRoutes(app: FastifyInstance, _deps: WebhookDeps): Promise<void> {
  /**
   * Telegram webhook verification (for setting up webhook)
   */
  app.get("/webhook/telegram", async () => {
    return { status: "webhook_ready", platform: "telegram" };
  });

  /**
   * Telegram webhook receiver
   *
   * Note: In webhook mode, Telegraf handles the actual update processing.
   * This endpoint is for custom processing or health checks.
   */
  app.post<{
    Body: unknown;
    Headers: {
      "x-telegram-bot-api-secret-token"?: string;
    };
  }>("/webhook/telegram", async (request, reply) => {
    // Verify secret token if configured
    const secretToken = request.headers["x-telegram-bot-api-secret-token"];
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (expectedSecret && secretToken !== expectedSecret) {
      return reply.status(401).send({ error: "Invalid secret token" });
    }

    // Log the update for debugging (in development)
    if (process.env.NODE_ENV === "development") {
      app.log.debug({ update: request.body }, "Received Telegram update");
    }

    // Actual processing is done by Telegraf webhook handler
    // This is just an acknowledgment
    return { ok: true };
  });

  /**
   * Discord webhook endpoint (placeholder for future)
   */
  app.post<{
    Body: unknown;
  }>("/webhook/discord", async (request, reply) => {
    // TODO: Implement Discord webhook handling

    // Discord verification challenge
    const body = request.body as { type?: number };
    if (body.type === 1) {
      // PING - respond with PONG
      return { type: 1 };
    }

    return reply.status(501).send({
      error: "Discord integration not yet implemented",
    });
  });

  /**
   * WhatsApp webhook endpoint (placeholder for future)
   */
  app.get("/webhook/whatsapp", async (request, reply) => {
    // WhatsApp verification challenge
    const query = request.query as {
      "hub.mode"?: string;
      "hub.verify_token"?: string;
      "hub.challenge"?: string;
    };

    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === "subscribe" && token === verifyToken) {
      return reply.status(200).send(challenge);
    }

    return reply.status(403).send({ error: "Verification failed" });
  });

  app.post<{
    Body: unknown;
  }>("/webhook/whatsapp", async (request, reply) => {
    // TODO: Implement WhatsApp webhook handling
    return reply.status(501).send({
      error: "WhatsApp integration not yet implemented",
    });
  });
}
