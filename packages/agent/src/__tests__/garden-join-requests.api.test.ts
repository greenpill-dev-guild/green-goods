import {
  encodeGardenJoinAuthorization,
  type GardenJoinProofAction,
  type GardenJoinProofEnvelope,
} from "@green-goods/shared/public-contracts/join-requests";
import { describe, expect, it, vi } from "vitest";
import { InMemoryPublicRateLimiter } from "../api/public-protection";
import { createServer } from "../api/server";
import { MemoryGardenJoinRequestStore } from "../services/garden-join-request-memory-store";
import { createGardenJoinRequestCipher } from "../services/garden-join-requests";
import type { ProfileAvatarSignatureVerifier } from "../services/profile-avatars";

const ORIGIN = "https://greengoods.app";
const CHAIN_ID = 42161;
const GARDEN = "0x1111111111111111111111111111111111111111" as const;
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

function headers(joinProof: GardenJoinProofEnvelope) {
  return {
    origin: ORIGIN,
    "content-type": "application/json",
    authorization: encodeGardenJoinAuthorization(joinProof),
  };
}

function createApp(options: { signatureVerifier?: ProfileAvatarSignatureVerifier } = {}) {
  let requestId = 0;
  const store = new MemoryGardenJoinRequestStore(createGardenJoinRequestCipher("11".repeat(32)), {
    id: () => `request-${++requestId}`,
  });
  let applicantIsMember = false;
  let openJoining = false;
  const chainReader = {
    isMember: vi.fn(
      async (_garden: string, account: string) =>
        account.toLowerCase() === APPLICANT && applicantIsMember
    ),
    canManage: vi.fn(
      async (_garden: string, account: string) => account.toLowerCase() === OPERATOR
    ),
    areMembers: vi.fn(async (_garden: string, accounts: readonly string[]) =>
      accounts.map((account) => account.toLowerCase() === APPLICANT && applicantIsMember)
    ),
    isOpenJoining: vi.fn(async () => openJoining),
  };
  const app = createServer({
    isAIReady: () => true,
    allowedOrigins: new Set([ORIGIN]),
    publicRateLimiter: new InMemoryPublicRateLimiter(),
    gardenJoinRequestsEnabled: true,
    gardenJoinRequestStore: store,
    gardenJoinRequestChainId: CHAIN_ID,
    gardenJoinRequestChainReader: chainReader,
    gardenJoinRequestSignatureVerifier: options.signatureVerifier ?? vi.fn(async () => true),
    gardenJoinRequestSweepIntervalMs: 0,
    now: () => NOW,
  });
  return {
    app,
    store,
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
  return app.request(`/public/gardens/${GARDEN}/join-requests`, {
    method: "POST",
    headers: headers(proof("create", accountAddress)),
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
    const { app, chainReader } = createApp();
    await submit(app);

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
    const resolve = () =>
      app.request(`/public/gardens/${GARDEN}/join-requests/request-1/resolve`, {
        method: "POST",
        headers: headers(
          proof("welcome", OPERATOR, { requestId: "request-1", expectedRevision: 0 })
        ),
        body: JSON.stringify({ action: "welcome", expectedRevision: 0 }),
      });

    const waiting = await resolve();
    expect(waiting.status).toBe(202);
    expect(await waiting.json()).toMatchObject({ ok: true, pendingOnchainMembership: true });

    setMember(true);
    const welcomed = await resolve();
    expect(welcomed.status).toBe(200);
    expect(await welcomed.json()).toMatchObject({ request: { state: "welcomed", revision: 1 } });
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

  it("runs the retention sweep when the enabled service starts", async () => {
    const store = new MemoryGardenJoinRequestStore(createGardenJoinRequestCipher("22".repeat(32)));
    const sweep = vi.spyOn(store, "sweep");
    const app = createServer({
      isAIReady: () => true,
      gardenJoinRequestsEnabled: true,
      gardenJoinRequestStore: store,
      gardenJoinRequestSweepIntervalMs: 60_000,
      now: () => NOW,
    });

    await vi.waitFor(() => expect(sweep).toHaveBeenCalledWith(new Date(NOW).toISOString()));
    await app.close();
  });

  it("does not expose queue routes until activation is explicit", async () => {
    const app = createServer({ isAIReady: () => true });
    const response = await submit(app);
    expect(response.status).toBe(404);
  });
});
