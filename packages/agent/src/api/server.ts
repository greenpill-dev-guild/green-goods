/**
 * HTTP API Server
 *
 * Hono server for webhooks, health endpoints, and routine-facing API.
 * Designed for multi-platform webhook support.
 *
 * SECURITY: Platform parameters are validated against an allowlist.
 * SECURITY: /api/* routes require Bearer token authentication.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  buildPublicFundingAvailabilityKey,
  type CreateFundingIntentRequest,
  createProviderProofRegistry,
  PUBLIC_AGENT_ROUTES,
  type PublicApiError,
  type PublicSubscribeRequest,
  publicProviderProofRegistry,
  type ThirdwebNormalizedFundingEvent,
} from "@green-goods/shared/public-contracts";
import { type Context, Hono, type MiddlewareHandler } from "hono";
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
import type { FeedbackStatus, FeedbackType, Platform } from "../types";
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
// SECURITY: Platform Allowlist
// ============================================================================

/**
 * Allowed platform identifiers for webhook endpoints.
 * Only these platforms can receive webhooks.
 */
const ALLOWED_PLATFORMS = ["telegram", "whatsapp", "sms", "discord"] as const;
type AllowedPlatform = (typeof ALLOWED_PLATFORMS)[number];

function isAllowedPlatform(platform: string): platform is AllowedPlatform {
  return ALLOWED_PLATFORMS.includes(platform as AllowedPlatform);
}

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
  notifier?: {
    notify: (platform: string, platformId: string, message: string) => Promise<void>;
  };
  lumaClient?: LumaClient;
  fundingIntents?: FundingIntentStore;
  /**
   * How often the abandoned-intent sweep runs in ms (defaults to 5 minutes).
   * Set to `0` to disable scheduling — useful in tests where we exercise
   * `sweepFundingIntents` directly.
   */
  fundingSweepIntervalMs?: number;
  publicRateLimiter?: InMemoryPublicRateLimiter;
  providerProofRegistry?: ReturnType<typeof createProviderProofRegistry>;
  allowedOrigins?: Set<string>;
  trustedProxy?: TrustedProxyConfig;
  thirdwebWebhookSecret?: string;
  thirdwebClientId?: string;
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

const VALID_FEEDBACK_TYPES = new Set<string>(["bug", "idea"]);
const VALID_FEEDBACK_STATUSES = new Set<string>(["triaged", "responded"]);
const VALID_NOTIFY_PLATFORMS = new Set<string>(["telegram", "discord", "whatsapp", "sms"]);

const runningServers = new WeakMap<AgentServer, ReturnType<typeof Bun.serve>>();
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const HEX_RE = /^0x[a-fA-F0-9]+$/;

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

function safeError(
  errorCode: PublicApiError["errorCode"],
  message: string,
  extra: Omit<PublicApiError, "ok" | "errorCode" | "message"> = {}
): PublicApiError {
  return { ok: false, errorCode, message, ...extra };
}

function isPublicApiError(
  value: PublicApiError | CreateFundingIntentRequest
): value is PublicApiError {
  return "ok" in value && value.ok === false;
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

function getAllowedOrigins(deps: ServerDeps): Set<string> {
  return deps.allowedOrigins ?? parseAllowedOrigins(process.env.AGENT_PUBLIC_ALLOWED_ORIGINS);
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
  const limiter = deps.publicRateLimiter ?? defaultPublicRateLimiter;
  const key = publicRateLimitKey({
    route,
    request: c.req.raw,
    material,
    trustedProxy: deps.trustedProxy,
  });
  const result = limiter.check(key, PUBLIC_RATE_LIMIT_POLICIES[route], deps.now?.() ?? Date.now());
  if (result.allowed) return undefined;
  return safeError("rate_limited", "Too many requests. Please try again later.", {
    params: { retryAfterSeconds: result.retryAfterSeconds ?? 60 },
  });
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
    payerEmail: candidate.payerEmail,
    locale: candidate.locale,
  };
}

function createCheckoutSession(
  request: CreateFundingIntentRequest,
  expiresAt: string,
  thirdwebClientId?: string
) {
  if (!thirdwebClientId) return undefined;
  return {
    provider: "thirdweb" as const,
    mode: "widget" as const,
    expiresAt,
    checkoutPayload: {
      provider: "thirdweb" as const,
      clientId: thirdwebClientId,
      chainId: request.chainId,
      destinationAddress: request.destinationAddress,
      token: request.token,
      amountUsd: request.amountUsd,
      minAssetAmount: request.amountUsd,
      transaction: {
        to: request.destinationAddress,
        data: "0x" as `0x${string}`,
        value: "0",
      },
      metadata: {
        gardenId: request.gardenId,
        destinationType: request.destinationType,
        fundingIntent: request.fundingIntent,
      },
    },
  };
}

