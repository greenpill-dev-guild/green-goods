import { createHmac } from "node:crypto";
import {
  buildPublicFundingAvailabilityKey,
  createProviderProofRegistry,
  PUBLIC_AGENT_ROUTES,
  type CreateFundingIntentRequest,
} from "@green-goods/shared/public-contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, hasReceiptTokenBody, type ThirdwebCheckoutClient } from "../api/server";
import {
  InMemoryPublicRateLimiter,
  publicRateLimitKey,
  derivePublicClientIp,
} from "../api/public-protection";
import type { FundingConfirmationResult, TransactionConfirmation } from "../services/blockchain";
import { type FundingIntentRecord, MemoryFundingIntentStore } from "../services/funding-intents";

const ORIGIN = "https://greengoods.app";
const gardenId = "0x1111111111111111111111111111111111111111";
const destinationAddress = "0x2222222222222222222222222222222222222222";
const token = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const availabilityInput = {
  gardenKey: gardenId,
  destinationType: "cookieJar" as const,
  destinationAddress,
  fundingIntent: "donate" as const,
  paymentMethod: "card" as const,
  chainId: 11155111,
  token,
  provider: "thirdweb" as const,
};

const createFundingRequest = (): CreateFundingIntentRequest => ({
  gardenId,
  destinationType: "cookieJar",
  destinationAddress,
  fundingIntent: "donate",
  paymentMethod: "card",
  amountUsd: "25.00",
  chainId: 11155111,
  token,
  availabilityKey: buildPublicFundingAvailabilityKey(availabilityInput),
  clientRequestId: "client-request-1",
  payerEmail: "supporter@example.org",
  locale: "en",
});

function jsonHeaders(extra: Record<string, string> = {}) {
  return {
    origin: ORIGIN,
    "content-type": "application/json",
    ...extra,
  };
}

describe("Hono Agent API compatibility", () => {
  it("serves health and readiness responses", async () => {
    const app = createServer({ isAIReady: () => true }, { logger: false });

    expect((await app.request("/health")).status).toBe(200);
    expect((await app.request("/ready")).status).toBe(200);
  });

  it("does not shadow the runtime Telegram webhook handler", async () => {
    const app = createServer({ isAIReady: () => true }, { logger: false });
    app.post("/webhook/telegram", (c) => c.json({ ok: true, handledBy: "telegram" }));

    const response = await app.request("/webhook/telegram", { method: "POST" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, handledBy: "telegram" });
  });

  it("keeps /api/* bearer auth semantics", async () => {
    const app = createServer({ isAIReady: () => true, botApiToken: "secret" }, { logger: false });
    expect((await app.request("/api/feedback")).status).toBe(401);
    expect(
      (
        await app.request("/api/notify", {
          method: "POST",
          headers: { authorization: "Bearer secret" },
        })
      ).status
    ).toBe(503);
  });
});

describe("public subscription API", () => {
  const importSubscriber = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires consent and a valid email before calling Luma", async () => {
    const app = createServer(
      {
        isAIReady: () => true,
        allowedOrigins: new Set([ORIGIN]),
        lumaClient: { importSubscriber },
      },
      { logger: false }
    );

    const response = await app.request(PUBLIC_AGENT_ROUTES.subscribe, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: "person@example.org", consent: false }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).errorCode).toBe("consent_required");
    expect(importSubscriber).not.toHaveBeenCalled();
  });

  it("returns honest subscribed and already_subscribed states from Luma", async () => {
    importSubscriber
      .mockResolvedValueOnce("subscribed")
      .mockResolvedValueOnce("already_subscribed");
    const app = createServer(
      {
        isAIReady: () => true,
        allowedOrigins: new Set([ORIGIN]),
        lumaClient: { importSubscriber },
      },
      { logger: false }
    );

    const first = await app.request(PUBLIC_AGENT_ROUTES.subscribe, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: "person@example.org", consent: true }),
    });
    const second = await app.request(PUBLIC_AGENT_ROUTES.subscribe, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: "person@example.org", consent: true }),
    });

    expect(await first.json()).toEqual({ ok: true, status: "subscribed" });
    expect(await second.json()).toEqual({ ok: true, status: "already_subscribed" });
  });

  it("does not fake success when Luma is unavailable", async () => {
    const app = createServer(
      { isAIReady: () => true, allowedOrigins: new Set([ORIGIN]) },
      { logger: false }
    );

    const response = await app.request(PUBLIC_AGENT_ROUTES.subscribe, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: "person@example.org", consent: true }),
    });

    expect(response.status).toBe(503);
    expect((await response.json()).errorCode).toBe("luma_import_failed");
  });

  it("rejects oversized subscription payloads before validation", async () => {
    const app = createServer(
      {
        isAIReady: () => true,
        allowedOrigins: new Set([ORIGIN]),
        lumaClient: { importSubscriber },
      },
      { logger: false }
    );

    const response = await app.request(PUBLIC_AGENT_ROUTES.subscribe, {
      method: "POST",
      headers: jsonHeaders({ "content-length": String(20 * 1024) }),
      body: JSON.stringify({ email: "person@example.org", consent: true }),
    });

    expect(response.status).toBe(413);
    expect((await response.json()).errorCode).toBe("invalid_request");
    expect(importSubscriber).not.toHaveBeenCalled();
  });
});

