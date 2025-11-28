/**
 * Green Goods Telegram Bot
 *
 * Entry point for the Telegram bot that enables users to:
 * - Join gardens and submit work via text/voice
 * - Operators can approve/reject work submissions
 *
 * @see /docs/developer/architecture/telegram-bot.md
 */

import dotenv from "dotenv";
import path from "path";
import { createBot } from "./bot";
import { storage } from "./services/storage";
import { rateLimiter } from "./services/rate-limiter";
import { verificationService } from "./services/verification";

// ============================================================================
// ENVIRONMENT SETUP
// ============================================================================

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN environment variable is required!");
  console.error("   Please add it to your .env file in the project root.");
  process.exit(1);
}

// ============================================================================
// BOT INITIALIZATION
// ============================================================================

const bot = createBot(token);

// Log startup info
console.log("🌿 Green Goods Telegram Bot");
console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
console.log(`   Database: ${process.env.DB_PATH || "data/bot.db"}`);

// ============================================================================
// LAUNCH
// ============================================================================

bot.launch(() => {
  console.log("✅ Bot is running!");
  console.log("   Press Ctrl+C to stop.\n");
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

/**
 * Handles graceful shutdown on process termination signals.
 * Ensures all services are properly cleaned up.
 */
function shutdown(signal: string): void {
  console.log(`\n📴 Received ${signal}, shutting down gracefully...`);

  // Stop bot
  bot.stop(signal);

  // Clean up services
  rateLimiter.destroy();
  verificationService.clearCache();
  storage.close();

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