function createFundingIntentRecord(input: {
  request: CreateFundingIntentRequest;
  idempotencyFingerprint: string;
  receiptTokenHash: string;
  thirdwebClientId?: string;
  now: number;
}): FundingIntentRecord {
  const nowIso = new Date(input.now).toISOString();
  const quoteExpiresAt = new Date(input.now + 10 * 60 * 1000).toISOString();
  const checkoutSession = createCheckoutSession(
    input.request,
    quoteExpiresAt,
    input.thirdwebClientId
  );

  return {
    id: createFundingIntentId(),
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
    status: "started",
    payerEmailHash: normalizeEmailHash(input.request.payerEmail),
    receiptTokenHash: input.receiptTokenHash,
    quoteExpiresAt,
    checkoutExpiresAt: quoteExpiresAt,
    minAssetAmount: input.request.amountUsd,
    checkoutSession,
    transactionAttempts: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function verifyWebhookSignature(
  body: string,
  signature: string | null | undefined,
  secret?: string
): boolean {
  if (!secret || !signature) return false;
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  const normalized = signature.startsWith("sha256=")
    ? signature.slice("sha256=".length)
    : signature;
  if (!HEX_RE.test(`0x${normalized}`)) return false;
  const left = Buffer.from(digest, "hex");
  const right = Buffer.from(normalized, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalizeThirdwebEvent(payload: unknown): ThirdwebNormalizedFundingEvent | undefined {
  const data = payload as Record<string, unknown>;
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

  app.close = async () => {
    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
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

  // Generic webhook endpoint for future platforms.
  // SECURITY: Platform parameter is validated against allowlist.
  app.post("/webhook/:platform", (c) => {
    const platform = c.req.param("platform");

    if (!isAllowedPlatform(platform)) {
      log.warn({ platform }, "Rejected webhook request for unknown platform");
      return c.json({ error: "Invalid platform" }, 400);
    }

    switch (platform) {
      case "telegram":
        // Handled by bot.handleUpdate in main index.ts when webhook mode is active.
        return c.json({ ok: true });

      case "whatsapp":
        return c.json({ error: "WhatsApp webhooks not yet implemented" }, 501);

      case "sms":
        return c.json({ error: "SMS webhooks not yet implemented" }, 501);

      case "discord":
        return c.json({ error: "Discord webhooks not yet implemented" }, 501);
    }
  });

  // ==========================================================================
  // ROUTINE-FACING API (/api/*)
  // ==========================================================================

  const authHook = requireApiAuth(deps);

  // GET /api/feedback - Read new feedback for routine consumption
  app.get("/api/feedback", authHook, async (c) => {
    const since = c.req.query("since");
    const type = c.req.query("type");

    const parsed = since ? parseInt(since, 10) : undefined;
    const sinceMs = parsed !== undefined && !Number.isNaN(parsed) ? parsed : undefined;
    const feedbackType =
      type && VALID_FEEDBACK_TYPES.has(type) ? (type as FeedbackType) : undefined;

    const feedback = await db.getNewFeedback(sinceMs, feedbackType);

    return c.json({
      feedback,
      count: feedback.length,
    });
  });

  // PATCH /api/feedback/:id - Update feedback status
  app.patch("/api/feedback/:id", authHook, async (c) => {
    const id = c.req.param("id");
    const body = await readJsonBody<{ status?: string }>(c.req.raw);
    const status = body?.status;

    if (!status || !VALID_FEEDBACK_STATUSES.has(status)) {
      return c.json(
        {
          error: "Invalid status. Must be one of: triaged, responded",
        },
        400
      );
    }

    const existing = await db.getFeedback(id);
    if (!existing) {
      return c.json({ error: "Feedback not found" }, 404);
    }

    await db.updateFeedbackStatus(id, status as FeedbackStatus);
    return c.json({ ok: true });
  });

  // POST /api/notify - Send a message to a user via the bot
  app.post("/api/notify", authHook, async (c) => {
    if (!deps.notifier) {
      return c.json({ error: "Notifier not available" }, 503);
    }

    const body = await readJsonBody<{
      platform?: string;
      platformId?: string;
      message?: string;
      feedbackId?: string;
    }>(c.req.raw);

    const { platform, platformId, message, feedbackId } = body ?? {};

    if (!platform || !platformId || !message) {
      return c.json({ error: "Required fields: platform, platformId, message" }, 400);
    }

    if (!VALID_NOTIFY_PLATFORMS.has(platform)) {
      return c.json(
        {
          error: `Invalid platform. Must be one of: ${[...VALID_NOTIFY_PLATFORMS].join(", ")}`,
        },
        400
      );
    }

    await deps.notifier.notify(platform as Platform, platformId, message);

    if (feedbackId) {
      const existing = await db.getFeedback(feedbackId);
      if (existing) {
        await db.updateFeedbackStatus(feedbackId, "responded");
      }
    }

    return c.json({ ok: true });
  });

  // ==========================================================================
  // PUBLIC BROWSER API (/public/*)
  // ==========================================================================

  app.post(PUBLIC_AGENT_ROUTES.subscribe, async (c) => {
    const originError = checkOrigin(c, deps);
    if (originError) return c.json(originError, 403);

    const body = await readJsonBody<Partial<PublicSubscribeRequest>>(c.req.raw);
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

    const body = await readJsonBody<unknown>(c.req.raw);
    const request = validateFundingIntentRequest(body);
    if (isPublicApiError(request)) return c.json(request, 400);

    const rateError = checkRateLimit(
      c,
      deps,
      "funding_create",
      [request.gardenId, request.destinationAddress, request.fundingIntent].join(":")
    );
    if (rateError) return c.json(rateError, 429);

    const expectedAvailabilityKey = buildPublicFundingAvailabilityKey({
      gardenKey: request.gardenId,
      destinationType: request.destinationType,
      destinationAddress: request.destinationAddress,
      fundingIntent: request.fundingIntent,
      paymentMethod: request.paymentMethod,
      chainId: request.chainId,
      token: request.token,
      provider: "thirdweb",
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
    });
    if (request.availabilityKey !== expectedAvailabilityKey || availability.state !== "live") {
      return c.json(
        safeError("funding_unavailable", "This funding method is not available yet."),
        409
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
        receiptUrl: `/fund?intent=${updated.id}#receiptToken=${receiptToken}`,
        publicReceipt: redactFundingReceipt(updated),
      });
    }

    const record = createFundingIntentRecord({
      request,
      idempotencyFingerprint,
      receiptTokenHash,
      thirdwebClientId: deps.thirdwebClientId ?? process.env.VITE_THIRDWEB_CLIENT_ID,
      now: deps.now?.() ?? Date.now(),
    });
    await fundingIntents.create(record);
    await fundingIntents.appendEvent(record.id, "started", "funding intent created");

    return jsonNoStore(c, {
      ok: true,
      id: record.id,
      status: record.status,
      provider: "thirdweb",
      checkoutSession: record.checkoutSession,
      quoteExpiresAt: record.quoteExpiresAt,
      receiptToken,
      receiptUrl: `/fund?intent=${record.id}#receiptToken=${receiptToken}`,
      publicReceipt: redactFundingReceipt(record),
    });
  });

  app.get("/public/funding-intents/:id", async (c) => {
    const originError = checkOrigin(c, deps);
    if (originError) return c.json(originError, 403);
    if (hasReceiptTokenQuery(c.req.raw)) {
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

    const rawBody = await c.req.text();
    const signature = c.req.header("x-thirdweb-signature");
    const secret = deps.thirdwebWebhookSecret ?? process.env.THIRDWEB_WEBHOOK_SECRET;
    if (!verifyWebhookSignature(rawBody, signature, secret)) {
      return c.json(safeError("provider_unavailable", "Webhook verification failed."), 401);
    }

    const postRateError = checkRateLimit(
      c,
      deps,
      "webhook_post",
      c.req.header("x-thirdweb-account") ?? signature ?? "thirdweb"
    );
    if (postRateError) return c.json(postRateError, 429);

    const payload = JSON.parse(rawBody) as unknown;
    const event = normalizeThirdwebEvent(payload);
    if (!event) {
      return c.json(safeError("invalid_request", "Invalid webhook event."), 400);
    }

    if (event.fundingIntentId) {
      const intent = await fundingIntents.getById(event.fundingIntentId);
      if (intent) {
        const isFundingTransaction =
          event.eventType === "transaction_submitted" && (event.txRole ?? "funding") === "funding";

        // Strict tuple match: provider success alone never marks `funded`.
        // The webhook can only flip to `funded` when the onchain receipt
        // contains an ERC-20 Transfer to the locked destination on the locked
        // token + chain with value >= minAssetAmount. Any other case
        // (`tuple_mismatch`) is treated as a reconciliation failure.
        const confirmation =
          event.eventType === "transaction_submitted"
            ? isFundingTransaction
              ? await confirmFundingTupleSafe(deps, event.txHash, {
                  token: intent.token,
                  destinationAddress: intent.destinationAddress,
                  minAssetAmount: intent.minAssetAmount,
                  chainId: intent.chainId,
                })
              : await confirmSubmittedTransaction(deps, event.txHash)
            : undefined;

        const isStrictConfirmed = confirmation?.status === "confirmed" && isFundingTransaction;

        const nextStatus = isStrictConfirmed
          ? "funded"
          : confirmation?.status === "failed" || confirmation?.status === "tuple_mismatch"
            ? "failed"
            : event.eventType === "transaction_submitted"
              ? "pending_onchain"
              : event.eventType === "failed"
                ? "failed"
                : event.eventType === "refunded"
                  ? "refunded"
                  : "pending_provider";

        const failureCode: FundingIntentRecord["failureCode"] =
          confirmation?.status === "tuple_mismatch"
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
          providerSessionId: event.providerSessionId ?? intent.providerSessionId,
          providerPaymentId: event.providerPaymentId ?? intent.providerPaymentId,
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
                      confirmation?.status === "confirmed"
                        ? "confirmed"
                        : confirmation?.status === "failed" ||
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
                      confirmation?.status === "tuple_mismatch"
                        ? confirmation.mismatchReason
                        : confirmation?.status === "failed"
                          ? "onchain_failed"
                          : undefined,
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
