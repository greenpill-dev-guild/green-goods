/**
 * Green Goods Agent
 *
 * Multi-platform bot supporting:
 * - Telegram (polling and webhook modes)
 * - HTTP API for health checks and webhooks
 *
 * Future platforms: Discord, WhatsApp, SMS
 */

import { createServer, startServer } from "./api/server";
import { parseAllowedOrigins } from "./api/public-protection";
import { getConfig } from "./config";
import { handleMessage, setHandlerContext } from "./handlers";
import {
  createNotifier,
  createPhotoProcessor,
  createTelegramBot,
  createVoiceProcessor,
} from "./platforms/telegram";
import { initAI, isAIModelLoaded } from "./services/ai";
import { clearBlockchainCache, initBlockchain } from "./services/blockchain";
import { closeDB, initDB } from "./services/db";
import { resolveAgentRpcUrl } from "./services/agent-rpc";
import { createSqliteFundingIntentStore } from "./services/funding-intents";
import { logger } from "./services/logger";
import { createLumaClient } from "./services/luma";
import { rateLimiter } from "./services/rate-limiter";

// ============================================================================
// INITIALIZATION
// ============================================================================

async function main(): Promise<void> {
  const config = getConfig();

  logger.info(
    {
      environment: config.nodeEnv,
      mode: config.mode,
      chain: config.chain.name,
      chainId: config.chainId,
      database: config.dbPath,
    },
    "🌿 Green Goods Agent starting"
  );

  // Initialize services
  initDB(config.dbPath);
  initBlockchain(config.chain, resolveAgentRpcUrl(config.chainId));
  const ai = initAI();
  const lumaClient = createLumaClient({
    apiKey: config.lumaApiKey,
    calendarId: config.lumaCalendarId,
    tagId: config.lumaGreenGoodsTagId,
    tagName: config.lumaGreenGoodsTagName,
  });

  const bot = createTelegramBot({ token: config.telegramToken }, handleMessage);

  const voiceProcessor = createVoiceProcessor(bot, (audioPath) => ai.transcribe(audioPath));
  const photoProcessor = createPhotoProcessor(bot);
  const notifier = createNotifier(bot);
  setHandlerContext({ voiceProcessor, photoProcessor, notifier });

  // ============================================================================
  // LAUNCH
  // ============================================================================

  // Start HTTP server in both modes (health + API endpoints always available)
  const server = createServer({
    isAIReady: isAIModelLoaded,
    botApiToken: config.botApiToken,
    notifier,
    lumaClient,
    fundingIntents: createSqliteFundingIntentStore(),
    allowedOrigins: parseAllowedOrigins(config.publicAllowedOrigins),
    trustedProxy: {
      hops: config.trustedProxyHops,
      cidrs: config.trustedProxyCidrs?.split(",").map((cidr) => cidr.trim()),
    },
    uploadSigning: {
      pinataJwt: config.pinataJwt,
      pinataUploadsApiBaseUrl: config.pinataUploadsApiBaseUrl,
      ttlSeconds: config.uploadSignerTtlSeconds,
      maxFileSize: config.uploadSignerMaxFileSize,
      allowedMimeTypes: config.uploadSignerAllowedMimeTypes,
      rateLimit: config.uploadSignerRateLimit,
      rateLimitWindowMs: config.uploadSignerRateLimitWindowMs,
    },
    thirdwebWebhookSecret: config.thirdwebWebhookSecret,
    thirdwebClientId: config.thirdwebClientId,
  });

  if (config.mode === "webhook") {
    const webhookPath = `/webhook/telegram`;
    await bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}${webhookPath}`, {
      secret_token: config.telegramWebhookSecret,
    });

    // SECURITY: Always verify webhook secret when configured
    server.post(webhookPath, async (c) => {
      const secretToken = c.req.header("x-telegram-bot-api-secret-token");

      // In production, webhook secret is required (validated in config.ts)
      // In development, it's optional but if configured, we verify it
      if (config.telegramWebhookSecret) {
        if (secretToken !== config.telegramWebhookSecret) {
          logger.warn({ hasToken: !!secretToken }, "Webhook request rejected: invalid secret");
          return c.json({ error: "Unauthorized" }, 401);
        }
      } else if (config.isProduction) {
        // This shouldn't happen due to config validation, but belt-and-suspenders
        logger.error("Webhook secret not configured in production - rejecting request");
        return c.json({ error: "Server misconfigured" }, 500);
      }

      const body = (await c.req.json().catch(() => undefined)) as
        | Parameters<typeof bot.handleUpdate>[0]
        | undefined;
      await bot.handleUpdate(body as Parameters<typeof bot.handleUpdate>[0]);
      return c.json({ ok: true });
    });
  } else {
    // Polling mode for Telegram
    await bot.launch(() => {
      logger.info("✅ Agent Telegram bot running in polling mode");
    });
  }

  await startServer(server, { port: config.port, host: config.host });

  logger.info(
    {
      mode: config.mode,
      health: `http://${config.host}:${config.port}/health`,
      api: config.botApiToken ? "enabled" : "disabled (no BOT_API_TOKEN)",
      ...(config.mode === "webhook"
        ? { webhook: `${process.env.WEBHOOK_URL}/webhook/telegram` }
        : {}),
    },
    "✅ Agent running"
  );

  // ============================================================================
  // GRACEFUL SHUTDOWN
  // ============================================================================

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, "📴 Shutting down gracefully");

    bot.stop(signal);
    await server.close();
    rateLimiter.destroy();
    clearBlockchainCache();
    await closeDB();

    logger.info("👋 Agent shutdown complete");
    process.exit(0);
  }

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Uncaught exception");
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error({ reason, promise }, "Unhandled rejection");
  });
}

main().catch((error) => {
  logger.fatal({ err: error }, "Failed to start agent");
  process.exit(1);
});
