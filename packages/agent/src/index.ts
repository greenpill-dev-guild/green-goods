/**
 * Green Goods Agent
 *
 * Multi-platform bot supporting:
 * - Telegram (polling and webhook modes)
 * - HTTP API for health checks and webhooks
 *
 * Future platforms: Discord, WhatsApp, SMS
 */

import dotenv from "dotenv";
import path from "path";

// Load environment from root .env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { createServer, startServer } from "./api/server";
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
import { logger } from "./services/logger";
import { initMedia, isMediaConfigured } from "./services/media";
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
  initBlockchain(config.chain);
  const ai = initAI();

  // Initialize media service if Storacha credentials are available
  const storachaKey = process.env.STORACHA_KEY;
  const storachaProof = process.env.STORACHA_PROOF;
  if (storachaKey && storachaProof) {
    await initMedia(storachaKey, storachaProof, process.env.STORACHA_GATEWAY);
    logger.info("Media service (Storacha) initialized");
  } else {
    logger.warn("STORACHA_KEY and STORACHA_PROOF not configured - photo uploads will be disabled");
  }

  // Create Telegram bot
  const bot = createTelegramBot({ token: config.telegramToken }, handleMessage);

  // Create platform-specific adapters
  const voiceProcessor = createVoiceProcessor(bot, (audioPath) => ai.transcribe(audioPath));
  const photoProcessor = isMediaConfigured() ? createPhotoProcessor(bot) : undefined;
  const notifier = createNotifier(bot);

  // Set handler context with platform adapters
  setHandlerContext({ voiceProcessor, photoProcessor, notifier });

  // ============================================================================
  // LAUNCH
  // ============================================================================

  if (config.mode === "webhook") {
    // Webhook mode: Start HTTP server
    const server = createServer({
      isAIReady: isAIModelLoaded,
    });

    // Set up Telegram webhook
    const webhookPath = `/webhook/telegram`;
    await bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}${webhookPath}`, {
      secret_token: config.telegramWebhookSecret,
    });

    // Add Telegram webhook handler to server
    server.post(webhookPath, async (request, reply) => {
      const secretToken = request.headers["x-telegram-bot-api-secret-token"];
      if (config.telegramWebhookSecret && secretToken !== config.telegramWebhookSecret) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      await bot.handleUpdate(request.body as Parameters<typeof bot.handleUpdate>[0]);
      return { ok: true };
    });

    await startServer(server, { port: config.port, host: config.host });

    logger.info(
      {
        webhook: `${process.env.WEBHOOK_URL}${webhookPath}`,
        health: `http://${config.host}:${config.port}/health`,
      },
      "✅ Agent running in webhook mode"
    );
  } else {
    // Polling mode
    await bot.launch(() => {
      logger.info("✅ Agent running in polling mode");
    });
  }

  // ============================================================================
  // GRACEFUL SHUTDOWN
  // ============================================================================

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, "📴 Shutting down gracefully");

    bot.stop(signal);
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
