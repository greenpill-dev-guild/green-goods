import { Database } from "bun:sqlite";
import {
  buildSavedOffersSessionMessage,
  canonicalSavedOfferPayload,
  SAVED_OFFER_MAX_RECORDS_PER_OWNER,
  type SavedOfferPayloadV1,
} from "@green-goods/shared/public-contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { InMemoryPublicRateLimiter } from "../api/public-protection";
import { createServer } from "../api/server";
import {
  createSavedOfferCipher,
  MemorySavedOfferStore,
  MemorySavedOffersSessionStore,
} from "../services/saved-offers";
import {
  compareAndSwapSavedOffer,
  getSavedOffer,
  listSavedOffers,
} from "../services/db/saved-offers";
import { initSchema } from "../services/db/schema";

const ORIGIN = "https://greengoods.app";
const CHAIN_ID = 42161;
const NOW = 1_753_777_600_000;
const AUDIENCE = "agent.greengoods.app";
const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
);
const other = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
);

function payload(overrides: Partial<SavedOfferPayloadV1> = {}): SavedOfferPayloadV1 {
  return {
    schemaVersion: 1,
    savedOfferId: "0191f2a0-1d5e-7c41-8f45-5ee9120ec012",
    title: "Build a rain garden",
    description: "Design and help install one neighborhood rain garden.",
    commitmentKind: "DomainImpact",
    unitLabel: "gardens",
    targetUnits: "1",
    claimMode: "ApprovalGated",
    domainTags: ["water", "soil"],
    requirements: [{ actionId: "12", requiredCount: 1, note: "Share a completion photo" }],
    seriesLinks: [
      {
        chainId: CHAIN_ID,
        moduleAddress: "0x6bb5b0fd70b6771b0e955fef37f8bd2ce911470a",
        poolId: "9",
        commitmentSeriesId: "10",
      },
    ],
    ...overrides,
  };
}

function createApp(options: { verify?: ReturnType<typeof vi.fn> } = {}) {
  const store = new MemorySavedOfferStore(createSavedOfferCipher(KEY));
  const sessions = new MemorySavedOffersSessionStore({ now: () => NOW });
  const verify =
    options.verify ??
    vi.fn(async (input: { address: string; message: string; signature: `0x${string}` }) => {
      const expected =
        input.address.toLowerCase() === account.address.toLowerCase() ? account : other;
      return expected.address.toLowerCase() === input.address.toLowerCase()
        ? expected
            .signMessage({ message: input.message })
            .then((signature) => signature === input.signature)
        : false;
    });
  const app = createServer({
    isAIReady: () => true,
    allowedOrigins: new Set([ORIGIN]),
    publicRateLimiter: new InMemoryPublicRateLimiter(),
    savedOfferStore: store,
    savedOffersSessionStore: sessions,
    savedOffersAudience: AUDIENCE,
    savedOffersChainIds: [CHAIN_ID],
    savedOffersSignatureVerifier: verify,
    now: () => NOW,
  });
  return { app, store, sessions, verify };
}

async function authenticate(
  app: ReturnType<typeof createApp>["app"],
  owner = account,
  overrides: Partial<{ nonce: string; issuedAt: number; signature: `0x${string}` }> = {}
) {
  const challenge = await app.request("/public/saved-offers/session/challenge", {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({ chainId: CHAIN_ID, owner: owner.address }),
  });
  expect(challenge.status).toBe(200);
  const challengeBody = (await challenge.json()) as {
    nonce: string;
    audience: string;
    expiresAt: number;
  };
  const issuedAt = overrides.issuedAt ?? Math.floor(NOW / 1000);
  const nonce = overrides.nonce ?? challengeBody.nonce;
  const message = buildSavedOffersSessionMessage({
    version: 1,
    chainId: CHAIN_ID,
    owner: owner.address,
    nonce,
    audience: AUDIENCE,
    issuedAt,
  });
  const signature = overrides.signature ?? (await owner.signMessage({ message }));
  const session = await app.request("/public/saved-offers/session", {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({ chainId: CHAIN_ID, owner: owner.address, nonce, issuedAt, signature }),
  });
  return { challengeBody, session, nonce, signature };
}

function authHeaders(token: string) {
  return { origin: ORIGIN, authorization: `Bearer ${token}`, "content-type": "application/json" };
}

