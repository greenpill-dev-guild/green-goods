/**
 * HTTP API Server
 *
 * Hono server for webhooks, health endpoints, and routine-facing API.
 * Designed for multi-platform webhook support.
 *
 * SECURITY: Platform parameters are validated against an allowlist.
 * SECURITY: Routine-facing /api/* routes require Bearer token authentication.
 * SECURITY: Browser upload signing is a limited-public /api exception with
 * origin checks, short TTLs, MIME/size constraints, and rate limiting.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  buildPublicFundingAvailabilityKey,
  type ClientCheckoutSession,
  type CreateFundingIntentRequest,
  createProviderProofRegistry,
  PUBLIC_AGENT_ROUTES,
  type PublicApiError,
  type PublicFundingManagementUrl,
  type PublicFundingSourceRoute,
  type PublicSubscribeRequest,
  type PublicUploadSignRequest,
  publicProviderProofRegistry,
  type ThirdwebNormalizedFundingEvent,
  validatePublicUploadSignRequest,
} from "@green-goods/shared/public-contracts";
import { type Context, Hono, type MiddlewareHandler } from "hono";
import type { Telegraf } from "telegraf";
import {
  confirmFundingTransaction,
  type FundingConfirmationResult,
  type FundingTupleExpectation,
  getTransactionConfirmation,
  type TransactionConfirmation,
} from "../services/blockchain";
import * as db from "../services/db";
import {
  createFundingIntentId,
  createIdempotencyFingerprint,
  createReceiptToken,
  expireIfAbandoned,
  type FundingIntentRecord,
  type FundingIntentStore,
  hashSecret,
  MemoryFundingIntentStore,
  normalizeDecimalString,
  normalizeEmailHash,
  redactFundingReceipt,
  sweepFundingIntents,
  transitionFundingStatus,
} from "../services/funding-intents";
import { loggers } from "../services/logger";
import type { LumaClient } from "../services/luma";
import {
  createPinataSignedUploadUrl,
  DEFAULT_UPLOAD_SIGN_ALLOWED_MIME_TYPES,
  DEFAULT_UPLOAD_SIGN_MAX_FILE_SIZE,
  DEFAULT_UPLOAD_SIGN_TTL_SECONDS,
  normalizeUploadSignerConfig,
  PinataUploadSignerConfigError,
  type PinataUploadSignerConfig,
} from "../services/pinata-upload-signer";
import { captureAgentException } from "../services/sentry";
import type { ChatMessageStatus } from "../types";
import {
  InMemoryPublicRateLimiter,
  isOriginAllowed,
  PUBLIC_RATE_LIMIT_POLICIES,
  parseAllowedOrigins,
  publicRateLimitKey,
  type TrustedProxyConfig,
} from "./public-protection";

const log = loggers.api;

// ============================================================================
// TYPES
// ============================================================================

export interface ServerConfig {
  port: number;
  host?: string;
  logger?: boolean;
}

export interface ServerDeps {
  isAIReady: () => boolean;
  botApiToken?: string;
  /**
   * The live Telegraf instance. Required for the `/api/messages/:id/attachments/:ordinal`
   * proxy, which calls `bot.telegram.getFileLink(file_id)` and returns bytes
   * back without exposing the bot token.
   */
  telegramBot?: Telegraf;
  lumaClient?: LumaClient;
  fundingIntents?: FundingIntentStore;
  /**
   * How often the abandoned-intent sweep runs in ms (defaults to 5 minutes).
   * Set to `0` to disable scheduling — useful in tests where we exercise
   * `sweepFundingIntents` directly.
   */
  fundingSweepIntervalMs?: number;
  /**
   * How often the chat_messages sweep runs in ms (defaults to 24 hours).
   * Set to `0` to disable scheduling — useful in tests.
   */
  chatMessageSweepIntervalMs?: number;
  /**
   * How old a terminal chat_messages row must be before it's pruned (ms).
   * Defaults to 30 days.
   */
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
  /**
   * Strict tuple-matching funding confirmation. When provided, the webhook
   * handler uses this in preference to `confirmFundingTransaction` so success
   * requires that the onchain transfer landed on the locked Garden / token /
   * destination / minimum amount tuple — not just provider success.
   */
  confirmFundingTuple?: (
    txHash: string,
    expected: FundingTupleExpectation
  ) => Promise<FundingConfirmationResult>;
  now?: () => number;
}

export type AgentServer = Hono & {
  close: () => Promise<void>;
};

// ============================================================================
// AUTH MIDDLEWARE
// ============================================================================

const VALID_CHAT_MESSAGE_QUERY_STATUSES = new Set<string>([
  "new",
  "processing",
  "triaged",
  "rejected",
  "all",
]);
const VALID_CHAT_MESSAGE_PATCH_STATUSES = new Set<ChatMessageStatus>([
  "new",
  "processing",
  "triaged",
  "rejected",
]);
const VALID_CAPTURE_TYPES = new Set<string>(["bug", "idea"]);
const MAX_ATTACHMENT_PROXY_BYTES = 25 * 1024 * 1024; // 25MB — Telegram document/video limit for bots
const ATTACHMENT_DOWNLOAD_TIMEOUT_MS = 30_000;
const CHAT_MESSAGE_PROCESSING_LOCK_MS = 6 * 60 * 60 * 1000;

const runningServers = new WeakMap<AgentServer, ReturnType<typeof Bun.serve>>();
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const HEX_RE = /^0x[a-fA-F0-9]+$/;
const PUBLIC_JSON_BODY_LIMIT_BYTES = 16 * 1024;
const WEBHOOK_BODY_LIMIT_BYTES = 256 * 1024;
const UPLOAD_SIGN_BODY_LIMIT_BYTES = 8 * 1024;
const MAX_UPLOAD_SIGN_TTL_SECONDS = 10 * 60;
const MAX_UPLOAD_SIGN_SIZE_BYTES = 100 * 1024 * 1024;
const THIRDWEB_WEBHOOK_TOLERANCE_SECONDS = 300;
const DEFAULT_THIRDWEB_API_BASE_URL = "https://api.thirdweb.com";

type BodyReadResult<T> =
  | { ok: true; value: T | undefined }
  | { ok: false; error: PublicApiError; status: 413 };

export interface ThirdwebCheckoutResult {
  providerSessionId: string;
  providerPaymentId?: string;
  checkoutSession: ClientCheckoutSession;
  checkoutExpiresAt?: string;
  receiverAddress?: CreateFundingIntentRequest["destinationAddress"];
  quotedAssetAmount: string;
  minAssetAmount: string;
}

export interface ThirdwebCheckoutClient {
  createSession(input: {
    fundingIntentId: string;
    request: CreateFundingIntentRequest;
    availabilityProofReference?: string;
    quoteExpiresAt: string;
  }): Promise<ThirdwebCheckoutResult>;
}

export interface ThirdwebCheckoutClientConfig {
  clientId?: string;
  secretKey?: string;
  apiBaseUrl?: string;
  fetch?: typeof fetch;
}

