import type {
  createProviderProofRegistry,
  PublicUploadSignRequest,
} from "@green-goods/shared/public-contracts";
import type { Hono } from "hono";
import type { Telegraf } from "telegraf";
import type {
  FundingConfirmationResult,
  FundingTupleExpectation,
  TransactionConfirmation,
} from "../../services/blockchain";
import type { FundingIntentStore } from "../../services/funding-intents";
import type { PinataUploadSignerConfig } from "../../services/pinata-upload-signer";
import type { SubscriptionClient } from "../../services/subscriptions";
import type { InMemoryPublicRateLimiter, TrustedProxyConfig } from "../public-protection";
import type { ThirdwebCheckoutClient } from "../funding/thirdweb";

export interface ServerConfig {
  port: number;
  host?: string;
  logger?: boolean;
}

export interface UploadSigningConfig {
  pinataJwt?: string;
  pinataUploadsApiBaseUrl?: string;
  ttlSeconds?: number;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  rateLimit?: number;
  rateLimitWindowMs?: number;
  fetch?: typeof fetch;
}

export interface ServerDeps {
  isAIReady: () => boolean;
  botApiToken?: string;
  /** Live bot instance for the authenticated attachment proxy. */
  telegramBot?: Telegraf;
  subscriptionClient?: SubscriptionClient;
  fundingIntents?: FundingIntentStore;
  /** Defaults to five minutes; zero disables the abandoned-intent sweep. */
  fundingSweepIntervalMs?: number;
  /** Defaults to 24 hours; zero disables the chat-message sweep. */
  chatMessageSweepIntervalMs?: number;
  /** Defaults to 30 days. */
  chatMessageRetentionMs?: number;
  publicRateLimiter?: InMemoryPublicRateLimiter;
  providerProofRegistry?: ReturnType<typeof createProviderProofRegistry>;
  allowedOrigins?: Set<string>;
  trustedProxy?: TrustedProxyConfig;
  thirdwebWebhookSecret?: string;
  thirdwebClientId?: string;
  thirdwebCheckout?: ThirdwebCheckoutClient;
  uploadSigning?: UploadSigningConfig;
  signPinataUploadUrl?: (
    request: PublicUploadSignRequest,
    config: PinataUploadSignerConfig
  ) => Promise<string>;
  confirmFundingTransaction?: (txHash: string) => Promise<TransactionConfirmation>;
  confirmFundingTuple?: (
    txHash: string,
    expected: FundingTupleExpectation
  ) => Promise<FundingConfirmationResult>;
  readVaultShareBalance?: (params: {
    chainId: number;
    vaultAddress: string;
    ownerAddress: string;
  }) => Promise<bigint>;
  now?: () => number;
}

export type AgentServer = Hono & {
  close: () => Promise<void>;
};