describe("public funding intent API", () => {
  function createFundingApp(now = Date.parse("2026-04-27T12:00:00.000Z")) {
    const store = new MemoryFundingIntentStore();
    const thirdwebCheckout: ThirdwebCheckoutClient = {
      createSession: vi.fn(async ({ fundingIntentId, request, quoteExpiresAt }) => ({
        providerSessionId: `thirdweb_${fundingIntentId}`,
        checkoutSession: {
          provider: "thirdweb" as const,
          mode: "widget" as const,
          expiresAt: quoteExpiresAt,
          clientToken: `checkout_${fundingIntentId}`,
          checkoutPayload: {
            provider: "thirdweb" as const,
            clientId: "thirdweb-client",
            chainId: request.chainId,
            destinationAddress: request.destinationAddress,
            token: request.token,
            amountUsd: request.amountUsd,
            minAssetAmount: "25000000",
            transaction: {
              to: request.destinationAddress,
              data: "0x1234" as `0x${string}`,
              value: "0",
            },
            metadata: {
              gardenId: request.gardenId,
              destinationType: request.destinationType,
              fundingIntent: request.fundingIntent,
            },
          },
        },
        quotedAssetAmount: "25000000",
        minAssetAmount: "25000000",
      })),
    };
    const app = createServer(
      {
        isAIReady: () => true,
        allowedOrigins: new Set([ORIGIN]),
        fundingIntents: store,
        publicRateLimiter: new InMemoryPublicRateLimiter(),
        providerProofRegistry: createProviderProofRegistry([
          {
            ...availabilityInput,
            state: "live",
            proofReference: "spike:cookie-jar-donate-sepolia-2026-04-27",
          },
        ]),
        thirdwebClientId: "thirdweb-client",
        thirdwebCheckout,
        now: () => now,
      },
      { logger: false }
    );
    return { app, store };
  }

  it("keeps unproven card rails unavailable by default", async () => {
    const app = createServer(
      {
        isAIReady: () => true,
        allowedOrigins: new Set([ORIGIN]),
        publicRateLimiter: new InMemoryPublicRateLimiter(),
      },
      { logger: false }
    );

    const response = await app.request(PUBLIC_AGENT_ROUTES.fundingIntents, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(createFundingRequest()),
    });

    expect(response.status).toBe(409);
    expect((await response.json()).errorCode).toBe("funding_unavailable");
  });

  it("does not return a fake checkout session when thirdweb checkout is not configured", async () => {
    const app = createServer(
      {
        isAIReady: () => true,
        allowedOrigins: new Set([ORIGIN]),
        publicRateLimiter: new InMemoryPublicRateLimiter(),
        providerProofRegistry: createProviderProofRegistry([
          {
            ...availabilityInput,
            state: "live",
            proofReference: "spike:cookie-jar-donate-sepolia-2026-04-27",
          },
        ]),
        thirdwebClientId: "thirdweb-client",
      },
      { logger: false }
    );

    const response = await app.request(PUBLIC_AGENT_ROUTES.fundingIntents, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(createFundingRequest()),
    });

    expect(response.status).toBe(503);
    expect((await response.json()).errorCode).toBe("provider_unavailable");
  });

  it("creates a card-only intent with fragment receipt URL and no-store headers", async () => {
    const { app } = createFundingApp();

    const response = await app.request(PUBLIC_AGENT_ROUTES.fundingIntents, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(createFundingRequest()),
    });

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(body.ok).toBe(true);
    expect(body.status).toBe("pending_provider");
    expect(body.receiptUrl).toMatch(/^\/fund\?intent=fi_[a-f0-9]+#receiptToken=/);
    expect(body.publicReceipt.amount.minAssetAmount).toBe("25000000");
    expect(body.checkoutSession.checkoutPayload.minAssetAmount).toBe("25000000");
    expect(body.checkoutSession.checkoutPayload.minAssetAmount).not.toBe(
      createFundingRequest().amountUsd
    );
    expect(body.publicReceipt).not.toHaveProperty("payerEmail");
    expect(JSON.stringify(body)).not.toContain("providerSessionId");
  });

  it("reads receipts only through X-GG-Receipt-Token and rejects query tokens", async () => {
    const { app } = createFundingApp();
    const created = await app.request(PUBLIC_AGENT_ROUTES.fundingIntents, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(createFundingRequest()),
    });
    const createdBody = await created.json();

    const queryToken = await app.request(
      `/public/funding-intents/${createdBody.id}?receiptToken=${createdBody.receiptToken}`,
      { headers: { origin: ORIGIN } }
    );
    expect(queryToken.status).toBe(400);

    const bodyTokenRequest = {
      headers: new Headers({
        "content-type": "application/json",
        "content-length": "25",
      }),
      clone: () => ({
        json: async () => ({ receiptToken: createdBody.receiptToken }),
      }),
    } as unknown as Request;
    expect(await hasReceiptTokenBody(bodyTokenRequest)).toBe(true);

    const missing = await app.request(`/public/funding-intents/${createdBody.id}`, {
      headers: { origin: ORIGIN },
    });
    expect(missing.status).toBe(401);

    const read = await app.request(`/public/funding-intents/${createdBody.id}`, {
      headers: {
        origin: ORIGIN,
        "x-gg-receipt-token": createdBody.receiptToken,
      },
    });
    expect(read.status).toBe(200);
    expect(read.headers.get("cache-control")).toBe("no-store");
    expect((await read.json()).publicReceipt.id).toBe(createdBody.id);
  });

  it("uses clientRequestId idempotency and rejects mismatched retries", async () => {
    const { app } = createFundingApp();
    const request = createFundingRequest();

    const first = await app.request(PUBLIC_AGENT_ROUTES.fundingIntents, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(request),
    });
    const retry = await app.request(PUBLIC_AGENT_ROUTES.fundingIntents, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(request),
    });
    const conflict = await app.request(PUBLIC_AGENT_ROUTES.fundingIntents, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ ...request, amountUsd: "30.00" }),
    });

    expect((await first.json()).id).toBe((await retry.json()).id);
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).errorCode).toBe("idempotency_conflict");
  });
});

