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
import { createGroupCaptureHandler, handleMessage, setHandlerContext } from "./handlers";
import {
  createNotifier,
  createPhotoProcessor,
  createTelegramBot,
  createVoiceProcessor,
  registerSlashCommands,
} from "./platforms/telegram";
import { initAI, isAIModelLoaded } from "./services/ai";
import {
  initAgentAnalytics,
  shutdownAgentAnalytics,
  trackAgentRuntimeStarted,
} from "./services/analytics";
import { clearBlockchainCache, initBlockchain } from "./services/blockchain";
import { closeDB, initDB } from "./services/db";
import { resolveAgentRpcUrl } from "./services/agent-rpc";
import { createSqliteFundingIntentStore } from "./services/funding-intents";
import { logger } from "./services/logger";
import { rateLimiter } from "./services/rate-limiter";
import { captureAgentException, initAgentSentry, shutdownAgentSentry } from "./services/sentry";
import { createResendSubscriptionClient } from "./services/subscriptions";
import { createShutdownHandler } from "./runtime/shutdown";

// ============================================================================
// INITIALIZATION
// ============================================================================

async function main(): Promise<void> {
  const config = getConfig();
  initAgentSentry({
    dsn: config.sentryDsn,
    enabled: config.sentryEnabled,
    environment: config.nodeEnv,
    release: config.sentryRelease,
    tracesSampleRate: config.sentryTracesSampleRate,
    debug: config.sentryDebug,
  });
  initAgentAnalytics({
    apiKey: config.posthogApiKey,
    enabled: config.analyticsEnabled,
  });

  logger.info(
    {
      environment: config.nodeEnv,
      mode: config.telegramRuntimeDisabled ? "api-only" : config.mode,
      chain: config.chain.name,
      chainId: config.chainId,
      database: config.dbPath,
    },
    "🌿 Green Goods Agent starting"
  );
  await trackAgentRuntimeStarted({
    mode: config.mode,
    chainId: config.chainId,
    nodeEnv: config.nodeEnv,
  });

  // Initialize services
  initDB(config.dbPath);
  initBlockchain(config.chain, resolveAgentRpcUrl(config.chainId));
  const ai = initAI();
  const subscriptionClient = createResendSubscriptionClient({
    apiKey: config.resendApiKey,
    segmentId: config.resendGreenGoodsSegmentId,
    topicId: config.resendGreenGoodsTopicId,
  });

  const groupCapture = createGroupCaptureHandler(config.captureTopics);
  const bot = createTelegramBot({ token: config.telegramToken }, handleMessage, groupCapture);

  const voiceProcessor = createVoiceProcessor(bot, (audioPath) => ai.transcribe(audioPath));
  const photoProcessor = createPhotoProcessor(bot);
  const notifier = createNotifier(bot);
  setHandlerContext({ voiceProcessor, photoProcessor, notifier });

  if (config.telegramRuntimeDisabled) {
    logger.info("Telegram runtime disabled; starting local HTTP API only");
  } else {
    await registerSlashCommands(bot).catch((err) => {
      logger.warn({ err }, "Failed to register slash commands; continuing");
    });
  }

  // ============================================================================
  // LAUNCH
  // ============================================================================

  // Start HTTP server in both modes (health + API endpoints always available)
  const server = createServer({
    isAIReady: isAIModelLoaded,
    botApiToken: config.botApiToken,
    telegramBot: bot,
    subscriptionClient,
    fundingIntents: createSqliteFundingIntentStore(),
    allowedOrigins: parseAllowedOrigins(config.publicAllowedOrigins),
    trustedProxy: {
      hops: config.trustedProxyHops,
      cidrs: config.trustedProxyCidrs?.split(",").map((cidr: string) => cidr.trim()),
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

  if (config.telegramRuntimeDisabled) {
    logger.info("Telegram webhook/polling launch skipped for local API-only mode");
  } else if (config.mode === "webhook") {
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
      mode: config.telegramRuntimeDisabled ? "api-only" : config.mode,
      health: `http://${config.host}:${config.port}/health`,
      api: config.botApiToken ? "enabled" : "disabled (no BOT_API_TOKEN)",
      ...(config.mode === "webhook" && !config.telegramRuntimeDisabled
        ? { webhook: `${process.env.WEBHOOK_URL}/webhook/telegram` }
        : {}),
    },
    "✅ Agent running"
  );

  // ============================================================================
  // SHUTDOWN HANDLERS
  // ============================================================================

  const shutdown = createShutdownHandler({
    bot,
    botMode: config.telegramRuntimeDisabled ? "webhook" : config.mode,
    cleanupTasks: [
      () => rateLimiter.destroy(),
      closeDB,
      clearBlockchainCache,
      shutdownAgentAnalytics,
      shutdownAgentSentry,
    ],
    exit: (code) => process.exit(code),
    logger,
    server,
  });

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

main().catch(async (error) => {
  captureAgentException(error, { source: "startup", surface: "runtime" });
  logger.error({ error }, "❌ Failed to start agent");
  await shutdownAgentAnalytics().catch(() => undefined);
  await shutdownAgentSentry().catch(() => undefined);
  process.exit(1);
});