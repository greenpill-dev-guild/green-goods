/**
 * Centralized Configuration
 *
 * All configuration is derived from environment variables.
 * Uses getDefaultChain from shared package for chain configuration.
 */

import { getDefaultChain } from "@green-goods/shared";
import type { Chain } from "viem";
import { arbitrum, celo, optimism, sepolia } from "viem/chains";
import { logger } from "./services/logger";
import type { CaptureType, TopicAllowlistEntry } from "./types";

// Map chain IDs to viem Chain objects
const CHAIN_MAP: Record<number, Chain> = {
  [sepolia.id]: sepolia,
  [arbitrum.id]: arbitrum,
  [celo.id]: celo,
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
  telegramRuntimeDisabled: boolean;
  captureTopics: TopicAllowlistEntry[];

  // Server configuration
  port: number;
  host: string;
  mode: BotMode;

  // Database configuration
  dbPath: string;

  // Security
  encryptionSecret?: string;

  // API
  botApiToken?: string;
  publicAllowedOrigins?: string;
  trustedProxyHops?: number;
  trustedProxyCidrs?: string;
  uploadSignerTtlSeconds?: number;
  uploadSignerMaxFileSize?: number;
  uploadSignerAllowedMimeTypes?: string[];
  uploadSignerRateLimit?: number;
  uploadSignerRateLimitWindowMs?: number;

  // Public provider integrations
  pinataJwt?: string;
  pinataUploadsApiBaseUrl?: string;
  resendApiKey?: string;
  resendGreenGoodsSegmentId?: string;
  resendGreenGoodsTopicId?: string;
  thirdwebWebhookSecret?: string;
  thirdwebClientId?: string;
  thirdwebSecretKey?: string;

  // Analytics
  posthogApiKey?: string;
  analyticsEnabled: boolean;
  sentryDsn?: string;
  sentryEnabled: boolean;
  sentryTracesSampleRate: number;
  sentryRelease?: string;
  sentryDebug: boolean;

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
  const chain = CHAIN_MAP[networkConfig.chainId] || sepolia;

  const telegramRuntimeDisabled = process.env.AGENT_DISABLE_TELEGRAM_RUNTIME === "true";
  const telegramToken =
    process.env.TELEGRAM_BOT_TOKEN ?? (telegramRuntimeDisabled ? "0:LOCAL-DEV-TOKEN" : undefined);
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
  const sentryDsn = process.env.SENTRY_AGENT_DSN || process.env.SENTRY_DSN;
  const sentryEnabled = process.env.SENTRY_ENABLED !== "false" && nodeEnv === "production";
  const sentryTracesSampleRate = parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.05);
  const sentryRelease =
    process.env.SENTRY_RELEASE ||
    process.env.FLY_MACHINE_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA;

  return {
    // Chain
    chain,
    chainId: chain.id,

    // Telegram
    telegramToken,
    telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    telegramRuntimeDisabled,
    captureTopics: loadCaptureTopicsFromEnv(),

    // Server
    port: parseInt(process.env.PORT || "3000", 10),
    host: process.env.HOST || "0.0.0.0",
    mode,

    // Database
    dbPath: process.env.DB_PATH || "data/agent.db",

    // API
    botApiToken: process.env.BOT_API_TOKEN,
    publicAllowedOrigins:
      process.env.AGENT_ALLOWED_ORIGINS ?? process.env.AGENT_PUBLIC_ALLOWED_ORIGINS,
    trustedProxyHops: process.env.AGENT_TRUSTED_PROXY_HOPS
      ? parseInt(process.env.AGENT_TRUSTED_PROXY_HOPS, 10)
      : undefined,
    trustedProxyCidrs: process.env.AGENT_TRUSTED_PROXY_CIDRS,
    uploadSignerTtlSeconds: parsePositiveInteger(process.env.AGENT_UPLOAD_SIGN_TTL_SECONDS),
    uploadSignerMaxFileSize: parsePositiveInteger(process.env.AGENT_UPLOAD_MAX_FILE_SIZE_BYTES),
    uploadSignerAllowedMimeTypes: parseCsv(process.env.AGENT_UPLOAD_ALLOWED_MIME_TYPES),
    uploadSignerRateLimit: parsePositiveInteger(process.env.AGENT_UPLOAD_SIGN_RATE_LIMIT),
    uploadSignerRateLimitWindowMs: parsePositiveInteger(
      process.env.AGENT_UPLOAD_SIGN_RATE_LIMIT_WINDOW_MS
    ),

    // Public provider integrations
    pinataJwt: process.env.PINATA_JWT,
    pinataUploadsApiBaseUrl: process.env.PINATA_UPLOADS_API_URL,
    resendApiKey: process.env.RESEND_API_KEY,
    resendGreenGoodsSegmentId: process.env.RESEND_GREEN_GOODS_SEGMENT_ID,
    resendGreenGoodsTopicId: process.env.RESEND_GREEN_GOODS_TOPIC_ID,
    thirdwebWebhookSecret: process.env.THIRDWEB_WEBHOOK_SECRET,
    thirdwebClientId: process.env.VITE_THIRDWEB_CLIENT_ID,
    thirdwebSecretKey: process.env.THIRDWEB_SECRET_KEY,

    // Security
    encryptionSecret: process.env.ENCRYPTION_SECRET,

    // Analytics
    posthogApiKey,
    analyticsEnabled,
    sentryDsn,
    sentryEnabled,
    sentryTracesSampleRate,
    sentryRelease,
    sentryDebug: process.env.SENTRY_DEBUG === "true",

    // Environment
    nodeEnv,
    isDevelopment: nodeEnv === "development",
    isProduction: nodeEnv === "production",
  };
}

