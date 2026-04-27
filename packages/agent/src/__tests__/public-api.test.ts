import { createHmac } from "node:crypto";
import {
  buildPublicFundingAvailabilityKey,
  createProviderProofRegistry,
  PUBLIC_AGENT_ROUTES,
  type CreateFundingIntentRequest,
} from "@green-goods/shared/public-contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../api/server";
import {
  InMemoryPublicRateLimiter,
  publicRateLimitKey,
  derivePublicClientIp,
} from "../api/public-protection";
import { MemoryFundingIntentStore } from "../services/funding-intents";

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
  it("serves health, readiness, and platform webhook allowlist responses", async () => {
    const app = createServer({ isAIReady: () => true }, { logger: false });

    expect((await app.request("/health")).status).toBe(200);
    expect((await app.request("/ready")).status).toBe(200);
    expect((await app.request("/webhook/telegram", { method: "POST" })).status).toBe(200);
    expect((await app.request("/webhook/not-real", { method: "POST" })).status).toBe(400);
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
});

describe("public funding intent API", () => {
  function createFundingApp(now = Date.parse("2026-04-27T12:00:00.000Z")) {
    const store = new MemoryFundingIntentStore();
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
    expect(body.receiptUrl).toMatch(/^\/fund\?intent=fi_[a-f0-9]+#receiptToken=/);
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
    const secret = "test-thirdweb-secret";
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
    const record = {
      id: "fi_test",
      gardenId,
      gardenName: gardenId,
      destinationType: "cookieJar" as const,
      destinationAddress: destinationAddress as `0x${string}`,
      fundingIntent: "donate" as const,
      paymentMethod: "card" as const,
      availabilityKey: buildPublicFundingAvailabilityKey(availabilityInput),
      clientRequestId: "webhook-client-request",
      idempotencyFingerprint: "fingerprint",
      amountUsd: "25",
      chainId: 11155111,
      token: token as `0x${string}`,
      provider: "thirdweb" as const,
      status: "pending_provider" as const,
      receiptTokenHash: "hash",
      quoteExpiresAt: "2026-04-27T12:10:00.000Z",
      transactionAttempts: [],
      createdAt: "2026-04-27T12:00:00.000Z",
      updatedAt: "2026-04-27T12:00:00.000Z",
    };
    await store.create(record);

    const payload = JSON.stringify({
      id: "evt_1",
      eventType: "transaction_submitted",
      fundingIntentId: "fi_test",
      txHash: "0x" + "b".repeat(64),
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
});