type FundingReceiptUrl = `${PublicFundingSourceRoute}?intent=${string}#receiptToken=${string}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function getNestedString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return stringValue(value);
}

function getThirdwebDestinationAmount(payload: Record<string, unknown>): string | undefined {
  const direct = stringValue(payload.destinationAmount);
  if (direct) return direct;
  const token = isRecord(payload.token) ? payload.token : undefined;
  return stringValue(token?.amount);
}

export function createThirdwebCheckoutClient(
  config: ThirdwebCheckoutClientConfig
): ThirdwebCheckoutClient | undefined {
  const clientId = config.clientId?.trim();
  const secretKey = config.secretKey?.trim();
  if (!clientId || !secretKey) return undefined;

  const apiBaseUrl = (config.apiBaseUrl ?? DEFAULT_THIRDWEB_API_BASE_URL).replace(/\/+$/, "");
  const doFetch = config.fetch ?? fetch;

  return {
    async createSession({ fundingIntentId, request, availabilityProofReference, quoteExpiresAt }) {
      const sourceRoute = getFundingSourceRoute(request);
      if (request.fundingIntent === "endow") {
        throw new Error("Thirdweb Card Endow requires a contract-call checkout integration");
      }
      const requestBody = {
        name: "Green Goods Card Donate",
        description: "Green Goods public funding checkout",
        recipient: request.destinationAddress,
        token: {
          address: request.token,
          chainId: request.chainId,
          amount: request.amountUsd,
        },
        purchaseData: {
          fundingIntentId,
          availabilityProofReference,
          gardenId: request.gardenId,
          destinationType: request.destinationType,
          destinationAddress: request.destinationAddress,
          fundingIntent: request.fundingIntent,
          paymentMethod: request.paymentMethod,
          chainId: request.chainId,
          token: request.token,
          receiverAddress: request.receiverAddress,
          sourceRoute,
          txRole: "funding",
        },
      };

      const response = await doFetch(`${apiBaseUrl}/v1/bridge/payments`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-secret-key": secretKey,
        },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        throw new Error("Thirdweb checkout session creation failed");
      }

      const payload = (await response.json()) as unknown;
      if (!isRecord(payload)) {
        throw new Error("Thirdweb checkout response was invalid");
      }

      const providerSessionId =
        getNestedString(payload, "id") ?? getNestedString(payload, "paymentId");
      const providerPaymentId = getNestedString(payload, "paymentId") ?? providerSessionId;
      const checkoutUrl =
        getNestedString(payload, "checkoutUrl") ?? getNestedString(payload, "url");
      const quotedAssetAmount = getThirdwebDestinationAmount(payload);
      if (
        !providerSessionId ||
        !quotedAssetAmount ||
        parseBaseUnitAmount(quotedAssetAmount) === undefined
      ) {
        throw new Error("Thirdweb checkout response did not include a strict token amount");
      }

      return {
        providerSessionId,
        providerPaymentId,
        checkoutExpiresAt: quoteExpiresAt,
        receiverAddress: request.receiverAddress,
        quotedAssetAmount,
        minAssetAmount: quotedAssetAmount,
        checkoutSession: {
          provider: "thirdweb",
          mode: checkoutUrl ? "hosted" : "widget",
          expiresAt: quoteExpiresAt,
          checkoutUrl,
          checkoutPayload: {
            provider: "thirdweb",
            clientId,
            chainId: request.chainId,
            destinationAddress: request.destinationAddress,
            receiverAddress: request.receiverAddress,
            token: request.token,
            amountUsd: request.amountUsd,
            minAssetAmount: quotedAssetAmount,
            transaction: {
              to: request.destinationAddress,
              data: "0x",
              value: "0",
            },
            metadata: {
              gardenId: request.gardenId,
              destinationType: request.destinationType,
              fundingIntent: request.fundingIntent,
              sourceRoute,
            },
          },
        },
      };
    },
  };
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

function requireApiAuth(deps: ServerDeps): MiddlewareHandler {
  return async (c, next) => {
    if (!deps.botApiToken) {
      return c.json({ error: "API authentication not configured" }, 503);
    }
    const auth = c.req.header("authorization");
    if (!auth || auth !== `Bearer ${deps.botApiToken}`) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  };
}

async function readJsonBody<T>(request: Request): Promise<T | undefined> {
  try {
    return (await request.json()) as T;
  } catch {
    return undefined;
  }
}

async function readBodyWithLimit(
  body: ReadableStream<Uint8Array>,
  maxBytes: number
): Promise<Uint8Array | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("attachment too large").catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

function payloadTooLargeError(maxBytes: number): PublicApiError {
  return safeError("invalid_request", "Request body is too large.", {
    params: { maxBytes },
  });
}

function declaredBodyTooLarge(request: Request, maxBytes: number): boolean {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return false;
  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed > maxBytes;
}

async function readLimitedTextBody(
  request: Request,
  maxBytes: number
): Promise<{ ok: true; text: string } | { ok: false; error: PublicApiError; status: 413 }> {
  if (declaredBodyTooLarge(request, maxBytes)) {
    return { ok: false, error: payloadTooLargeError(maxBytes), status: 413 };
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    return { ok: false, error: payloadTooLargeError(maxBytes), status: 413 };
  }

  return { ok: true, text };
}

async function readLimitedJsonBody<T>(
  request: Request,
  maxBytes = PUBLIC_JSON_BODY_LIMIT_BYTES
): Promise<BodyReadResult<T>> {
  const body = await readLimitedTextBody(request, maxBytes);
  if (!body.ok) return body;

  try {
    return { ok: true, value: JSON.parse(body.text) as T };
  } catch {
    return { ok: true, value: undefined };
  }
}

function safeError(
  errorCode: PublicApiError["errorCode"],
  message: string,
  extra: Omit<PublicApiError, "ok" | "errorCode" | "message"> = {}
): PublicApiError {
  return { ok: false, errorCode, message, ...extra };
}

function isPublicApiError(value: PublicApiError | unknown): value is PublicApiError {
  return typeof value === "object" && value !== null && "ok" in value && value.ok === false;
}

function jsonNoStore(c: Context, body: unknown, status = 200) {
  return c.json(body, status as never, {
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  });
}

function isEmail(value: string | undefined): value is string {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && ADDRESS_RE.test(value);
}

function hasReceiptTokenQuery(request: Request): boolean {
  const url = new URL(request.url);
  return url.searchParams.has("receiptToken");
}

export async function hasReceiptTokenBody(request: Request): Promise<boolean> {
  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = request.headers.get("content-length");
  if (!contentLength && !contentType.toLowerCase().includes("application/json")) return false;

  try {
    const body = (await request.clone().json()) as unknown;
    return Boolean(body && typeof body === "object" && "receiptToken" in body);
  } catch {
    return false;
  }
}

function getAllowedOrigins(deps: ServerDeps): Set<string> {
  return (
    deps.allowedOrigins ??
    parseAllowedOrigins(
      process.env.AGENT_ALLOWED_ORIGINS ?? process.env.AGENT_PUBLIC_ALLOWED_ORIGINS
    )
  );
}

function checkOrigin(c: Context, deps: ServerDeps): PublicApiError | undefined {
  if (isOriginAllowed(c.req.raw, getAllowedOrigins(deps))) return undefined;
  return safeError("origin_not_allowed", "This origin is not allowed.");
}

function checkRateLimit(
  c: Context,
  deps: ServerDeps,
  route: Parameters<typeof publicRateLimitKey>[0]["route"],
  material: string
): PublicApiError | undefined {
  return checkRateLimitWithPolicy(c, deps, route, material, PUBLIC_RATE_LIMIT_POLICIES[route]);
}

function checkRateLimitWithPolicy(
  c: Context,
  deps: ServerDeps,
  route: Parameters<typeof publicRateLimitKey>[0]["route"],
  material: string,
  policy: { limit: number; windowMs: number }
): PublicApiError | undefined {
  const limiter = deps.publicRateLimiter ?? defaultPublicRateLimiter;
  const key = publicRateLimitKey({
    route,
    request: c.req.raw,
    material,
    trustedProxy: deps.trustedProxy,
  });
  const result = limiter.check(key, policy, deps.now?.() ?? Date.now());
  if (result.allowed) return undefined;
  return safeError("rate_limited", "Too many requests. Please try again later.", {
    params: { retryAfterSeconds: result.retryAfterSeconds ?? 60 },
  });
}

function getUploadSigningConfig(deps: ServerDeps) {
  const normalized = normalizeUploadSignerConfig({
    jwt: deps.uploadSigning?.pinataJwt ?? process.env.PINATA_JWT,
    uploadsApiBaseUrl:
      deps.uploadSigning?.pinataUploadsApiBaseUrl ?? process.env.PINATA_UPLOADS_API_URL,
    ttlSeconds: clampPositiveInteger(
      deps.uploadSigning?.ttlSeconds,
      DEFAULT_UPLOAD_SIGN_TTL_SECONDS,
      MAX_UPLOAD_SIGN_TTL_SECONDS
    ),
    maxFileSize: clampPositiveInteger(
      deps.uploadSigning?.maxFileSize,
      DEFAULT_UPLOAD_SIGN_MAX_FILE_SIZE,
      MAX_UPLOAD_SIGN_SIZE_BYTES
    ),
    allowedMimeTypes:
      deps.uploadSigning?.allowedMimeTypes ?? DEFAULT_UPLOAD_SIGN_ALLOWED_MIME_TYPES,
    fetch: deps.uploadSigning?.fetch,
    now: deps.now,
  });

  return normalized;
}

function getUploadSignRateLimitPolicy(deps: ServerDeps) {
  return {
    limit:
      positiveInteger(deps.uploadSigning?.rateLimit) ??
      PUBLIC_RATE_LIMIT_POLICIES.upload_sign.limit,
    windowMs:
      positiveInteger(deps.uploadSigning?.rateLimitWindowMs) ??
      PUBLIC_RATE_LIMIT_POLICIES.upload_sign.windowMs,
  };
}

function clampPositiveInteger(value: number | undefined, fallback: number, max: number): number {
  const parsed = positiveInteger(value) ?? fallback;
  return Math.min(parsed, max);
}

function positiveInteger(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function setUploadCorsHeaders(c: Context, deps: ServerDeps): void {
  const origin = c.req.header("origin");
  if (!origin || !isOriginAllowed(c.req.raw, getAllowedOrigins(deps))) return;

  c.header("Access-Control-Allow-Origin", origin);
  c.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type");
  c.header("Access-Control-Max-Age", "600");
  c.header("Vary", "Origin");
}

function uploadCorsResponse(c: Context, deps: ServerDeps, body: unknown, status = 200) {
  setUploadCorsHeaders(c, deps);
  return jsonNoStore(c, body, status);
}

function validateFundingIntentRequest(body: unknown): CreateFundingIntentRequest | PublicApiError {
  const candidate = body as Partial<CreateFundingIntentRequest> | undefined;
  if (!candidate || typeof candidate !== "object") {
    return safeError("invalid_request", "Invalid request body.");
  }

  if (
    typeof candidate.gardenId !== "string" ||
    typeof candidate.destinationType !== "string" ||
    typeof candidate.destinationAddress !== "string" ||
    typeof candidate.fundingIntent !== "string" ||
    typeof candidate.paymentMethod !== "string" ||
    typeof candidate.amountUsd !== "string" ||
    typeof candidate.token !== "string" ||
    typeof candidate.availabilityKey !== "string" ||
    typeof candidate.clientRequestId !== "string" ||
    typeof candidate.chainId !== "number"
  ) {
    return safeError("invalid_request", "Required funding fields are missing.", {
      fieldErrors: { request: "Required funding fields are missing" },
    });
  }

  if (candidate.paymentMethod !== "card") {
    return safeError("unsupported_payment_method", "Only card funding intents are supported here.");
  }
  if (candidate.destinationType !== "cookieJar" && candidate.destinationType !== "vault") {
    return safeError("invalid_request", "Invalid destination type.");
  }
  if (candidate.fundingIntent !== "donate" && candidate.fundingIntent !== "endow") {
    return safeError("invalid_request", "Invalid funding intent.");
  }
  if (candidate.fundingIntent === "donate" && candidate.destinationType !== "cookieJar") {
    return safeError("invalid_request", "Donate card intents must target a Cookie Jar.");
  }
  if (candidate.fundingIntent === "endow" && candidate.destinationType !== "vault") {
    return safeError("invalid_request", "Endow card intents must target a Vault.");
  }
  if (!isAddress(candidate.destinationAddress)) {
    return safeError("invalid_request", "Invalid destination address.", {
      fieldErrors: { destinationAddress: "Invalid address" },
    });
  }
  if (!isAddress(candidate.token)) {
    return safeError("invalid_request", "Invalid token address.", {
      fieldErrors: { token: "Invalid address" },
    });
  }
  if (candidate.receiverAddress !== undefined && !isAddress(candidate.receiverAddress)) {
    return safeError("invalid_request", "Invalid receiver address.", {
      fieldErrors: { receiverAddress: "Invalid address" },
    });
  }
  if (candidate.fundingIntent === "endow" && !candidate.receiverAddress) {
    return safeError("invalid_request", "Card Endow requires a recovered receiver wallet.", {
      fieldErrors: { receiverAddress: "Receiver wallet is required for Card Endow" },
    });
  }
  if (
    candidate.sourceRoute !== undefined &&
    candidate.sourceRoute !== "/fund" &&
    candidate.sourceRoute !== "/vaults"
  ) {
    return safeError("invalid_request", "Invalid funding source route.", {
      fieldErrors: { sourceRoute: "Invalid source route" },
    });
  }
  if (candidate.sourceRoute === "/vaults" && candidate.destinationType !== "vault") {
    return safeError("invalid_request", "Vault route funding must target a Vault.", {
      fieldErrors: { sourceRoute: "Vault route funding must target a Vault" },
    });
  }

  const amountUsd = normalizeDecimalString(candidate.amountUsd);
  if (!amountUsd) {
    return safeError("invalid_request", "Invalid amount.", {
      fieldErrors: { amountUsd: "Use a positive decimal amount" },
    });
  }
  if (Number(amountUsd) <= 0) {
    return safeError("amount_below_min", "Amount is below the minimum.", {
      fieldErrors: { amountUsd: "Amount must be greater than zero" },
      params: { minAmount: "0.01" },
    });
  }

  return {
    gardenId: candidate.gardenId,
    destinationType: candidate.destinationType,
    destinationAddress: candidate.destinationAddress,
    fundingIntent: candidate.fundingIntent,
    paymentMethod: "card",
    amountUsd,
    chainId: candidate.chainId,
    token: candidate.token,
    availabilityKey: candidate.availabilityKey,
    clientRequestId: candidate.clientRequestId,
    receiverAddress: candidate.receiverAddress,
    sourceRoute: candidate.sourceRoute,
    payerEmail: candidate.payerEmail,
    locale: candidate.locale,
  };
}

function getFundingSourceRoute(
  request: Pick<CreateFundingIntentRequest, "sourceRoute">
): PublicFundingSourceRoute {
  return request.sourceRoute ?? "/fund";
}

function getEndowManagementUrl(sourceRoute: PublicFundingSourceRoute): PublicFundingManagementUrl {
  return sourceRoute === "/vaults" ? "/vaults?manage=positions" : "/fund?manage=endowments";
}

function buildFundingReceiptUrl(
  sourceRoute: PublicFundingSourceRoute,
  intentId: string,
  receiptToken: string
): FundingReceiptUrl {
  return `${sourceRoute}?intent=${intentId}#receiptToken=${receiptToken}` as FundingReceiptUrl;
}

