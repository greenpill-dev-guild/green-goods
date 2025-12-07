/**
 * Green Goods Agent
 *
 * Multi-platform agent for Green Goods that supports:
 * - Telegram (polling and webhook modes)
 * - HTTP API for health checks and webhooks
 *
 * Future platforms:
 * - Discord
 * - WhatsApp
 */

import dotenv from "dotenv";
import path from "path";

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { getConfig } from "./config";
import { Orchestrator, type OrchestratorDeps } from "./core/orchestrator";
import { SQLiteStorage } from "./adapters/storage/sqlite";
import { WhisperAI } from "./adapters/ai/whisper";
import { ViemBlockchain } from "./adapters/blockchain/viem";
import {
  createTelegramBot,
  createTelegramVoiceProcessor,
  createTelegramNotifier,
} from "./adapters/telegram";
import { createServer, startServer } from "./api/server";
import { rateLimiter, type RateLimitType } from "./services/rate-limiter";
import { generateSecurePrivateKey, generateSecureId, isValidAddress } from "./services/crypto";

// ============================================================================
// FACTORIES
// ============================================================================

/**
 * Creates a rate limiter adapter for the orchestrator
 */
function createRateLimiterAdapter() {
  return {
    check: (platformId: string, type: string) =>
      rateLimiter.check(platformId, type as RateLimitType),
    peek: (platformId: string, type: string) => rateLimiter.peek(platformId, type as RateLimitType),
  };
}

/**
 * Creates a crypto service adapter for the orchestrator
 */
function createCryptoAdapter() {
  return {
    generateSecurePrivateKey,
    generateSecureId,
    isValidAddress,
  };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function main(): Promise<void> {
  // Load configuration
  const config = getConfig();

  console.log("🌿 Green Goods Agent");
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Mode: ${config.mode}`);
  console.log(`   Chain: ${config.chain.name} (${config.chainId})`);
  console.log(`   Database: ${config.dbPath}`);

  // Initialize adapters
  const storage = new SQLiteStorage(config.dbPath);
  const ai = new WhisperAI();
  const blockchain = new ViemBlockchain(config.chain);

  // Create shared adapter instances
  const rateLimiterAdapter = createRateLimiterAdapter();
  const cryptoAdapter = createCryptoAdapter();

  // Create base orchestrator dependencies
  const baseDeps: OrchestratorDeps = {
    storage,
    ai,
    blockchain,
    rateLimiter: rateLimiterAdapter,
    crypto: cryptoAdapter,
  };

  // Create initial orchestrator for bot setup
  const orchestrator = new Orchestrator(baseDeps);

  // Create Telegram bot and platform-specific adapters
  const bot = createTelegramBot(config.telegramToken, orchestrator);
  const voiceProcessor = createTelegramVoiceProcessor(bot, ai);
  const notifier = createTelegramNotifier(bot);

  // Create full orchestrator with all adapters
  const fullOrchestrator = new Orchestrator({
    ...baseDeps,
    voiceProcessor,
    notifier,
  });

  // ============================================================================
  // LAUNCH
  // ============================================================================

  if (config.mode === "webhook") {
    // Webhook mode: Start HTTP server with Telegram webhook
    const server = createServer(
      {
        orchestrator: fullOrchestrator,
        telegramToken: config.telegramToken,
        isAIReady: () => ai.isModelLoaded(),
      },
      {
        port: config.port,
        host: config.host,
        logger: config.isDevelopment,
      }
    );

    // Set up Telegram webhook handler
    const webhookPath = `/webhook/telegram`;
    await bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}${webhookPath}`, {
      secret_token: config.telegramWebhookSecret,
    });

    // Start webhook mode
    await startServer(server, { port: config.port, host: config.host });

    console.log("✅ Agent running in webhook mode!");
    console.log(`   Webhook: ${process.env.WEBHOOK_URL}${webhookPath}`);
    console.log(`   Health: http://${config.host}:${config.port}/health`);
  } else {
    // Polling mode: Start bot with long polling
    await bot.launch(() => {
      console.log("✅ Agent running in polling mode!");
      console.log("   Press Ctrl+C to stop.\n");
    });
  }

  // ============================================================================
  // GRACEFUL SHUTDOWN
  // ============================================================================

  async function shutdown(signal: string): Promise<void> {
    console.log(`\n📴 Received ${signal}, shutting down gracefully...`);

    // Stop bot
    bot.stop(signal);

    // Clean up services
    rateLimiter.destroy();
    blockchain.clearCache();
    await storage.close();

    console.log("👋 Goodbye!");
    process.exit(0);
  }

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled rejection at:", promise, "reason:", reason);
  });
}

// Run
main().catch((error) => {
  console.error("Failed to start agent:", error);
  process.exit(1);
});
