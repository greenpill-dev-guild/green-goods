/**
 * Centralized Configuration
 *
 * All configuration is derived from environment variables.
 * Uses getDefaultChain from shared package for chain configuration.
 */

import { getDefaultChain } from "@green-goods/shared";
import { baseSepolia, arbitrum, celo, base, optimism } from "viem/chains";
import type { Chain } from "viem";

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

    // Environment
    nodeEnv,
    isDevelopment: nodeEnv === "development",
    isProduction: nodeEnv === "production",
  };
}

/**
 * Validate configuration and log warnings
 */
export function validateConfig(config: Config): void {
  const warnings: string[] = [];

  // Check encryption secret
  if (!config.encryptionSecret) {
    warnings.push("ENCRYPTION_SECRET not set. Using derived key from TELEGRAM_BOT_TOKEN.");
  } else if (config.encryptionSecret.length < 32) {
    warnings.push("ENCRYPTION_SECRET should be at least 32 characters.");
  }

  // Check webhook mode requirements
  if (config.mode === "webhook") {
    if (!config.telegramWebhookSecret) {
      warnings.push("TELEGRAM_WEBHOOK_SECRET not set. Webhook requests won't be verified.");
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn("⚠️  Configuration warnings:");
    for (const warning of warnings) {
      console.warn(`   - ${warning}`);
    }
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