function createFundingIntentRecord(input: {
  id: string;
  request: CreateFundingIntentRequest;
  idempotencyFingerprint: string;
  receiptTokenHash: string;
  checkout: ThirdwebCheckoutResult;
  now: number;
}): FundingIntentRecord {
  const nowIso = new Date(input.now).toISOString();
  const quoteExpiresAt = new Date(input.now + 10 * 60 * 1000).toISOString();
  const sourceRoute = getFundingSourceRoute(input.request);

  return {
    id: input.id,
    gardenId: input.request.gardenId.trim(),
    gardenName: input.request.gardenId.trim(),
    destinationType: input.request.destinationType,
    destinationAddress: input.request.destinationAddress,
    fundingIntent: input.request.fundingIntent,
    paymentMethod: input.request.paymentMethod,
    availabilityKey: input.request.availabilityKey,
    clientRequestId: input.request.clientRequestId.trim(),
    idempotencyFingerprint: input.idempotencyFingerprint,
    amountUsd: input.request.amountUsd,
    chainId: input.request.chainId,
    token: input.request.token,
    provider: "thirdweb",
    providerSessionId: input.checkout.providerSessionId,
    providerPaymentId: input.checkout.providerPaymentId,
    status: "pending_provider",
    payerEmailHash: normalizeEmailHash(input.request.payerEmail),
    receiptTokenHash: input.receiptTokenHash,
    quoteExpiresAt,
    checkoutExpiresAt: input.checkout.checkoutExpiresAt ?? input.checkout.checkoutSession.expiresAt,
    receiverAddress: input.request.receiverAddress ?? input.checkout.receiverAddress,
    sourceRoute,
    managementUrl:
      input.request.fundingIntent === "endow" ? getEndowManagementUrl(sourceRoute) : undefined,
    quotedAssetAmount: input.checkout.quotedAssetAmount,
    minAssetAmount: input.checkout.minAssetAmount,
    checkoutSession: input.checkout.checkoutSession,
    transactionAttempts: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function parseBaseUnitAmount(value: string | undefined): bigint | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  return BigInt(value);
}

function normalizeAddress(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase();
}

function getStrictFundingEventMismatch(
  event: ThirdwebNormalizedFundingEvent,
  intent: FundingIntentRecord
): string | undefined {
  if (!event.txHash) return "missing_tx_hash";
  if (!event.providerSessionId || event.providerSessionId !== intent.providerSessionId) {
    return "provider_session_mismatch";
  }
  if (intent.sourceRoute && event.sourceRoute !== intent.sourceRoute) {
    return "source_route_mismatch";
  }
  if (event.chainId !== intent.chainId) return "chain_mismatch";
  if (
    (intent.sourceRoute === "/vaults" || intent.fundingIntent === "endow") &&
    event.destinationType !== intent.destinationType
  ) {
    return "destination_type_mismatch";
  }
  if (
    (intent.sourceRoute === "/vaults" || intent.fundingIntent === "endow") &&
    event.fundingIntent !== intent.fundingIntent
  ) {
    return "intent_mismatch";
  }
  if (
    (intent.sourceRoute === "/vaults" || intent.fundingIntent === "endow") &&
    event.paymentMethod !== intent.paymentMethod
  ) {
    return "payment_method_mismatch";
  }
  if (normalizeAddress(event.token) !== normalizeAddress(intent.token)) return "token_mismatch";
  if (normalizeAddress(event.destinationAddress) !== normalizeAddress(intent.destinationAddress)) {
    return "destination_mismatch";
  }
  if (
    intent.receiverAddress &&
    normalizeAddress(event.receiverAddress) !== normalizeAddress(intent.receiverAddress)
  ) {
    return "receiver_mismatch";
  }

  const eventAmount = parseBaseUnitAmount(event.destinationAmount);
  const expectedAmount = parseBaseUnitAmount(intent.quotedAssetAmount ?? intent.minAssetAmount);
  if (event.destinationAmount && eventAmount === undefined) return "invalid_destination_amount";
  if (expectedAmount !== undefined && eventAmount === undefined) return "amount_mismatch";
  if (eventAmount !== undefined && expectedAmount !== undefined && eventAmount !== expectedAmount) {
    return "amount_mismatch";
  }

  return undefined;
}

function verifyWebhookSignature(
  body: string,
  headers: Headers,
  secret?: string,
  now = Date.now(),
  toleranceSeconds = THIRDWEB_WEBHOOK_TOLERANCE_SECONDS
): boolean {
  if (!secret) return false;

  const signature = headers.get("x-payload-signature") ?? headers.get("x-pay-signature");
  const timestamp = headers.get("x-timestamp") ?? headers.get("x-pay-timestamp");
  if (signature && timestamp) {
    const parsedTimestamp = Number.parseInt(timestamp, 10);
    if (!Number.isFinite(parsedTimestamp)) return false;
    const diff = Math.abs(Math.floor(now / 1000) - parsedTimestamp);
    if (diff > toleranceSeconds) return false;
    return timingSafeHexEqual(
      createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex"),
      signature
    );
  }

  return false;
}

function timingSafeHexEqual(expected: string, actual: string): boolean {
  const normalized = actual.startsWith("sha256=") ? actual.slice("sha256=".length) : actual;
  if (!HEX_RE.test(`0x${normalized}`)) return false;
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(normalized, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalizeThirdwebEvent(payload: unknown): ThirdwebNormalizedFundingEvent | undefined {
  const data = payload as Record<string, unknown>;
  const bridgeData = isRecord(data.data) ? data.data : undefined;
  if (bridgeData && data.type === "pay.onchain-transaction") {
    const purchaseData = isRecord(bridgeData.purchaseData) ? bridgeData.purchaseData : {};
    const destinationToken = isRecord(bridgeData.destinationToken)
      ? bridgeData.destinationToken
      : {};
    const transactions = Array.isArray(bridgeData.transactions) ? bridgeData.transactions : [];
    const destinationChainId =
      typeof destinationToken.chainId === "number" ? destinationToken.chainId : undefined;
    const destinationTransaction = transactions.find(
      (transaction) =>
        isRecord(transaction) &&
        (destinationChainId === undefined || transaction.chainId === destinationChainId) &&
        typeof transaction.transactionHash === "string"
    ) as Record<string, unknown> | undefined;
    const status = typeof bridgeData.status === "string" ? bridgeData.status : undefined;
    const eventType: ThirdwebNormalizedFundingEvent["eventType"] =
      status === "COMPLETED"
        ? "transaction_submitted"
        : status === "FAILED" || status === "CANCELLED"
          ? "failed"
          : "payment_submitted";
    const providerEventId =
      stringValue(data.id) ??
      stringValue(bridgeData.transactionId) ??
      stringValue(bridgeData.paymentId);
    if (!providerEventId) return undefined;

    return {
      provider: "thirdweb",
      providerEventId,
      providerSessionId: stringValue(bridgeData.paymentId),
      providerPaymentId: stringValue(bridgeData.paymentId),
      fundingIntentId: stringValue(purchaseData.fundingIntentId),
      destinationType:
        purchaseData.destinationType === "cookieJar" || purchaseData.destinationType === "vault"
          ? purchaseData.destinationType
          : undefined,
      fundingIntent:
        purchaseData.fundingIntent === "donate" || purchaseData.fundingIntent === "endow"
          ? purchaseData.fundingIntent
          : undefined,
      paymentMethod:
        purchaseData.paymentMethod === "card" || purchaseData.paymentMethod === "wallet"
          ? purchaseData.paymentMethod
          : undefined,
      sourceRoute:
        purchaseData.sourceRoute === "/fund" || purchaseData.sourceRoute === "/vaults"
          ? purchaseData.sourceRoute
          : undefined,
      eventType,
      txRole:
        typeof purchaseData.txRole === "string"
          ? (purchaseData.txRole as ThirdwebNormalizedFundingEvent["txRole"])
          : undefined,
      txHash: stringValue(destinationTransaction?.transactionHash),
      chainId: destinationChainId,
      destinationAddress:
        typeof purchaseData.destinationAddress === "string" &&
        isAddress(purchaseData.destinationAddress)
          ? purchaseData.destinationAddress
          : typeof bridgeData.receiver === "string" && isAddress(bridgeData.receiver)
            ? bridgeData.receiver
            : undefined,
      receiverAddress:
        typeof purchaseData.receiverAddress === "string" && isAddress(purchaseData.receiverAddress)
          ? purchaseData.receiverAddress
          : undefined,
      token:
        typeof destinationToken.address === "string" && isAddress(destinationToken.address)
          ? destinationToken.address
          : undefined,
      destinationAmount: stringValue(bridgeData.destinationAmount),
      occurredAt: String(bridgeData.updatedAt ?? bridgeData.createdAt ?? new Date().toISOString()),
    };
  }

  const providerEventId = data.id ?? data.eventId ?? data.providerEventId;
  const eventType = data.eventType ?? data.type;
  const occurredAt = data.occurredAt ?? data.createdAt ?? new Date().toISOString();
  if (typeof providerEventId !== "string" || typeof eventType !== "string") return undefined;

  const allowedEvents = new Set<ThirdwebNormalizedFundingEvent["eventType"]>([
    "session_created",
    "payment_submitted",
    "transaction_submitted",
    "failed",
    "refunded",
  ]);
  if (!allowedEvents.has(eventType as ThirdwebNormalizedFundingEvent["eventType"])) {
    return undefined;
  }

  return {
    provider: "thirdweb",
    providerEventId,
    providerSessionId:
      typeof data.providerSessionId === "string" ? data.providerSessionId : undefined,
    providerPaymentId:
      typeof data.providerPaymentId === "string" ? data.providerPaymentId : undefined,
    fundingIntentId: typeof data.fundingIntentId === "string" ? data.fundingIntentId : undefined,
    destinationType:
      data.destinationType === "cookieJar" || data.destinationType === "vault"
        ? data.destinationType
        : undefined,
    fundingIntent:
      data.fundingIntent === "donate" || data.fundingIntent === "endow"
        ? data.fundingIntent
        : undefined,
    paymentMethod:
      data.paymentMethod === "card" || data.paymentMethod === "wallet"
        ? data.paymentMethod
        : undefined,
    sourceRoute:
      data.sourceRoute === "/fund" || data.sourceRoute === "/vaults" ? data.sourceRoute : undefined,
    eventType: eventType as ThirdwebNormalizedFundingEvent["eventType"],
    txRole:
      typeof data.txRole === "string"
        ? (data.txRole as ThirdwebNormalizedFundingEvent["txRole"])
        : undefined,
    txHash: typeof data.txHash === "string" ? data.txHash : undefined,
    chainId: typeof data.chainId === "number" ? data.chainId : undefined,
    destinationAddress:
      typeof data.destinationAddress === "string" && isAddress(data.destinationAddress)
        ? data.destinationAddress
        : undefined,
    receiverAddress:
      typeof data.receiverAddress === "string" && isAddress(data.receiverAddress)
        ? data.receiverAddress
        : undefined,
    token: typeof data.token === "string" && isAddress(data.token) ? data.token : undefined,
    destinationAmount:
      typeof data.destinationAmount === "string" ? data.destinationAmount : undefined,
    occurredAt: String(occurredAt),
  };
}

async function confirmSubmittedTransaction(
  deps: ServerDeps,
  txHash: string | undefined
): Promise<TransactionConfirmation | undefined> {
  if (!txHash) return undefined;
  if (deps.confirmFundingTransaction) return deps.confirmFundingTransaction(txHash);

  try {
    return await getTransactionConfirmation(txHash as `0x${string}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn({ txHash, error: message }, "Funding transaction confirmation unavailable");
    return { status: "pending", txHash: txHash as `0x${string}` };
  }
}

/**
 * Verify a provider-submitted transaction lands on the locked Garden /
 * destination / token / minAssetAmount tuple before declaring `funded`.
 *
 * Returns:
 *   - `confirmed`: receipt success AND ERC-20 Transfer to destination with
 *     value >= minAssetAmount on the expected token + chain.
 *   - `failed`: receipt failure (gas/exec revert).
 *   - `tuple_mismatch`: receipt success but the locked tuple did not match.
 *     Callers map this to `failed` with `failureReason:
 *     "reconciliation_failed"`.
 *   - `pending`: receipt not found yet.
 */
async function confirmFundingTupleSafe(
  deps: ServerDeps,
  txHash: string | undefined,
  expected: FundingTupleExpectation
): Promise<FundingConfirmationResult | undefined> {
  if (!txHash) return undefined;
  if (deps.confirmFundingTuple) return deps.confirmFundingTuple(txHash, expected);

  try {
    return await confirmFundingTransaction(txHash as `0x${string}`, expected);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn({ txHash, error: message }, "Funding tuple confirmation unavailable");
    return { status: "pending", txHash: txHash as `0x${string}` };
  }
}

const defaultPublicRateLimiter = new InMemoryPublicRateLimiter();

// ============================================================================
// SERVER
// ============================================================================

/**
 * Create and configure the Hono server.
 */
export function createServer(deps: ServerDeps, _config?: Partial<ServerConfig>): AgentServer {
  const app = new Hono() as AgentServer;

  app.onError((err, c) => {
    log.error({ err, route: c.req.path, method: c.req.method }, "Unhandled API error");
    captureAgentException(err, {
      source: "hono.onError",
      surface: "api",
      route: c.req.path,
      method: c.req.method,
      status: 500,
    });
    return c.json({ error: "Internal server error" }, 500);
  });

  const fundingIntents = deps.fundingIntents ?? new MemoryFundingIntentStore();
  const providerProofRegistry = deps.providerProofRegistry ?? publicProviderProofRegistry;

  // Scheduled abandoned-intent sweep. Read-time reconciliation in
  // `expireIfAbandoned` handles visitors who return; the sweep is the safety
  // net for visitors who never come back. Default 5 minutes; set to 0 to
  // disable (tests that exercise the sweep directly).
  const sweepIntervalMs =
    deps.fundingSweepIntervalMs === undefined ? 5 * 60 * 1000 : deps.fundingSweepIntervalMs;
  let sweepTimer: ReturnType<typeof setInterval> | null = null;
  if (sweepIntervalMs > 0) {
    sweepTimer = setInterval(() => {
      void sweepFundingIntents(fundingIntents, deps.now ?? Date.now).catch((err) => {
        log.warn({ err }, "Scheduled funding intent sweep failed");
      });
    }, sweepIntervalMs);
    if (typeof sweepTimer === "object" && sweepTimer && "unref" in sweepTimer) {
      (sweepTimer as { unref?: () => void }).unref?.();
    }
  }

  // Scheduled chat_messages sweep — prunes triaged/rejected rows older than
  // the retention window (default 30 days). Stale `new` / `processing` rows
  // are surfaced via a log line so routine outages or crashed claims stay visible.
  const chatSweepIntervalMs =
    deps.chatMessageSweepIntervalMs === undefined
      ? 24 * 60 * 60 * 1000
      : deps.chatMessageSweepIntervalMs;
  const chatRetentionMs =
    deps.chatMessageRetentionMs === undefined
      ? 30 * 24 * 60 * 60 * 1000
      : deps.chatMessageRetentionMs;
  let chatSweepTimer: ReturnType<typeof setInterval> | null = null;
  if (chatSweepIntervalMs > 0) {
    chatSweepTimer = setInterval(() => {
      const cutoff = (deps.now?.() ?? Date.now()) - chatRetentionMs;
      void db
        .sweepStaleChatMessages(cutoff)
        .then((result) => {
          if (result.pruned > 0 || result.staleNew > 0 || result.staleProcessing > 0) {
            log.info(result, "chat_messages sweep complete");
          }
        })
        .catch((err) => {
          log.warn({ err }, "Scheduled chat_messages sweep failed");
        });
    }, chatSweepIntervalMs);
    if (typeof chatSweepTimer === "object" && chatSweepTimer && "unref" in chatSweepTimer) {
      (chatSweepTimer as { unref?: () => void }).unref?.();
    }
  }

  app.close = async () => {
    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
    if (chatSweepTimer) {
      clearInterval(chatSweepTimer);
      chatSweepTimer = null;
    }
    const server = runningServers.get(app);
    if (server) {
      server.stop(true);
      runningServers.delete(app);
    }
  };

  // Health endpoints
  app.get("/health", (c) =>
    c.json({
      status: "ok",
      timestamp: Date.now(),
      uptime: process.uptime(),
      services: {
        ai: deps.isAIReady() ? "ready" : "loading",
      },
    })
  );

  app.get("/ready", (c) => {
    if (!deps.isAIReady()) {
      return c.json(
        {
          status: "not_ready",
          message: "AI model is still loading",
        },
        503
      );
    }
    return c.json({ status: "ready", timestamp: Date.now() });
  });

  app.options(PUBLIC_AGENT_ROUTES.uploadSign, (c) => {
    const originError = checkOrigin(c, deps);
    if (originError) return uploadCorsResponse(c, deps, originError, 403);
    setUploadCorsHeaders(c, deps);
    return c.body(null, 204);
  });

  app.post(PUBLIC_AGENT_ROUTES.uploadSign, async (c) => {
    const originError = checkOrigin(c, deps);
    if (originError) return uploadCorsResponse(c, deps, originError, 403);

    const config = getUploadSigningConfig(deps);
    if (!config.jwt) {
      return uploadCorsResponse(
        c,
        deps,
        safeError("provider_unavailable", "Upload signing is unavailable right now."),
        503
      );
    }

    const bodyResult = await readLimitedJsonBody<unknown>(c.req.raw, UPLOAD_SIGN_BODY_LIMIT_BYTES);
    if (!bodyResult.ok) return uploadCorsResponse(c, deps, bodyResult.error, bodyResult.status);

    const validation = validatePublicUploadSignRequest(bodyResult.value, {
      allowedMimeTypes: config.allowedMimeTypes,
      maxFileSize: config.maxFileSize,
      isAddress,
    });
    if (!validation.ok) return uploadCorsResponse(c, deps, validation.error, 400);
    const { request } = validation;

    const rateError = checkRateLimitWithPolicy(
      c,
      deps,
      "upload_sign",
      [request.category ?? "file_upload", request.mimeType].join(":"),
      getUploadSignRateLimitPolicy(deps)
    );
    if (rateError) return uploadCorsResponse(c, deps, rateError, 429);

    try {
      const signUpload = deps.signPinataUploadUrl ?? createPinataSignedUploadUrl;
      const url = await signUpload(request, {
        jwt: config.jwt,
        uploadsApiBaseUrl: config.uploadsApiBaseUrl,
        ttlSeconds: config.ttlSeconds,
        maxFileSize: config.maxFileSize,
        allowedMimeTypes: config.allowedMimeTypes,
        fetch: config.fetch,
        now: config.now,
      });

      return uploadCorsResponse(c, deps, {
        ok: true,
        url,
        expiresAt: Math.floor(config.now() / 1000) + config.ttlSeconds,
        maxFileSize: config.maxFileSize,
        allowedMimeTypes: config.allowedMimeTypes,
      });
    } catch (error) {
      if (!(error instanceof PinataUploadSignerConfigError)) {
        log.warn({ err: error }, "Pinata upload signing failed");
      }
      return uploadCorsResponse(
        c,
        deps,
        safeError("provider_unavailable", "Upload signing is unavailable right now."),
        503
      );
    }
  });

  // ==========================================================================
  // ROUTINE-FACING API (/api/*)
  // ==========================================================================

  const authHook = requireApiAuth(deps);

  // GET /api/messages — read captured topic messages for routine consumption.
  //
  // Returns rows with embedded attachment metadata. Each attachment carries a
  // same-origin `downloadUrl` pointing at the proxy endpoint below, so the
  // routine can download bytes back without ever seeing the bot token.
  app.get("/api/messages", authHook, async (c) => {
    const chatId = c.req.query("chat_id");
    const threadId = c.req.query("thread_id");
    const status = c.req.query("status");
    const since = c.req.query("since");
    const inferredType = c.req.query("inferred_type");
    const limit = c.req.query("limit");

    if (status && !VALID_CHAT_MESSAGE_QUERY_STATUSES.has(status)) {
      return c.json(
        {
          error: `Invalid status. Must be one of: ${[...VALID_CHAT_MESSAGE_QUERY_STATUSES].join(", ")}`,
        },
        400
      );
    }

    if (inferredType && !VALID_CAPTURE_TYPES.has(inferredType)) {
      return c.json(
        {
          error: `Invalid inferred_type. Must be one of: ${[...VALID_CAPTURE_TYPES].join(", ")}`,
        },
        400
      );
    }

    const parsedSince = since ? parseInt(since, 10) : undefined;
    const sinceMs =
      parsedSince !== undefined && !Number.isNaN(parsedSince) ? parsedSince : undefined;

    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const limitValue =
      parsedLimit !== undefined && !Number.isNaN(parsedLimit) ? parsedLimit : undefined;

    const messages = await db.getNewChatMessages({
      chatId: chatId || undefined,
      threadId: threadId || undefined,
      status: status === "all" ? "all" : ((status as ChatMessageStatus | undefined) ?? "new"),
      since: sinceMs,
      inferredType: inferredType
        ? (inferredType as Parameters<typeof db.getNewChatMessages>[0]["inferredType"])
        : undefined,
      limit: limitValue,
    });

    const enriched = messages.map((message) => ({
      ...message,
      attachments: (message.attachments ?? []).map((attachment) => ({
        ordinal: attachment.ordinal,
        kind: attachment.kind,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
        duration: attachment.duration,
        width: attachment.width,
        height: attachment.height,
        downloadUrl: `/api/messages/${message.id}/attachments/${attachment.ordinal}`,
      })),
    }));

    return c.json({
      messages: enriched,
      count: enriched.length,
    });
  });

  // PATCH /api/messages/:id — claim or update captured-message status.
  // `processing` is an atomic claim from `new` (or stale processing); final
  // statuses are `triaged` / `rejected`. `new` is only for explicit recovery.
  app.patch("/api/messages/:id", authHook, async (c) => {
    const id = c.req.param("id");
    const body = await readJsonBody<{ status?: string }>(c.req.raw);
    const status = body?.status;

    if (!status || !VALID_CHAT_MESSAGE_PATCH_STATUSES.has(status as ChatMessageStatus)) {
      return c.json(
        {
          error: `Invalid status. Must be one of: ${[...VALID_CHAT_MESSAGE_PATCH_STATUSES].join(", ")}`,
        },
        400
      );
    }

    const existing = await db.getChatMessage(id);
    if (!existing) {
      return c.json({ error: "Chat message not found" }, 404);
    }

    if (status === "processing") {
      const now = deps.now?.() ?? Date.now();
      const claimed = await db.claimChatMessage(id, now - CHAT_MESSAGE_PROCESSING_LOCK_MS, now);
      if (!claimed) {
        return c.json({ error: "Chat message already claimed", status: existing.status }, 409);
      }
      return c.json({ ok: true, status: "processing" });
    }

    if (status === "new" && existing.status !== "processing") {
      return c.json(
        { error: "Only processing messages can be returned to new", status: existing.status },
        409
      );
    }

    await db.updateChatMessageStatus(id, status as ChatMessageStatus);
    return c.json({ ok: true });
  });

  // GET /api/messages/:id/attachments/:ordinal — proxy media bytes from
  // Telegram. We never redirect (the redirect URL contains the bot token);
  // we download the body server-side with a hard byte limit and forward only
  // safe response headers.
  app.get("/api/messages/:id/attachments/:ordinal", authHook, async (c) => {
    if (!deps.telegramBot) {
      return c.json({ error: "Telegram bot not available" }, 503);
    }

    const id = c.req.param("id");
    const ordinalRaw = c.req.param("ordinal");
    const ordinal = parseInt(ordinalRaw, 10);
    if (Number.isNaN(ordinal) || ordinal < 0) {
      return c.json({ error: "Invalid ordinal" }, 400);
    }

    const attachment = await db.getChatMessageAttachment(id, ordinal);
    if (!attachment) {
      return c.json({ error: "Attachment not found" }, 404);
    }

    let fileLink: URL;
    try {
      fileLink = await deps.telegramBot.telegram.getFileLink(attachment.telegramFileId);
    } catch (error) {
      log.warn(
        { err: error, id, ordinal, telegramFileId: attachment.telegramFileId },
        "Failed to resolve Telegram file link"
      );
      return c.json({ error: "Upstream file unavailable" }, 502);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ATTACHMENT_DOWNLOAD_TIMEOUT_MS);

    try {
      const upstream = await fetch(fileLink.toString(), {
        signal: controller.signal,
        redirect: "manual",
      });
      if (!upstream.ok || !upstream.body) {
        log.warn(
          { id, ordinal, status: upstream.status },
          "Telegram returned non-OK for file download"
        );
        return c.json({ error: "Upstream file unavailable" }, 502);
      }

      const declaredLength = upstream.headers.get("content-length");
      if (declaredLength) {
        const declared = Number(declaredLength);
        if (Number.isFinite(declared) && declared > MAX_ATTACHMENT_PROXY_BYTES) {
          return c.json({ error: "Attachment too large" }, 413);
        }
      }

      const contentType =
        attachment.mimeType ?? upstream.headers.get("content-type") ?? "application/octet-stream";
      const bytes = await readBodyWithLimit(upstream.body, MAX_ATTACHMENT_PROXY_BYTES);
      if (!bytes) {
        return c.json({ error: "Attachment too large" }, 413);
      }

      const headers = new Headers({
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      });
      headers.set("Content-Length", String(bytes.byteLength));

      const responseBody = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(responseBody).set(bytes);
      return new Response(responseBody, { status: 200, headers });
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      log.warn({ err: error, id, ordinal, isAbort }, "Failed to proxy Telegram attachment");
      return c.json({ error: isAbort ? "Upstream timeout" : "Upstream file unavailable" }, 502);
    } finally {
      clearTimeout(timeout);
    }
  });

  // ==========================================================================
  // PUBLIC BROWSER API (/public/*)
  // ==========================================================================

  app.post(PUBLIC_AGENT_ROUTES.subscribe, async (c) => {
    const originError = checkOrigin(c, deps);
    if (originError) return c.json(originError, 403);

    const bodyResult = await readLimitedJsonBody<Partial<PublicSubscribeRequest>>(c.req.raw);
    if (!bodyResult.ok) return c.json(bodyResult.error, bodyResult.status);

    const body = bodyResult.value;
    const email = body?.email?.trim().toLowerCase();
    const rateError = checkRateLimit(c, deps, "subscribe", email ?? "invalid");
    if (rateError) return c.json(rateError, 429);

    if (!isEmail(email)) {
      return c.json(safeError("invalid_email", "Enter a valid email address."), 400);
    }
    if (body?.consent !== true) {
      return c.json(safeError("consent_required", "Consent is required."), 400);
    }
    if (!deps.lumaClient) {
      return c.json(safeError("luma_import_failed", "Subscription is unavailable right now."), 503);
    }

    try {
      const status = await deps.lumaClient.importSubscriber({
        email,
        locale: body.locale,
        source: body.source ?? "unknown",
        consentedAt: new Date(deps.now?.() ?? Date.now()).toISOString(),
      });
      return c.json({ ok: true, status });
    } catch {
      return c.json(safeError("luma_import_failed", "Subscription is unavailable right now."), 503);
    }
  });

  app.post(PUBLIC_AGENT_ROUTES.fundingIntents, async (c) => {
    const originError = checkOrigin(c, deps);
    if (originError) return c.json(originError, 403);

    const bodyResult = await readLimitedJsonBody<unknown>(c.req.raw);
    if (!bodyResult.ok) return c.json(bodyResult.error, bodyResult.status);

    const body = bodyResult.value;
    const request = validateFundingIntentRequest(body);
    if (isPublicApiError(request)) return c.json(request, 400);

    const rateError = checkRateLimit(
      c,
      deps,
      "funding_create",
      [request.gardenId, request.destinationAddress, request.fundingIntent].join(":")
    );
    if (rateError) return c.json(rateError, 429);

    const routeScopedAvailability =
      request.sourceRoute === undefined ? {} : { sourceRoute: request.sourceRoute };
    const expectedAvailabilityKey = buildPublicFundingAvailabilityKey({
      gardenKey: request.gardenId,
      destinationType: request.destinationType,
      destinationAddress: request.destinationAddress,
      fundingIntent: request.fundingIntent,
      paymentMethod: request.paymentMethod,
      chainId: request.chainId,
      token: request.token,
      provider: "thirdweb",
      ...routeScopedAvailability,
    });
    const availability = providerProofRegistry.resolve({
      gardenKey: request.gardenId,
      destinationType: request.destinationType,
      destinationAddress: request.destinationAddress,
      fundingIntent: request.fundingIntent,
      paymentMethod: request.paymentMethod,
      chainId: request.chainId,
      token: request.token,
      provider: "thirdweb",
      ...routeScopedAvailability,
    });
    if (request.availabilityKey !== expectedAvailabilityKey || availability.state !== "live") {
      return c.json(
        safeError("funding_unavailable", "This funding method is not available yet."),
        409
      );
    }
    if (!deps.thirdwebCheckout) {
      return c.json(
        safeError("provider_unavailable", "This funding provider is unavailable right now."),
        503
      );
    }

    const idempotencyFingerprint = createIdempotencyFingerprint(request, "thirdweb");
    if (!idempotencyFingerprint) {
      return c.json(safeError("invalid_request", "Invalid amount."), 400);
    }

    const existing = await fundingIntents.getByClientRequestId(request.clientRequestId);
    const receiptToken = createReceiptToken();
    const receiptTokenHash = hashSecret(receiptToken);

    if (existing) {
      if (existing.idempotencyFingerprint !== idempotencyFingerprint) {
        return c.json(
          safeError("idempotency_conflict", "This client request id was already used."),
          409
        );
      }
      const updated = await fundingIntents.update({
        ...existing,
        receiptTokenHash,
        updatedAt: new Date(deps.now?.() ?? Date.now()).toISOString(),
      });
      return jsonNoStore(c, {
        ok: true,
        id: updated.id,
        status: updated.status,
        provider: "thirdweb",
        checkoutSession: updated.checkoutSession,
        quoteExpiresAt: updated.quoteExpiresAt,
        receiptToken,
        receiptUrl: buildFundingReceiptUrl(
          updated.sourceRoute ?? "/fund",
          updated.id,
          receiptToken
        ),
        publicReceipt: redactFundingReceipt(updated),
      });
    }

    const now = deps.now?.() ?? Date.now();
    const fundingIntentId = createFundingIntentId();
    const quoteExpiresAt = new Date(now + 10 * 60 * 1000).toISOString();
    let checkout: ThirdwebCheckoutResult;
    try {
      checkout = await deps.thirdwebCheckout.createSession({
        fundingIntentId,
        request,
        availabilityProofReference: availability.proofReference,
        quoteExpiresAt,
      });
    } catch {
      return c.json(
        safeError("provider_unavailable", "This funding provider is unavailable right now."),
        503
      );
    }
    if (
      !checkout.providerSessionId ||
      parseBaseUnitAmount(checkout.quotedAssetAmount) === undefined ||
      parseBaseUnitAmount(checkout.minAssetAmount) === undefined
    ) {
      return c.json(
        safeError("provider_unavailable", "This funding provider is unavailable right now."),
        503
      );
    }
    const checkoutReceiverAddress =
      checkout.receiverAddress ?? checkout.checkoutSession.checkoutPayload?.receiverAddress;
    if (
      request.fundingIntent === "endow" &&
      normalizeAddress(checkoutReceiverAddress) !== normalizeAddress(request.receiverAddress)
    ) {
      return c.json(
        safeError("provider_unavailable", "This funding provider is unavailable right now."),
        503
      );
    }

    const record = createFundingIntentRecord({
      id: fundingIntentId,
      request,
      idempotencyFingerprint,
      receiptTokenHash,
      checkout,
      now,
    });
    await fundingIntents.create(record);
    await fundingIntents.appendEvent(
      record.id,
      record.status,
      "funding intent checkout session created"
    );

    return jsonNoStore(c, {
      ok: true,
      id: record.id,
      status: record.status,
      provider: "thirdweb",
      checkoutSession: record.checkoutSession,
      quoteExpiresAt: record.quoteExpiresAt,
      receiptToken,
      receiptUrl: buildFundingReceiptUrl(record.sourceRoute ?? "/fund", record.id, receiptToken),
      publicReceipt: redactFundingReceipt(record),
    });
  });

  app.get("/public/funding-intents/:id", async (c) => {
    const originError = checkOrigin(c, deps);
    if (originError) return c.json(originError, 403);
    if (hasReceiptTokenQuery(c.req.raw) || (await hasReceiptTokenBody(c.req.raw))) {
      return jsonNoStore(
        c,
        safeError("invalid_request", "Receipt tokens must use the header."),
        400
      );
    }

    const id = c.req.param("id");
    const rateError = checkRateLimit(c, deps, "receipt_read", id);
    if (rateError) return jsonNoStore(c, rateError, 429);

    const receiptToken = c.req.header("x-gg-receipt-token");
    if (!receiptToken) {
      return jsonNoStore(c, safeError("receipt_token_required", "Receipt token is required."), 401);
    }

    const record = await fundingIntents.getById(id);
    if (!record || record.receiptTokenHash !== hashSecret(receiptToken)) {
      return jsonNoStore(c, safeError("receipt_token_invalid", "Receipt token is invalid."), 401);
    }

    const reconciled = expireIfAbandoned(record, deps.now?.() ?? Date.now());
    if (reconciled !== record) {
      await fundingIntents.update(reconciled);
      await fundingIntents.appendEvent(reconciled.id, reconciled.status, "expired on receipt read");
    }

    return jsonNoStore(c, { ok: true, publicReceipt: redactFundingReceipt(reconciled) });
  });

  app.post(PUBLIC_AGENT_ROUTES.thirdwebWebhook, async (c) => {
    const preRateError = checkRateLimit(c, deps, "webhook_pre", "thirdweb");
    if (preRateError) return c.json(preRateError, 429);

    const rawBodyResult = await readLimitedTextBody(c.req.raw, WEBHOOK_BODY_LIMIT_BYTES);
    if (!rawBodyResult.ok) return c.json(rawBodyResult.error, rawBodyResult.status);

    const rawBody = rawBodyResult.text;
    const secret = deps.thirdwebWebhookSecret ?? process.env.THIRDWEB_WEBHOOK_SECRET;
    if (!verifyWebhookSignature(rawBody, c.req.raw.headers, secret, deps.now?.() ?? Date.now())) {
      return c.json(safeError("provider_unavailable", "Webhook verification failed."), 401);
    }

    const signature = c.req.header("x-payload-signature") ?? c.req.header("x-pay-signature");
    const postRateError = checkRateLimit(
      c,
      deps,
      "webhook_post",
      c.req.header("x-thirdweb-account") ?? signature ?? "thirdweb"
    );
    if (postRateError) return c.json(postRateError, 429);

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      return c.json(safeError("invalid_request", "Invalid webhook event."), 400);
    }
    const event = normalizeThirdwebEvent(payload);
    if (!event) {
      return c.json(safeError("invalid_request", "Invalid webhook event."), 400);
    }

    if (event.fundingIntentId) {
      const intent = await fundingIntents.getById(event.fundingIntentId);
      if (intent) {
        const isFundingTransaction =
          event.eventType === "transaction_submitted" && event.txRole === "funding";
        const strictEventMismatch = isFundingTransaction
          ? getStrictFundingEventMismatch(event, intent)
          : undefined;

        // Strict tuple match: provider success alone never marks `funded`.
        // The webhook can only flip to `funded` when the onchain receipt
        // contains an ERC-20 Transfer to the locked destination on the locked
        // token + chain with value >= minAssetAmount. Any other case
        // (`tuple_mismatch`) is treated as a reconciliation failure.
        const confirmation =
          event.eventType === "transaction_submitted"
            ? isFundingTransaction
              ? strictEventMismatch
                ? undefined
                : await confirmFundingTupleSafe(deps, event.txHash, {
                    token: intent.token,
                    destinationAddress: intent.destinationAddress,
                    minAssetAmount: intent.minAssetAmount,
                    chainId: intent.chainId,
                  })
              : await confirmSubmittedTransaction(deps, event.txHash)
            : undefined;

        const isStrictConfirmed =
          !strictEventMismatch && confirmation?.status === "confirmed" && isFundingTransaction;

        const nextStatus = isStrictConfirmed
          ? "funded"
          : strictEventMismatch ||
              confirmation?.status === "failed" ||
              confirmation?.status === "tuple_mismatch"
            ? "failed"
            : event.eventType === "transaction_submitted"
              ? "pending_onchain"
              : event.eventType === "failed"
                ? "failed"
                : event.eventType === "refunded"
                  ? "refunded"
                  : "pending_provider";

        const failureCode: FundingIntentRecord["failureCode"] = strictEventMismatch
          ? "reconciliation_failed"
          : confirmation?.status === "tuple_mismatch"
            ? "reconciliation_failed"
            : confirmation?.status === "failed"
              ? "onchain_failed"
              : event.eventType === "failed"
                ? "provider_failed"
                : intent.failureCode;

        const matchedAssetAmount =
          confirmation?.status === "confirmed" && "matchedAssetAmount" in confirmation
            ? confirmation.matchedAssetAmount
            : undefined;

        const updated: FundingIntentRecord = {
          ...intent,
          providerSessionId: strictEventMismatch
            ? intent.providerSessionId
            : (event.providerSessionId ?? intent.providerSessionId),
          providerPaymentId: strictEventMismatch
            ? intent.providerPaymentId
            : (event.providerPaymentId ?? intent.providerPaymentId),
          status: transitionFundingStatus(intent.status, nextStatus),
          failureCode,
          fundedAssetAmount: isStrictConfirmed
            ? (matchedAssetAmount ?? event.destinationAmount ?? intent.fundedAssetAmount)
            : intent.fundedAssetAmount,
          fundingTxHash: isStrictConfirmed && event.txHash ? event.txHash : intent.fundingTxHash,
          transactionAttempts:
            event.txHash && event.eventType === "transaction_submitted"
              ? [
                  ...intent.transactionAttempts,
                  {
                    role: event.txRole ?? "funding",
                    status:
                      confirmation?.status === "confirmed" && !strictEventMismatch
                        ? "confirmed"
                        : strictEventMismatch ||
                            confirmation?.status === "failed" ||
                            confirmation?.status === "tuple_mismatch"
                          ? "failed"
                          : "submitted",
                    txHash: event.txHash,
                    chainId: event.chainId ?? intent.chainId,
                    token: event.token ?? intent.token,
                    destinationAddress: event.destinationAddress ?? intent.destinationAddress,
                    receiverAddress: event.receiverAddress ?? intent.receiverAddress,
                    amount: matchedAssetAmount ?? event.destinationAmount,
                    providerEventId: event.providerEventId,
                    submittedAt: event.occurredAt,
                    confirmedAt:
                      confirmation?.status === "confirmed" ? confirmation.confirmedAt : undefined,
                    failureCode:
                      strictEventMismatch ??
                      (confirmation?.status === "tuple_mismatch"
                        ? confirmation.mismatchReason
                        : confirmation?.status === "failed"
                          ? "onchain_failed"
                          : undefined),
                  },
                ]
              : intent.transactionAttempts,
          updatedAt: confirmation?.confirmedAt ?? event.occurredAt,
        };
        await fundingIntents.update(updated);
        await fundingIntents.appendEvent(
          updated.id,
          updated.status,
          event.providerEventId,
          event.providerEventId
        );
      }
    }

    return c.json({ ok: true });
  });

  return app;
}

/**
 * Start the server with Bun's HTTP runtime.
 */
export async function startServer(app: AgentServer, config: ServerConfig): Promise<void> {
  try {
    const server = Bun.serve({
      port: config.port,
      hostname: config.host || "0.0.0.0",
      fetch: app.fetch,
    });
    runningServers.set(app, server);
    log.info({ port: config.port, host: config.host }, "Server listening");
  } catch (err) {
    log.error({ err }, "Server failed to start");
    throw err;
  }
}