export const getConfig = loadConfig;

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseSampleRate(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

/**
 * Map of `CaptureType` → env var name. Each env var holds a single topic
 * identifier in `<chat_id>_<thread_id>` form (matching Telegram's deep-link
 * convention), e.g. `-1002847752257_311`. The agent's mapping from env-var
 * name to `inferredType` lives only here.
 *
 * Adding a new topic type is two lines: extend `CaptureType` and add an
 * entry below.
 */
const CAPTURE_TYPE_ENV_VARS: Record<CaptureType, string> = {
  bug: "TELEGRAM_BUGS_TOPIC",
  idea: "TELEGRAM_IDEAS_TOPIC",
};

/**
 * Parse a single topic env var value (`<chat_id>_<thread_id>`) into a
 * `TopicAllowlistEntry`. Returns `undefined` for unset / malformed values
 * with a warn log.
 */
export function parseTopicEnvVar(
  envVar: string,
  rawValue: string | undefined,
  inferredType: CaptureType
): TopicAllowlistEntry | undefined {
  if (!rawValue?.trim()) return undefined;
  const value = rawValue.trim();
  const lastUnderscore = value.lastIndexOf("_");
  if (lastUnderscore <= 0 || lastUnderscore === value.length - 1) {
    logger.warn(
      { envVar, value },
      "Skipping malformed topic env var (expected <chat_id>_<thread_id>)"
    );
    return undefined;
  }
  const chatId = value.slice(0, lastUnderscore);
  const threadId = value.slice(lastUnderscore + 1);
  if (!chatId || !threadId) {
    logger.warn({ envVar, value }, "Skipping topic env var with empty chat_id or thread_id");
    return undefined;
  }
  return { chatId, threadId, inferredType };
}

/**
 * Build the topic allowlist by reading one env var per `CaptureType`.
 * An unset env var disables capture for that type silently — the bot stays
 * silent in groups for messages from that topic even with privacy mode off.
 */
export function loadCaptureTopicsFromEnv(): TopicAllowlistEntry[] {
  const entries: TopicAllowlistEntry[] = [];
  const seen = new Set<string>();

  for (const [type, envVar] of Object.entries(CAPTURE_TYPE_ENV_VARS) as Array<
    [CaptureType, string]
  >) {
    const entry = parseTopicEnvVar(envVar, process.env[envVar], type);
    if (!entry) continue;
    const key = `${entry.chatId}:${entry.threadId}`;
    if (seen.has(key)) {
      logger.warn(
        { envVar, value: process.env[envVar] },
        "Two topic env vars point at the same chat+thread — keeping the first"
      );
      continue;
    }
    seen.add(key);
    entries.push(entry);
  }

  return entries;
}

function parseCsv(value: string | undefined): string[] | undefined {
  const entries = value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries?.length ? entries : undefined;
}
