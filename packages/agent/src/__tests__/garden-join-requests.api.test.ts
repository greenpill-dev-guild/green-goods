import {
  encodeGardenJoinAuthorization,
  type GardenJoinProofAction,
  type GardenJoinProofEnvelope,
} from "@green-goods/shared/public-contracts/join-requests";
import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { InMemoryPublicRateLimiter } from "../api/public-protection";
import { createServer } from "../api/server";
import { MemoryGardenJoinRequestStore } from "../services/garden-join-request-memory-store";
import {
  createGardenJoinRequestCipher,
  GardenJoinRequestRateLimitPressure,
} from "../services/garden-join-requests";
import { initAgentAnalytics, resetAgentAnalyticsForTests } from "../services/analytics";
import type { ProfileAvatarSignatureVerifier } from "../services/profile-avatars";
import { mockPostHog } from "./setup";

const ORIGIN = "https://greengoods.app";
const CHAIN_ID = 42161;
const GARDEN = "0x1111111111111111111111111111111111111111" as const;
const SECOND_GARDEN = "0x7777777777777777777777777777777777777777" as const;
const APPLICANT = "0x2222222222222222222222222222222222222222" as const;
const OPERATOR = "0x3333333333333333333333333333333333333333" as const;
const NOW = Date.UTC(2026, 7, 27, 12);
let nonce = 0;

function proof(
  action: GardenJoinProofAction,
  accountAddress: GardenJoinProofEnvelope["accountAddress"] = APPLICANT,
  overrides: Partial<GardenJoinProofEnvelope> = {}
): GardenJoinProofEnvelope {
  nonce += 1;
  return {
    version: 1,
    chainId: CHAIN_ID,
    gardenAddress: GARDEN,
    accountAddress,
    action,
    nonce: `0x${nonce.toString(16).padStart(64, "0")}`,
    issuedAt: Math.floor(NOW / 1000),
    expiresAt: Math.floor(NOW / 1000) + 300,
    signature: "0x1234",
    ...overrides,
  };
}

function headers(
  joinProof: GardenJoinProofEnvelope,
  origin = ORIGIN,
  testSocketIp = "198.51.100.10"
) {
  return {
    origin,
    "x-gg-test-socket-ip": testSocketIp,
    "content-type": "application/json",
    authorization: encodeGardenJoinAuthorization(joinProof),
  };
}

function createApp(options: { signatureVerifier?: ProfileAvatarSignatureVerifier } = {}) {
  let requestId = 0;
  const store = new MemoryGardenJoinRequestStore(createGardenJoinRequestCipher("11".repeat(32)), {
    id: () => `request-${++requestId}`,
  });
  const rateLimitPressure = new GardenJoinRequestRateLimitPressure();
  let applicantIsMember = false;
  let openJoining = false;
  const chainReader = {
    isMember: vi.fn(
      async (_garden: Address, account: Address) =>
        account.toLowerCase() === APPLICANT && applicantIsMember
    ),
    canManage: vi.fn(
      async (_garden: Address, account: Address) => account.toLowerCase() === OPERATOR
    ),
    areMembers: vi.fn(async (_garden: Address, accounts: readonly Address[]) =>
      accounts.map((account) => account.toLowerCase() === APPLICANT && applicantIsMember)
    ),
    isOpenJoining: vi.fn(async (_garden: Address) => openJoining),
  };
  const app = createServer({
    isAIReady: () => true,
    allowedOrigins: new Set([ORIGIN]),
    publicRateLimiter: new InMemoryPublicRateLimiter(),
    trustedProxy: { allowTestSocketIp: true },
    gardenJoinRequestsEnabled: true,
    gardenJoinRequestStore: store,
    gardenJoinRequestRateLimitPressure: rateLimitPressure,
    gardenJoinRequestChainId: CHAIN_ID,
    gardenJoinRequestChainReader: chainReader,
    gardenJoinRequestSignatureVerifier: options.signatureVerifier ?? vi.fn(async () => true),
    gardenJoinRequestSweepIntervalMs: 0,
    now: () => NOW,
  });
  return {
    app,
    store,
    rateLimitPressure,
    chainReader,
    setMember: (value: boolean) => (applicantIsMember = value),
    setOpenJoining: (value: boolean) => (openJoining = value),
  };
}

