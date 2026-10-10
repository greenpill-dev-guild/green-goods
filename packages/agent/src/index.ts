/**
 * Green Goods Agent
 *
 * Multi-platform bot supporting:
 * - Telegram (polling and webhook modes)
 * - HTTP API for health checks and webhooks
 *
 * Future platforms: Discord, WhatsApp, SMS
 */

import { dirname } from "node:path";
import { createServer, createThirdwebCheckoutClient, startServer } from "./api/server";
import { resolveAllowedOrigins } from "./api/public-protection";
import { getConfig } from "./config";
import { createGroupCaptureHandler, handleMessage, setHandlerContext } from "./handlers";
import {
  createNotifier,
  createPhotoProcessor,
  createTelegramBot,
  createVoiceProcessor,
  registerSlashCommands,
} from "./platforms/telegram";
import { createTelegramReporting, telegramRealm } from "./platforms/telegram-reporting";
import { initAI, isAIModelLoaded } from "./services/ai";
import {
  initAgentAnalytics,
  shutdownAgentAnalytics,
  trackAgentRuntimeStarted,
} from "./services/analytics";
import {
  clearBlockchainCache,
  confirmFundingTupleOnChain,
  initBlockchain,
  readVaultShareBalanceOnChain,
} from "./services/blockchain";
import { closeDB, initDB } from "./services/db";
import { resolveAgentRpc, resolveAgentRpcUrl, rpcHost } from "./services/agent-rpc";
import { createSqliteFundingIntentStore } from "./services/funding-intents";
import {
  createSqliteProfileAvatarStore,
  createViemProfileAvatarSignatureVerifier,
} from "./services/profile-avatars";
import {
  createSavedOfferCipher,
  createSqliteSavedOfferStore,
  MemorySavedOffersSessionStore,
} from "./services/saved-offers";
import { logger } from "./services/logger";
import { rateLimiter } from "./services/rate-limiter";
import { captureAgentException, initAgentSentry, shutdownAgentSentry } from "./services/sentry";
import { createResendSubscriptionClient } from "./services/subscriptions";
import { startReporting } from "./runtime/reporting-startup";
import { createShutdownHandler } from "./runtime/shutdown";
import {
  createGardenJoinRequestCipher,
  createSqliteGardenJoinRequestStore,
} from "./services/garden-join-requests";
import { createGardenJoinRequestChainReader } from "./services/garden-join-requests-chain";
import { createGardenJoinRequestSignatureVerifier } from "./services/garden-join-requests-verifier";
import { createPasskeyDirectory } from "./services/passkey-directory";
import {
  createHostedPasskeyNameCheck,
  createSqlitePasskeyDirectoryStore,
} from "./services/passkey-directory-adapters";
import { PASSKEY_RP_ID, PASSKEY_RP_NAME } from "@green-goods/shared/public-contracts";

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
  const agentRpc = resolveAgentRpc(config.chainId);
  // Only the host is logged: a configured address can carry a provider key in its path.
  const rpcLog = {
    chainId: config.chainId,
    host: rpcHost(agentRpc.url),
    source: agentRpc.source,
  };
  if (agentRpc.source === "public") {
    logger.warn(
      rpcLog,
      "No RPC address or Alchemy key is set for this chain; using its public endpoint, which is rate limited"
    );
  } else {
    logger.info(rpcLog, "Chain reads go through the configured RPC");
  }
  initBlockchain(config.chain, agentRpc.url);
  const ai = initAI();
  const subscriptionClient = createResendSubscriptionClient({
    apiKey: config.resendApiKey,
    segmentId: config.resendGreenGoodsSegmentId,
    topicId: config.resendGreenGoodsTopicId,
  });
  const savedOfferCipher = config.savedOffersEncryptionKey
    ? createSavedOfferCipher(config.savedOffersEncryptionKey)
    : undefined;
  const joinRequestCipher = config.joinRequestsEncryptionKey
    ? createGardenJoinRequestCipher(config.joinRequestsEncryptionKey)
    : undefined;
  const gardenJoinRequestStore = joinRequestCipher
    ? createSqliteGardenJoinRequestStore(joinRequestCipher)
    : undefined;
  const agentRpcUrl = agentRpc.url;

  const trustedProxy = {
    hops: config.trustedProxyHops,
    cidrs: config.trustedProxyCidrs?.split(",").map((cidr) => cidr.trim()),
  };
  // Agent reporting stays off without its keys and an available chat channel. It starts before the
  // bot so that the bot can hand it private chats while its Telegram channel is on.
  const reporting = startReporting({
    env: process.env,
    chain: config.chain,
    chainId: config.chainId,
    rpcUrl: agentRpcUrl,
    isProduction: config.isProduction,
    dataDir: dirname(config.dbPath),
    trustedProxy,
  });
  const reportingRealm = telegramRealm(config.telegramToken);
  const telegramReporting =
    reporting?.channels.has("telegram") && reportingRealm
      ? createTelegramReporting(reporting.core, reportingRealm)
      : undefined;

  const groupCapture = createGroupCaptureHandler(config.captureTopics);
  const bot = createTelegramBot(
    { token: config.telegramToken },
    handleMessage,
    groupCapture,
    telegramReporting
  );

  const voiceProcessor = createVoiceProcessor(bot, (audioPath) => ai.transcribe(audioPath));
  const photoProcessor = createPhotoProcessor(bot);
  const notifier = createNotifier(bot);
  setHandlerContext({ voiceProcessor, photoProcessor, notifier });

  if (config.telegramRuntimeDisabled) {
    logger.info("Telegram runtime disabled; starting local HTTP API only");
  } else {
    await registerSlashCommands(bot, Boolean(telegramReporting)).catch((err) => {
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
    profileAvatarStore: createSqliteProfileAvatarStore(),
    profileAvatarChainId: config.chainId,
    profileAvatarSignatureVerifier: createViemProfileAvatarSignatureVerifier({
      chain: config.chain,
      rpcUrl: resolveAgentRpcUrl(config.chainId),
    }),
    savedOfferStore: savedOfferCipher ? createSqliteSavedOfferStore(savedOfferCipher) : undefined,
    savedOffersSessionStore: savedOfferCipher
      ? new MemorySavedOffersSessionStore({ tokenSecret: config.savedOffersEncryptionKey })
      : undefined,
    savedOffersSignatureVerifier: createViemProfileAvatarSignatureVerifier({
      chain: config.chain,
      rpcUrl: resolveAgentRpcUrl(config.chainId),
    }),
    savedOffersAudience: config.savedOffersAudience,
    savedOffersChainIds: [config.chainId],
    passkeyDirectory: createPasskeyDirectory({
      store: createSqlitePasskeyDirectoryStore(),
      relyingParty: { id: PASSKEY_RP_ID, name: PASSKEY_RP_NAME },
      hostedNameTaken: config.passkeyHostedDirectoryUrl
        ? createHostedPasskeyNameCheck({
            rpcUrl: config.passkeyHostedDirectoryUrl,
            origin: `https://${PASSKEY_RP_ID}`,
          })
        : undefined,
      allowLocalDevelopment: config.isDevelopment,
    }),
    gardenJoinRequestsEnabled: config.joinRequestsEnabled,
    gardenJoinRequestStore,
    ...(config.joinRequestsEnabled
      ? {
          gardenJoinRequestChainId: config.chainId,
          gardenJoinRequestChainReader: createGardenJoinRequestChainReader({
            chain: config.chain,
            rpcUrl: agentRpcUrl,
          }),
          gardenJoinRequestSignatureVerifier: createGardenJoinRequestSignatureVerifier({
            chain: config.chain,
            rpcUrl: agentRpcUrl,
          }),
        }
      : {}),
    allowedOrigins: resolveAllowedOrigins(config.publicAllowedOrigins, {
      includeDevelopmentDefaults: config.isDevelopment,
    }),
    trustedProxy,
    ...(reporting ? { messaging: reporting.messaging } : {}),
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
    thirdwebCheckout: createThirdwebCheckoutClient({
      clientId: config.thirdwebClientId,
      secretKey: config.thirdwebSecretKey,
    }),
    // Card Endow proof verifiers — chain-aware (the funding tx lands on the
    // tuple's chain, e.g. Ethereum mainnet, not the Green Goods chain). The
    // proof route fails closed without them; share balances are read on-chain,
    // never trusted from the client.
    confirmFundingTuple: (txHash, expected) =>
      confirmFundingTupleOnChain(
        txHash as `0x${string}`,
        expected,
        resolveAgentRpcUrl(expected.chainId)
      ),
    readVaultShareBalance: (params) =>
      readVaultShareBalanceOnChain(params, resolveAgentRpcUrl(params.chainId)),
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
  // GRACEFUL SHUTDOWN
  // ============================================================================

  const shutdown = createShutdownHandler({
    bot,
    botMode: config.telegramRuntimeDisabled ? "webhook" : config.mode,
    cleanupTasks: [
      () => rateLimiter.destroy(),
      () => clearBlockchainCache(),
      closeDB,
      shutdownAgentAnalytics,
      shutdownAgentSentry,
      ...(reporting ? [() => reporting.stop()] : []),
    ],
    exit: (code) => process.exit(code),
    logger,
    server,
  });

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Uncaught exception");
    captureAgentException(error, { source: "process.uncaughtException", surface: "runtime" });
    void shutdown("uncaughtException", 1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error({ reason, promise }, "Unhandled rejection");
    captureAgentException(reason, { source: "process.unhandledRejection", surface: "runtime" });
  });

  if (!config.telegramRuntimeDisabled && config.mode === "polling") {
    // Telegraf's polling launch settles only when polling stops, so it starts after the server
    // and must not be awaited; a failure stops the Agent, as a failed start did before.
    bot
      .launch(() => logger.info("✅ Agent Telegram bot running in polling mode"))
      .catch((error: unknown) => {
        logger.fatal({ err: error }, "Telegram polling stopped");
        captureAgentException(error, { source: "telegram.polling", surface: "runtime" });
        void shutdown("telegramPolling", 1);
      });
  }
}

main().catch((error) => {
  logger.fatal({ err: error }, "Failed to start agent");
  captureAgentException(error, { source: "startup", surface: "runtime" });
  process.exit(1);
});
