import type {
  createProviderProofRegistry,
  Address,
  PublicGardenImpactResponseV1,
  PublicCommitmentImpactRecord,
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
import type {
  ProfileAvatarSignatureVerifier,
  ProfileAvatarStore,
} from "../../services/profile-avatars";
import type {
  SavedOfferStore,
  SavedOffersSessionStore,
  SavedOffersSignatureVerifier,
} from "../../services/saved-offers";
import type {
  GardenJoinRequestRateLimitPressure,
  GardenJoinRequestStore,
} from "../../services/garden-join-requests";
import type { GardenJoinRequestChainReader } from "../../services/garden-join-requests-chain";
import type { PasskeyDirectory } from "../../services/passkey-directory";
import type { MessagingRouteDeps } from "../routes/messaging";

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
  publicGardenImpactChainSupported?: (chainId: number) => boolean;
  publicCommitmentImpactLoader?: (chainId: number) => Promise<PublicCommitmentImpactRecord>;
  publicGardenImpactLoader?: (input: {
    chainId: number;
    gardenAddress: Address;
    recentLimit: number;
  }) => Promise<PublicGardenImpactResponseV1>;
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
  profileAvatarStore?: ProfileAvatarStore;
  profileAvatarChainId?: number;
  profileAvatarSignatureVerifier?: ProfileAvatarSignatureVerifier;
  savedOfferStore?: SavedOfferStore;
  savedOffersSessionStore?: SavedOffersSessionStore;
  savedOffersSignatureVerifier?: SavedOffersSignatureVerifier;
  savedOffersAudience?: string;
  savedOffersChainIds?: readonly number[];
  gardenJoinRequestStore?: GardenJoinRequestStore;
  gardenJoinRequestRateLimitPressure?: GardenJoinRequestRateLimitPressure;
  gardenJoinRequestsEnabled?: boolean;
  gardenJoinRequestChainId?: number;
  gardenJoinRequestChainReader?: GardenJoinRequestChainReader;
  gardenJoinRequestSignatureVerifier?: ProfileAvatarSignatureVerifier;
  /** Defaults to 24 hours; zero disables the retention sweep. */
  gardenJoinRequestSweepIntervalMs?: number;
  /** Issues passkeys under one domain for every site; absent unless the directory is enabled. */
  passkeyDirectory?: PasskeyDirectory;
  now?: () => number;
  /** Browser ceremony API for agent reporting; absent unless reporting is configured. */
  messaging?: MessagingRouteDeps;
}

export type AgentServer = Hono & {
  close: () => Promise<void>;
};