describe("saved offers public API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("authenticates an owner and rejects nonce replay and expiry", async () => {
    const { app } = createApp();
    const authenticated = await authenticate(app);
    expect(authenticated.session.status).toBe(200);
    const sessionBody = (await authenticated.session.json()) as {
      token: string;
      expiresAt: number;
    };
    expect(sessionBody.token).toHaveLength(64);
    expect(sessionBody.expiresAt).toBe(Math.floor(NOW / 1000) + 15 * 60);

    const replay = await app.request("/public/saved-offers/session", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({
        chainId: CHAIN_ID,
        owner: account.address,
        nonce: authenticated.nonce,
        issuedAt: Math.floor(NOW / 1000),
        signature: authenticated.signature,
      }),
    });
    expect(replay.status).toBe(401);
    expect((await replay.json()).errorCode).toBe("challenge_invalid");

    const expired = await authenticate(app, account, { issuedAt: Math.floor(NOW / 1000) - 301 });
    expect(expired.session.status).toBe(401);
    expect((await expired.session.json()).errorCode).toBe("challenge_expired");
  });

  it("enforces an IP bucket independently of rotating owner addresses", async () => {
    const { app } = createApp();
    const statuses: number[] = [];
    for (let index = 1; index <= 11; index += 1) {
      const owner = `0x${index.toString(16).padStart(40, "0")}`;
      const response = await app.request("/public/saved-offers/session/challenge", {
        method: "POST",
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          "x-gg-test-socket-ip": `198.51.100.${index}`,
        },
        body: JSON.stringify({ chainId: CHAIN_ID, owner }),
      });
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(200));
    expect(statuses[10]).toBe(429);
  });

  it("binds challenges to owner and chain and expires owner sessions after fifteen minutes", async () => {
    let now = NOW;
    const sessions = new MemorySavedOffersSessionStore({ now: () => now });
    const ownerMismatch = await sessions.issueChallenge({
      chainId: CHAIN_ID,
      owner: account.address,
      audience: AUDIENCE,
    });
    await expect(
      sessions.consumeChallenge({
        chainId: CHAIN_ID,
        owner: other.address,
        audience: AUDIENCE,
        nonce: ownerMismatch.nonce,
      })
    ).resolves.toBe("invalid");

    const chainMismatch = await sessions.issueChallenge({
      chainId: CHAIN_ID,
      owner: account.address,
      audience: AUDIENCE,
    });
    await expect(
      sessions.consumeChallenge({
        chainId: 11155111,
        owner: account.address,
        audience: AUDIENCE,
        nonce: chainMismatch.nonce,
      })
    ).resolves.toBe("invalid");

    const session = await sessions.createSession({ chainId: CHAIN_ID, owner: account.address });
    await expect(sessions.authenticate(session.token)).resolves.toMatchObject({
      chainId: CHAIN_ID,
      owner: account.address.toLowerCase(),
    });
    now += 15 * 60 * 1000 + 1_000;
    await expect(sessions.authenticate(session.token)).resolves.toBeUndefined();
  });

  it("uses the shared fail-closed verifier for deployed and counterfactual smart accounts", async () => {
    const verify = vi.fn(async () => true);
    const { app } = createApp({ verify });
    const challenge = await app.request("/public/saved-offers/session/challenge", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ chainId: CHAIN_ID, owner: account.address }),
    });
    const { nonce } = (await challenge.json()) as { nonce: string };
    const deployed = await app.request("/public/saved-offers/session", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({
        chainId: CHAIN_ID,
        owner: account.address,
        nonce,
        issuedAt: Math.floor(NOW / 1000),
        signature: "0x1234",
      }),
    });
    expect(deployed.status).toBe(200);
    expect(verify).toHaveBeenLastCalledWith(expect.objectContaining({ signature: "0x1234" }));

    const nextChallenge = await app.request("/public/saved-offers/session/challenge", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ chainId: CHAIN_ID, owner: account.address }),
    });
    const nextNonce = ((await nextChallenge.json()) as { nonce: string }).nonce;
    const counterfactual = await app.request("/public/saved-offers/session", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({
        chainId: CHAIN_ID,
        owner: account.address,
        nonce: nextNonce,
        issuedAt: Math.floor(NOW / 1000),
        signature: "0x5678",
        factory: "0x1234567890abcdef1234567890abcdef12345678",
        factoryData: "0xabcdef",
      }),
    });
    expect(counterfactual.status).toBe(200);
    expect(verify).toHaveBeenLastCalledWith(
      expect.objectContaining({
        signature: "0x5678",
        factory: "0x1234567890abcdef1234567890abcdef12345678",
        factoryData: "0xabcdef",
      })
    );
  });

  it("rejects malformed signature hex before invoking the verifier", async () => {
    const verify = vi.fn(async () => true);
    const { app } = createApp({ verify });
    const challenge = await app.request("/public/saved-offers/session/challenge", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ chainId: CHAIN_ID, owner: account.address }),
    });
    const { nonce } = (await challenge.json()) as { nonce: string };
    const response = await app.request("/public/saved-offers/session", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({
        chainId: CHAIN_ID,
        owner: account.address,
        nonce,
        issuedAt: Math.floor(NOW / 1000),
        signature: "0x123",
      }),
    });

    expect(response.status).toBe(400);
    expect(verify).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when Saved Offers dependencies are not configured", async () => {
    const app = createServer({
      isAIReady: () => true,
      allowedOrigins: new Set([ORIGIN]),
      publicRateLimiter: new InMemoryPublicRateLimiter(),
      savedOffersChainIds: [CHAIN_ID],
      now: () => NOW,
    });
    const response = await app.request("/public/saved-offers/session/challenge", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ chainId: CHAIN_ID, owner: account.address }),
    });

    expect(response.status).toBe(503);
    expect((await response.json()).errorCode).toBe("provider_unavailable");
  });

  it("lists, reads, updates, and tombstones only the authenticated owner's records", async () => {
    const { app } = createApp();
    const ownerAuth = await authenticate(app);
    const ownerToken = ((await ownerAuth.session.json()) as { token: string }).token;
    const otherAuth = await authenticate(app, other);
    const otherToken = ((await otherAuth.session.json()) as { token: string }).token;
    const offer = payload();

    const created = await app.request(`/public/saved-offers/${offer.savedOfferId}`, {
      method: "PUT",
      headers: authHeaders(ownerToken),
      body: JSON.stringify({ payload: offer, expectedVersion: 0 }),
    });
    expect(created.status).toBe(200);
    expect((await created.json()).record).toMatchObject({ payload: offer, version: 1 });

    const list = await app.request("/public/saved-offers", { headers: authHeaders(ownerToken) });
    expect((await list.json()).records).toHaveLength(1);
    const otherList = await app.request("/public/saved-offers", {
      headers: authHeaders(otherToken),
    });
    expect((await otherList.json()).records).toEqual([]);
    const hidden = await app.request(`/public/saved-offers/${offer.savedOfferId}`, {
      headers: authHeaders(otherToken),
    });
    expect(hidden.status).toBe(404);

    const updatedPayload = payload({ title: "Build two rain gardens" });
    const updated = await app.request(`/public/saved-offers/${offer.savedOfferId}`, {
      method: "PUT",
      headers: authHeaders(ownerToken),
      body: JSON.stringify({ payload: updatedPayload, expectedVersion: 1 }),
    });
    expect((await updated.json()).record).toMatchObject({ payload: updatedPayload, version: 2 });

    const deleted = await app.request(`/public/saved-offers/${offer.savedOfferId}`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
      body: JSON.stringify({ expectedVersion: 2 }),
    });
    expect(deleted.status).toBe(200);
    expect((await deleted.json()).version).toBe(3);
    const missing = await app.request(`/public/saved-offers/${offer.savedOfferId}`, {
      headers: authHeaders(ownerToken),
    });
    expect(missing.status).toBe(404);
    const staleResurrection = await app.request(`/public/saved-offers/${offer.savedOfferId}`, {
      method: "PUT",
      headers: authHeaders(ownerToken),
      body: JSON.stringify({ payload: offer, expectedVersion: 1 }),
    });
    expect(staleResurrection.status).toBe(409);
    expect(await staleResurrection.json()).toMatchObject({
      errorCode: "version_conflict",
      currentVersion: 3,
    });

    const neverExisted = await app.request(
      "/public/saved-offers/0191f2a0-1d5e-7c41-8f45-5ee9120ec077",
      {
        method: "DELETE",
        headers: authHeaders(ownerToken),
        body: JSON.stringify({ expectedVersion: 0 }),
      }
    );
    expect(neverExisted.status).toBe(404);
    expect((await neverExisted.json()).errorCode).toBe("not_found");
  });

  it("rejects noncanonical, conflicting, and oversized payloads", async () => {
    const { app } = createApp();
    const auth = await authenticate(app);
    const token = ((await auth.session.json()) as { token: string }).token;
    const duplicateTags = payload({ domainTags: ["water", "Water"] });
    const invalid = await app.request(`/public/saved-offers/${duplicateTags.savedOfferId}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ payload: duplicateTags, expectedVersion: 0 }),
    });
    expect(invalid.status).toBe(400);

    const mismatched = payload({ savedOfferId: "0191f2a0-1d5e-7c41-8f45-5ee9120ec013" });
    const wrongPath = await app.request(
      "/public/saved-offers/0191f2a0-1d5e-7c41-8f45-5ee9120ec012",
      {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({ payload: mismatched, expectedVersion: 0 }),
      }
    );
    expect(wrongPath.status).toBe(400);

    const oversized = payload({ description: "a".repeat(33 * 1024) });
    const tooLarge = await app.request(`/public/saved-offers/${oversized.savedOfferId}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ payload: oversized, expectedVersion: 0 }),
    });
    expect(tooLarge.status).toBe(413);
  });

  it("encrypts canonical payloads with fresh nonces and persists no plaintext", () => {
    const database = new Database(":memory:");
    initSchema(database);
    const cipher = createSavedOfferCipher(KEY);
    const offer = payload();
    const canonical = canonicalSavedOfferPayload(offer);
    try {
      const first = compareAndSwapSavedOffer(database, cipher, {
        chainId: CHAIN_ID,
        owner: account.address,
        savedOfferId: offer.savedOfferId,
        payload: canonical,
        expectedVersion: 0,
        updatedAt: new Date(NOW).toISOString(),
      });
      expect(first).toMatchObject({ ok: true, record: { payload: offer, version: 1 } });
      const raw = database
        .query("SELECT ciphertext, nonce FROM saved_offers WHERE savedOfferId = ?")
        .get(offer.savedOfferId) as { ciphertext: string; nonce: string };
      expect(raw.ciphertext).not.toContain(offer.title);
      const firstNonce = raw.nonce;
      const second = compareAndSwapSavedOffer(database, cipher, {
        chainId: CHAIN_ID,
        owner: account.address,
        savedOfferId: offer.savedOfferId,
        payload: canonicalSavedOfferPayload(payload({ title: "New title" })),
        expectedVersion: 1,
        updatedAt: new Date(NOW + 1).toISOString(),
      });
      expect(second).toMatchObject({ ok: true, record: { version: 2 } });
      const rawAfter = database
        .query("SELECT ciphertext, nonce FROM saved_offers WHERE savedOfferId = ?")
        .get(offer.savedOfferId) as { ciphertext: string; nonce: string };
      expect(rawAfter.nonce).not.toBe(firstNonce);
      expect(
        getSavedOffer(database, cipher, CHAIN_ID, account.address, offer.savedOfferId)
      ).toMatchObject({
        payload: { title: "New title", seriesLinks: offer.seriesLinks },
        version: 2,
      });
      expect(listSavedOffers(database, cipher, CHAIN_ID, other.address)).toEqual([]);
    } finally {
      database.close();
    }
  });

  it("caps active Saved Offer records per owner without affecting another owner", async () => {
    const store = new MemorySavedOfferStore(createSavedOfferCipher(KEY));
    for (let index = 0; index < SAVED_OFFER_MAX_RECORDS_PER_OWNER; index += 1) {
      const result = await store.compareAndSwap({
        chainId: CHAIN_ID,
        owner: account.address,
        savedOfferId: `offer-${index}`,
        payload: canonicalSavedOfferPayload(payload()),
        expectedVersion: 0,
        updatedAt: new Date(NOW + index).toISOString(),
      });
      expect(result.ok).toBe(true);
    }

    await expect(
      store.compareAndSwap({
        chainId: CHAIN_ID,
        owner: account.address,
        savedOfferId: "offer-over-limit",
        payload: canonicalSavedOfferPayload(payload()),
        expectedVersion: 0,
        updatedAt: new Date(NOW).toISOString(),
      })
    ).resolves.toEqual({ ok: false, currentVersion: 0, reason: "owner_limit_exceeded" });
    await expect(
      store.compareAndSwap({
        chainId: CHAIN_ID,
        owner: other.address,
        savedOfferId: "other-owner-offer",
        payload: canonicalSavedOfferPayload(payload()),
        expectedVersion: 0,
        updatedAt: new Date(NOW).toISOString(),
      })
    ).resolves.toMatchObject({ ok: true });
  });
});
