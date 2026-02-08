/**
 * Centralized Configuration
 *
 * All configuration is derived from environment variables.
 * Uses getDefaultChain from shared package for chain configuration.
 */

import { getDefaultChain } from "@green-goods/shared";
import type { Chain } from "viem";
import { arbitrum, base, baseSepolia, celo, optimism } from "viem/chains";
import { logger } from "./services/logger";

// Map chain IDs to viem Chain objects
const CHAIN_MAP: Record<number, Chain> = {
  [baseSepolia.id]: baseSepolia,
  [arbitrum.id]: arbitrum,
  [celo.id]: celo,
  [base.id]: base,
  [optimism.id]: optimism,
};

export type BotMode = "polling" | "webhook";

export interface Config {
  // Chain configuration
  chain: Chain;
  chainId: number;

  // Telegram configuration
  telegramToken: string;
  telegramWebhookSecret?: string;

  // Server configuration
  port: number;
  host: string;
  mode: BotMode;

  // Database configuration
  dbPath: string;

  // Security
  encryptionSecret?: string;

  // Analytics
  posthogApiKey?: string;
  posthogHost: string;
  analyticsEnabled: boolean;

  // Environment
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  const nodeEnv = process.env.NODE_ENV || "development";
  const networkConfig = getDefaultChain();
  const chain = CHAIN_MAP[networkConfig.chainId] || baseSepolia;

  // Required: Telegram bot token
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!telegramToken) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");
  }

  // Bot mode defaults to webhook in production, polling in development
  const defaultMode: BotMode = nodeEnv === "production" ? "webhook" : "polling";
  const mode = (process.env.BOT_MODE || defaultMode) as BotMode;

  if (mode !== "polling" && mode !== "webhook") {
    throw new Error(`Invalid BOT_MODE: ${mode}. Must be 'polling' or 'webhook'`);
  }

  // Analytics configuration
  const posthogApiKey = process.env.POSTHOG_AGENT_KEY;
  const analyticsEnabled = process.env.ANALYTICS_ENABLED !== "false" && nodeEnv === "production";

  return {
    // Chain
    chain,
    chainId: chain.id,

    // Telegram
    telegramToken,
    telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,

    // Server
    port: parseInt(process.env.PORT || "3000", 10),
    host: process.env.HOST || "0.0.0.0",
    mode,

    // Database
    dbPath: process.env.DB_PATH || "data/agent.db",

    // Security
    encryptionSecret: process.env.ENCRYPTION_SECRET,

    // Analytics
    posthogApiKey,
    posthogHost: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
    analyticsEnabled,

    // Environment
    nodeEnv,
    isDevelopment: nodeEnv === "development",
    isProduction: nodeEnv === "production",
  };
}

/**
 * Validate configuration and log warnings
 *
 * SECURITY: Enforces critical security requirements in production:
 * - ENCRYPTION_SECRET is required
 * - TELEGRAM_WEBHOOK_SECRET is required in webhook mode
 */
export function validateConfig(config: Config): void {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check encryption secret - REQUIRED in production
  if (!config.encryptionSecret) {
    if (config.isProduction) {
      errors.push(
        "ENCRYPTION_SECRET is required in production. " +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
    } else {
      warnings.push("ENCRYPTION_SECRET not set. Using derived key from TELEGRAM_BOT_TOKEN.");
    }
  } else if (config.encryptionSecret.length < 32) {
    if (config.isProduction) {
      errors.push("ENCRYPTION_SECRET must be at least 32 characters in production.");
    } else {
      warnings.push("ENCRYPTION_SECRET should be at least 32 characters.");
    }
  }

  // Check webhook mode requirements - REQUIRED in production
  if (config.mode === "webhook") {
    if (!config.telegramWebhookSecret) {
      if (config.isProduction) {
        errors.push(
          "TELEGRAM_WEBHOOK_SECRET is required in production webhook mode. " +
            "Without it, anyone can send fake webhook requests and impersonate users."
        );
      } else {
        warnings.push("TELEGRAM_WEBHOOK_SECRET not set. Webhook requests won't be verified.");
      }
    }
  }

  // Check analytics configuration
  if (config.isProduction && !config.posthogApiKey) {
    warnings.push("POSTHOG_AGENT_KEY not set. Analytics will be disabled.");
  }

  // Throw on critical errors in production
  if (errors.length > 0) {
    for (const error of errors) {
      logger.error({ error }, "Configuration error");
    }
    throw new Error(`Configuration errors:\n- ${errors.join("\n- ")}`);
  }

  // Log warnings
  if (warnings.length > 0) {
    for (const warning of warnings) {
      logger.warn({ warning }, "Configuration warning");
    }
  }

  // Log analytics status
  if (config.analyticsEnabled) {
    logger.info("Analytics enabled");
  }
}

// Export singleton config (loaded lazily)
let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig();
    validateConfig(_config);
  }
  return _config;
}