async function submit(app: ReturnType<typeof createServer>) {
  return app.request(`/public/gardens/${GARDEN}/join-requests`, {
    method: "POST",
    headers: headers(proof("create")),
    body: JSON.stringify({
      displayName: "Maya",
      note: "I would like to help with the food forest.",
      requestedVia: "garden_detail",
    }),
  });
}

async function submitFor(
  app: ReturnType<typeof createServer>,
  accountAddress: GardenJoinProofEnvelope["accountAddress"]
) {
  return submitForGarden(app, GARDEN, accountAddress);
}

async function submitForGarden(
  app: ReturnType<typeof createServer>,
  gardenAddress: Address,
  accountAddress: GardenJoinProofEnvelope["accountAddress"],
  origin = ORIGIN,
  testSocketIp = "198.51.100.10"
) {
  return app.request(`/public/gardens/${gardenAddress}/join-requests`, {
    method: "POST",
    headers: headers(proof("create", accountAddress, { gardenAddress }), origin, testSocketIp),
    body: JSON.stringify({ displayName: "Maya", requestedVia: "garden_detail" }),
  });
}

describe("garden join request public API", () => {
  it("creates a request and returns only non-sensitive state to the applicant", async () => {
    const { app } = createApp();
    const created = await submit(app);
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      ok: true,
      request: { id: "request-1", state: "pending", canAskAgain: false },
    });

    const mine = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
      headers: headers(proof("read_self")),
    });
    expect(mine.status).toBe(200);
    expect(await mine.json()).toEqual({
      ok: true,
      request: expect.objectContaining({ id: "request-1", state: "pending" }),
    });
  });

  it("rejects requests for gardens that allow direct joining", async () => {
    const { app, store, setOpenJoining } = createApp();
    setOpenJoining(true);

    const response = await submit(app);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ errorCode: "open_joining_enabled" });
    expect(await store.getMine(GARDEN, APPLICANT)).toBeUndefined();
  });

  it("requires an operator or owner proof to list and decline requests", async () => {
    const { app, chainReader, rateLimitPressure } = createApp();
    await submit(app);
    rateLimitPressure.mark(GARDEN, NOW);

    const denied = await app.request(
      `/public/gardens/${GARDEN}/join-requests?state=pending&limit=25`,
      {
        headers: headers(proof("list")),
      }
    );
    expect(denied.status).toBe(403);

    const listed = await app.request(
      `/public/gardens/${GARDEN}/join-requests?state=pending&limit=25`,
      {
        headers: headers(proof("list", OPERATOR)),
      }
    );
    const queue = await listed.json();
    expect(queue.items).toEqual([
      expect.objectContaining({ id: "request-1", displayName: "Maya", accountAddress: APPLICANT }),
    ]);
    expect(queue.rateLimitedRecently).toBe(true);
    expect(chainReader.areMembers).toHaveBeenCalledOnce();

    const declined = await app.request(
      `/public/gardens/${GARDEN}/join-requests/request-1/resolve`,
      {
        method: "POST",
        headers: headers(
          proof("decline", OPERATOR, { requestId: "request-1", expectedRevision: 0 })
        ),
        body: JSON.stringify({ action: "decline", expectedRevision: 0, reason: "No capacity." }),
      }
    );
    expect(declined.status).toBe(200);
    expect(await declined.json()).toMatchObject({
      request: { state: "declined", reason: "No capacity." },
    });
  });

  it("waits for the role transaction, then reconciles membership as welcomed", async () => {
    const { app, setMember } = createApp();
    await submit(app);
    const resolve = (joinProof: GardenJoinProofEnvelope) =>
      app.request(`/public/gardens/${GARDEN}/join-requests/request-1/resolve`, {
        method: "POST",
        headers: headers(joinProof),
        body: JSON.stringify({ action: "welcome", expectedRevision: 0 }),
      });
    const waitingProof = proof("welcome", OPERATOR, {
      requestId: "request-1",
      expectedRevision: 0,
      nonce: `0x${"ab".repeat(32)}`,
    });

    const waiting = await resolve(waitingProof);
    expect(waiting.status).toBe(202);
    expect(await waiting.json()).toMatchObject({ ok: true, pendingOnchainMembership: true });
    const replay = await resolve({
      ...waitingProof,
      nonce: `0x${waitingProof.nonce.slice(2).toUpperCase()}`,
    });
    expect(replay.status).toBe(409);
    expect(await replay.json()).toMatchObject({ errorCode: "idempotency_conflict" });

    setMember(true);
    const welcomed = await resolve(
      proof("welcome", OPERATOR, { requestId: "request-1", expectedRevision: 0 })
    );
    expect(welcomed.status).toBe(200);
    expect(await welcomed.json()).toMatchObject({ request: { state: "welcomed", revision: 1 } });
  });

  it("lets confirmed membership override a stale declined revision", async () => {
    const { app, setMember } = createApp();
    await submit(app);
    const declined = await app.request(
      `/public/gardens/${GARDEN}/join-requests/request-1/resolve`,
      {
        method: "POST",
        headers: headers(
          proof("decline", OPERATOR, { requestId: "request-1", expectedRevision: 0 })
        ),
        body: JSON.stringify({ action: "decline", expectedRevision: 0, reason: "No capacity." }),
      }
    );
    expect(declined.status).toBe(200);

    setMember(true);
    const reconciled = await app.request(
      `/public/gardens/${GARDEN}/join-requests/request-1/resolve`,
      {
        method: "POST",
        headers: headers(
          proof("welcome", OPERATOR, { requestId: "request-1", expectedRevision: 0 })
        ),
        body: JSON.stringify({ action: "welcome", expectedRevision: 0 }),
      }
    );

    expect(reconciled.status).toBe(200);
    const body = await reconciled.json();
    expect(body).toMatchObject({ request: { state: "welcomed", revision: 2 } });
    expect(body.request).not.toHaveProperty("reason");
  });

  it("rejects replayed write proofs", async () => {
    const { app } = createApp();
    const createProof = proof("create");
    const request = () =>
      app.request(`/public/gardens/${GARDEN}/join-requests`, {
        method: "POST",
        headers: headers(createProof),
        body: JSON.stringify({ displayName: "Maya", requestedVia: "garden_detail" }),
      });
    expect((await request()).status).toBe(201);
    const replay = await request();
    expect(replay.status).toBe(409);
    expect((await replay.json()).errorCode).toBe("idempotency_conflict");
  });

  it("rate-limits invalid proofs before unbounded signature verification", async () => {
    const signatureVerifier = vi.fn(async () => false);
    const { app } = createApp({ signatureVerifier });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await submitFor(app, APPLICANT);
      expect(response.status).toBe(401);
    }

    const limited = await submitFor(app, APPLICANT);
    expect(limited.status).toBe(429);
    expect(signatureVerifier).toHaveBeenCalledTimes(10);
  });

  it("classifies verifier outages as service failures", async () => {
    mockPostHog.capture.mockClear();
    initAgentAnalytics({ apiKey: "phc_agent_test", enabled: true });
    const { app } = createApp({
      signatureVerifier: vi.fn(async () => {
        throw new Error("RPC unavailable");
      }),
    });

    try {
      const response = await submit(app);

      expect(response.status).toBe(503);
      await vi.waitFor(() =>
        expect(mockPostHog.capture).toHaveBeenCalledWith({
          distinctId: "green-goods-agent-runtime",
          event: "join_request_create_rejected",
          properties: expect.objectContaining({ error_class: "service_unavailable" }),
        })
      );
    } finally {
      resetAgentAnalyticsForTests();
    }
  });

  it("does not let rotating allowed origins bypass the pre-authentication limit", async () => {
    const signatureVerifier = vi.fn(async () => false);
    const { app, rateLimitPressure } = createApp({ signatureVerifier });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const origin = `https://green-goods-${attempt}-greenpilldevguild.vercel.app`;
      expect((await submitForGarden(app, GARDEN, APPLICANT, origin)).status).toBe(401);
    }

    const limited = await submitForGarden(
      app,
      GARDEN,
      APPLICANT,
      "https://green-goods-next-greenpilldevguild.vercel.app"
    );
    expect(limited.status).toBe(429);
    expect(signatureVerifier).toHaveBeenCalledTimes(10);
    expect(rateLimitPressure.hasRecent(GARDEN, NOW)).toBe(true);
  });

  it("scopes the pre-authentication IP limit to each garden", async () => {
    const signatureVerifier = vi.fn(async () => false);
    const { app } = createApp({ signatureVerifier });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await submitFor(app, APPLICANT)).status).toBe(401);
    }

    expect((await submitForGarden(app, SECOND_GARDEN, APPLICANT)).status).toBe(401);
    expect(signatureVerifier).toHaveBeenCalledTimes(11);
  });

  it("applies the daily create ceiling per signed account rather than per shared IP", async () => {
    const { app } = createApp();
    const applicants = [
      APPLICANT,
      "0x4444444444444444444444444444444444444444",
      "0x5555555555555555555555555555555555555555",
      "0x6666666666666666666666666666666666666666",
    ] as const;

    for (const applicant of applicants) {
      const response = await submitFor(app, applicant);
      expect(response.status).toBe(201);
    }
  });

  it("does not spend garden create slots on rejected open-joining attempts", async () => {
    const { app, setOpenJoining } = createApp();
    setOpenJoining(true);

    for (let attempt = 1; attempt <= 51; attempt += 1) {
      const applicant = `0x${attempt.toString(16).padStart(40, "0")}` as Address;
      const response = await submitForGarden(
        app,
        GARDEN,
        applicant,
        ORIGIN,
        `198.51.100.${attempt}`
      );
      expect(response.status).toBe(409);
    }

    setOpenJoining(false);
    const accepted = await submitForGarden(
      app,
      GARDEN,
      `0x${"99".padStart(40, "0")}`,
      ORIGIN,
      "198.51.100.99"
    );
    expect(accepted.status).toBe(201);
  });

  it("does not spend garden create slots when existing requests converge", async () => {
    const { app } = createApp();

    for (let index = 1; index <= 17; index += 1) {
      const applicant = `0x${(index + 100).toString(16).padStart(40, "0")}` as Address;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await submitForGarden(
          app,
          GARDEN,
          applicant,
          ORIGIN,
          `203.0.113.${index}`
        );
        expect(response.status).toBe(attempt === 0 ? 201 : 200);
      }
    }

    const accepted = await submitForGarden(
      app,
      GARDEN,
      `0x${"fe".padStart(40, "0")}`,
      ORIGIN,
      "203.0.113.99"
    );
    expect(accepted.status).toBe(201);
  });

  it("runs the retention sweep when storage exists even if collection is disabled", async () => {
    const store = new MemoryGardenJoinRequestStore(createGardenJoinRequestCipher("22".repeat(32)));
    const sweep = vi.spyOn(store, "sweep");
    const app = createServer({
      isAIReady: () => true,
      gardenJoinRequestsEnabled: false,
      gardenJoinRequestStore: store,
      gardenJoinRequestSweepIntervalMs: 60_000,
      now: () => NOW,
    });

    await vi.waitFor(() => expect(sweep).toHaveBeenCalledWith(new Date(NOW).toISOString()));
    await app.close();
  });

  it("does not expose queue routes until activation is explicit", async () => {
    const app = createServer({ isAIReady: () => true, gardenJoinRequestsEnabled: false });
    const response = await submit(app);
    expect(response.status).toBe(404);

    const availability = await app.request("/public/features/garden-join-requests", {
      headers: { origin: ORIGIN },
    });
    expect(availability.status).toBe(200);
    expect(await availability.json()).toEqual({ ok: true, enabled: false });
  });
});