describe("thirdweb webhook API and public rate-limit keys", () => {
  const secret = "test-thirdweb-secret";
  const txHash = `0x${"b".repeat(64)}`;

  function signedWebhookRequest(payload: Record<string, unknown>) {
    const body = JSON.stringify(payload);
    return {
      method: "POST",
      headers: { "x-thirdweb-signature": createHmac("sha256", secret).update(body).digest("hex") },
      body,
    };
  }

  function createRecord(overrides: Partial<FundingIntentRecord> = {}): FundingIntentRecord {
    return {
      id: "fi_test",
      gardenId,
      gardenName: gardenId,
      destinationType: "cookieJar",
      destinationAddress: destinationAddress as `0x${string}`,
      fundingIntent: "donate",
      paymentMethod: "card",
      availabilityKey: buildPublicFundingAvailabilityKey(availabilityInput),
      clientRequestId: "webhook-client-request",
      idempotencyFingerprint: "fingerprint",
      amountUsd: "25",
      chainId: 11155111,
      token: token as `0x${string}`,
      provider: "thirdweb",
      providerSessionId: "thirdweb_session",
      status: "pending_provider",
      receiptTokenHash: "hash",
      quoteExpiresAt: "2026-04-27T12:10:00.000Z",
      quotedAssetAmount: "25000000",
      minAssetAmount: "25000000",
      transactionAttempts: [],
      createdAt: "2026-04-27T12:00:00.000Z",
      updatedAt: "2026-04-27T12:00:00.000Z",
      ...overrides,
    };
  }

  it("ignores spoofed proxy headers unless trusted proxy hops are configured", () => {
    const request = new Request("https://api.example/public/subscribe", {
      headers: {
        origin: ORIGIN,
        "x-gg-test-socket-ip": "198.51.100.10",
        "x-forwarded-for": "203.0.113.10, 203.0.113.20",
      },
    });

    expect(derivePublicClientIp(request)).toBe("198.51.100.10");
    expect(derivePublicClientIp(request, { hops: 1 })).toBe("203.0.113.20");
    expect(
      publicRateLimitKey({ route: "subscribe", request, material: "person@example.org" })
    ).not.toContain("person@example.org");
  });

  it("verifies raw body signatures before normalizing thirdweb events", async () => {
    const { app, store } = (() => {
      const funding = new MemoryFundingIntentStore();
      return {
        store: funding,
        app: createServer(
          {
            isAIReady: () => true,
            fundingIntents: funding,
            publicRateLimiter: new InMemoryPublicRateLimiter(),
            thirdwebWebhookSecret: secret,
          },
          { logger: false }
        ),
      };
    })();
    await store.create(createRecord());

    const payload = JSON.stringify({
      id: "evt_1",
      eventType: "transaction_submitted",
      fundingIntentId: "fi_test",
      txHash,
      chainId: 11155111,
      destinationAddress,
      token,
      destinationAmount: "25",
      occurredAt: "2026-04-27T12:05:00.000Z",
    });
    const signature = createHmac("sha256", secret).update(payload).digest("hex");

    const rejected = await app.request(PUBLIC_AGENT_ROUTES.thirdwebWebhook, {
      method: "POST",
      headers: { "x-thirdweb-signature": "bad" },
      body: payload,
    });
    const accepted = await app.request(PUBLIC_AGENT_ROUTES.thirdwebWebhook, {
      method: "POST",
      headers: { "x-thirdweb-signature": signature },
      body: payload,
    });

    expect(rejected.status).toBe(401);
    expect(accepted.status).toBe(200);
    const updated = await store.getById("fi_test");
    expect(updated?.status).toBe("pending_onchain");
    expect(updated?.transactionAttempts[0]?.txHash).toMatch(/^0x/);
  });

  it("rejects oversized thirdweb webhooks before signature verification", async () => {
    const app = createServer(
      {
        isAIReady: () => true,
        publicRateLimiter: new InMemoryPublicRateLimiter(),
        thirdwebWebhookSecret: secret,
      },
      { logger: false }
    );

    const response = await app.request(PUBLIC_AGENT_ROUTES.thirdwebWebhook, {
      method: "POST",
      headers: {
        "content-length": String(300 * 1024),
        "x-thirdweb-signature": "bad",
      },
      body: "{}",
    });

    expect(response.status).toBe(413);
    expect((await response.json()).errorCode).toBe("invalid_request");
  });

  it("requires explicit funding txRole before marking a transaction funded", async () => {
    const store = new MemoryFundingIntentStore();
    const confirmFundingTuple = vi
      .fn<() => Promise<FundingConfirmationResult>>()
      .mockResolvedValue({
        status: "confirmed",
        txHash: txHash as `0x${string}`,
        matchedAssetAmount: "25",
        confirmedAt: "2026-04-27T12:05:00.000Z",
      });
    const confirmFundingTransaction = vi
      .fn<() => Promise<TransactionConfirmation>>()
      .mockResolvedValue({
        status: "confirmed",
        txHash: txHash as `0x${string}`,
        confirmedAt: "2026-04-27T12:05:00.000Z",
      });
    const app = createServer(
      {
        isAIReady: () => true,
        fundingIntents: store,
        publicRateLimiter: new InMemoryPublicRateLimiter(),
        thirdwebWebhookSecret: secret,
        confirmFundingTuple,
        confirmFundingTransaction,
      },
      { logger: false }
    );
    await store.create(createRecord());

    const response = await app.request(
      PUBLIC_AGENT_ROUTES.thirdwebWebhook,
      signedWebhookRequest({
        id: "evt_missing_role",
        eventType: "transaction_submitted",
        fundingIntentId: "fi_test",
        txHash,
        chainId: 11155111,
        destinationAddress,
        token,
        destinationAmount: "25000000",
        occurredAt: "2026-04-27T12:05:00.000Z",
      })
    );

    expect(response.status).toBe(200);
    expect(confirmFundingTuple).not.toHaveBeenCalled();
    expect(confirmFundingTransaction).toHaveBeenCalledWith(txHash);
    const updated = await store.getById("fi_test");
    expect(updated?.status).toBe("pending_onchain");
    expect(updated?.fundingTxHash).toBeUndefined();
  });

  it("maps tuple mismatch to reconciliation_failed without funding the intent", async () => {
    const store = new MemoryFundingIntentStore();
    const confirmFundingTuple = vi
      .fn<() => Promise<FundingConfirmationResult>>()
      .mockResolvedValue({
        status: "tuple_mismatch",
        txHash: txHash as `0x${string}`,
        mismatchReason: "destination_mismatch",
        confirmedAt: "2026-04-27T12:05:00.000Z",
      });
    const app = createServer(
      {
        isAIReady: () => true,
        fundingIntents: store,
        publicRateLimiter: new InMemoryPublicRateLimiter(),
        thirdwebWebhookSecret: secret,
        confirmFundingTuple,
      },
      { logger: false }
    );
    await store.create(createRecord());

    const response = await app.request(
      PUBLIC_AGENT_ROUTES.thirdwebWebhook,
      signedWebhookRequest({
        id: "evt_mismatch",
        eventType: "transaction_submitted",
        txRole: "funding",
        fundingIntentId: "fi_test",
        providerSessionId: "thirdweb_session",
        txHash,
        chainId: 11155111,
        destinationAddress,
        token,
        destinationAmount: "25000000",
        occurredAt: "2026-04-27T12:05:00.000Z",
      })
    );

    expect(response.status).toBe(200);
    const updated = await store.getById("fi_test");
    expect(updated?.status).toBe("failed");
    expect(updated?.failureCode).toBe("reconciliation_failed");
    expect(updated?.fundingTxHash).toBeUndefined();
    expect(updated?.transactionAttempts[0]?.failureCode).toBe("destination_mismatch");
  });

  it("fails strict funding events that do not match the locked provider session", async () => {
    const store = new MemoryFundingIntentStore();
    const confirmFundingTuple = vi.fn<() => Promise<FundingConfirmationResult>>();
    const app = createServer(
      {
        isAIReady: () => true,
        fundingIntents: store,
        publicRateLimiter: new InMemoryPublicRateLimiter(),
        thirdwebWebhookSecret: secret,
        confirmFundingTuple,
      },
      { logger: false }
    );
    await store.create(createRecord());

    const response = await app.request(
      PUBLIC_AGENT_ROUTES.thirdwebWebhook,
      signedWebhookRequest({
        id: "evt_wrong_session",
        eventType: "transaction_submitted",
        txRole: "funding",
        fundingIntentId: "fi_test",
        providerSessionId: "thirdweb_other_session",
        txHash,
        chainId: 11155111,
        destinationAddress,
        token,
        destinationAmount: "25000000",
        occurredAt: "2026-04-27T12:05:00.000Z",
      })
    );

    expect(response.status).toBe(200);
    expect(confirmFundingTuple).not.toHaveBeenCalled();
    const updated = await store.getById("fi_test");
    expect(updated?.status).toBe("failed");
    expect(updated?.failureCode).toBe("reconciliation_failed");
    expect(updated?.fundingTxHash).toBeUndefined();
    expect(updated?.transactionAttempts[0]?.failureCode).toBe("provider_session_mismatch");
  });

  it("keeps expired precedence by moving strict late matches to funded_late", async () => {
    const store = new MemoryFundingIntentStore();
    const confirmFundingTuple = vi
      .fn<() => Promise<FundingConfirmationResult>>()
      .mockResolvedValue({
        status: "confirmed",
        txHash: txHash as `0x${string}`,
        matchedAssetAmount: "25000000",
        confirmedAt: "2026-04-27T12:45:00.000Z",
      });
    const app = createServer(
      {
        isAIReady: () => true,
        fundingIntents: store,
        publicRateLimiter: new InMemoryPublicRateLimiter(),
        thirdwebWebhookSecret: secret,
        confirmFundingTuple,
      },
      { logger: false }
    );
    await store.create(
      createRecord({
        status: "expired",
        failureCode: "expired",
        updatedAt: "2026-04-27T12:31:00.000Z",
      })
    );

    const response = await app.request(
      PUBLIC_AGENT_ROUTES.thirdwebWebhook,
      signedWebhookRequest({
        id: "evt_late",
        eventType: "transaction_submitted",
        txRole: "funding",
        fundingIntentId: "fi_test",
        providerSessionId: "thirdweb_session",
        txHash,
        chainId: 11155111,
        destinationAddress,
        token,
        destinationAmount: "25000000",
        occurredAt: "2026-04-27T12:45:00.000Z",
      })
    );

    expect(response.status).toBe(200);
    const updated = await store.getById("fi_test");
    expect(updated?.status).toBe("funded_late");
    expect(updated?.fundingTxHash).toBe(txHash);
    expect(updated?.fundedAssetAmount).toBe("25000000");
  });
});
