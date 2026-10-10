import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import { createGardenJoinRequestSignatureVerifier } from "../services/garden-join-requests-verifier";
import {
  buildGardenJoinProofMessage,
  encodeGardenJoinAuthorization,
  type GardenJoinProofAction,
  type GardenJoinProofEnvelope,
} from "@green-goods/shared/public-contracts/join-requests";
import type { Address } from "@green-goods/shared/public-contracts";
import { describe, expect, it, vi } from "vitest";
import { InMemoryPublicRateLimiter } from "../api/public-protection";
import { createServer } from "../api/server";
import { MemoryGardenJoinRequestStore } from "../services/garden-join-request-memory-store";
import {
  createGardenJoinRequestCipher,
  GardenJoinRequestRateLimitPressure,
} from "../services/garden-join-requests";
import { initAgentAnalytics, resetAgentAnalyticsForTests } from "../services/analytics";
import { logger } from "../services/logger";
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

function createApp(
  options: { signatureVerifier?: ProfileAvatarSignatureVerifier; now?: () => number } = {}
) {
  let requestId = 0;
  const store = new MemoryGardenJoinRequestStore(createGardenJoinRequestCipher("11".repeat(32)), {
    id: () => `request-${++requestId}`,
  });
  const rateLimitPressure = new GardenJoinRequestRateLimitPressure();
  let applicantIsMember = false;
  let applicantIsSteward = false;
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
    isSteward: vi.fn(
      async (_garden: Address, account: Address) =>
        account.toLowerCase() === APPLICANT && applicantIsSteward
    ),
    areStewards: vi.fn(async (_garden: Address, accounts: readonly Address[]) =>
      accounts.map((account) => account.toLowerCase() === APPLICANT && applicantIsSteward)
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
    now: options.now ?? (() => NOW),
  });
  return {
    app,
    store,
    rateLimitPressure,
    chainReader,
    setMember: (value: boolean) => (applicantIsMember = value),
    setSteward: (value: boolean) => (applicantIsSteward = value),
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

async function submitSteward(
  app: ReturnType<typeof createServer>,
  overrides: Partial<GardenJoinProofEnvelope> = {}
) {
  return app.request(`/public/gardens/${GARDEN}/join-requests`, {
    method: "POST",
    headers: headers(proof("create", APPLICANT, { kind: "steward_access", ...overrides })),
    body: JSON.stringify({
      kind: "steward_access",
      displayName: "Maya",
      requestedVia: "admin_access",
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
  it("accepts steward requests from existing gardeners in open gardens", async () => {
    const { app, setMember, setOpenJoining, chainReader } = createApp();
    setMember(true);
    setOpenJoining(true);
    const response = await submitSteward(app);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      request: { kind: "steward_access", state: "pending" },
    });
    expect(chainReader.isOpenJoining).not.toHaveBeenCalled();
    expect(chainReader.isMember).not.toHaveBeenCalled();
  });

  it("rejects an existing steward before consuming a proof or writing a request", async () => {
    const { app, setSteward, store } = createApp();
    setSteward(true);
    const response = await submitSteward(app);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ errorCode: "already_steward" });
    expect(store.inspectEncryptedRecords()).toHaveLength(0);
    expect(store.inspectProofKeys()).toHaveLength(0);
  });

  it("requires the signed create kind to match its body", async () => {
    const { app, store } = createApp();
    const response = await submitSteward(app, { kind: undefined });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: "invalid_request" });
    expect(store.inspectEncryptedRecords()).toHaveLength(0);
  });

  it("verifies the request kind as part of a real account signature", async () => {
    const signer = privateKeyToAccount(`0x${"11".repeat(32)}` as `0x${string}`);
    const signatureVerifier = createGardenJoinRequestSignatureVerifier({
      chain: arbitrum,
      rpcUrl: "http://127.0.0.1:3009",
    });
    const { app } = createApp({ signatureVerifier });
    const unsigned = proof("read_self", signer.address as Address, { kind: "steward_access" });
    const signed = {
      ...unsigned,
      signature: await signer.signMessage({ message: buildGardenJoinProofMessage(unsigned) }),
    };
    const valid = await app.request(
      `/public/gardens/${GARDEN}/join-requests/me?kind=steward_access`,
      { headers: headers(signed) }
    );
    expect(valid.status).toBe(200);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ jsonrpc: "2.0", id: 1, result: `0x${"0".repeat(64)}` }))
    );
    try {
      const tampered = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
        headers: headers({ ...signed, kind: undefined }),
      });
      expect(tampered.status).toBe(401);
      expect(await tampered.json()).toMatchObject({ errorCode: "signature_invalid" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("fails before persistence when the stewardship role read is unavailable", async () => {
    const { app, store, chainReader } = createApp();
    chainReader.isSteward.mockRejectedValueOnce(new Error("RPC unavailable"));
    const response = await submitSteward(app);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ errorCode: "request_not_saved" });
    expect(store.inspectEncryptedRecords()).toHaveLength(0);
    expect(store.inspectProofKeys()).toHaveLength(0);
    expect((await submitSteward(app)).status).toBe(201);
  });

  it("isolates self reads and queues by signed kind and rejects query scope tampering", async () => {
    const { app } = createApp();
    const membership = await (await submit(app)).json();
    const steward = await (await submitSteward(app)).json();
    expect(steward.request.id).not.toBe(membership.request.id);
    for (const [kind, requestId] of [
      ["garden_membership", membership.request.id],
      ["steward_access", steward.request.id],
    ] as const) {
      const mine = await app.request(`/public/gardens/${GARDEN}/join-requests/me?kind=${kind}`, {
        headers: headers(proof("read_self", APPLICANT, { kind })),
      });
      expect((await mine.json()).request.id).toBe(requestId);
      const queue = await app.request(
        `/public/gardens/${GARDEN}/join-requests?state=pending&limit=25&kind=${kind}`,
        {
          headers: headers(proof("list", OPERATOR, { kind })),
        }
      );
      expect((await queue.json()).items.map(({ id }: { id: string }) => id)).toEqual([requestId]);
    }
    const tampered = await app.request(
      `/public/gardens/${GARDEN}/join-requests/me?kind=steward_access`,
      {
        headers: headers(proof("read_self")),
      }
    );
    expect(tampered.status).toBe(400);
    const withdrawn = await app.request(
      `/public/gardens/${GARDEN}/join-requests/me?kind=steward_access`,
      {
        method: "DELETE",
        headers: headers(
          proof("withdraw", APPLICANT, {
            kind: "steward_access",
            requestId: steward.request.id,
            expectedRevision: 0,
          })
        ),
      }
    );
    expect(withdrawn.status).toBe(200);
    const membershipMine = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
      headers: headers(proof("read_self")),
    });
    expect((await membershipMine.json()).request.id).toBe(membership.request.id);
  });

  it("keeps stewardship pending until the Operator or Owner role is confirmed", async () => {
    const { app, setMember, setSteward } = createApp();
    await submitSteward(app);
    setMember(true);
    const resolve = () =>
      app.request(`/public/gardens/${GARDEN}/join-requests/request-1/resolve`, {
        method: "POST",
        headers: headers(
          proof("welcome", OPERATOR, {
            kind: "steward_access",
            requestId: "request-1",
            expectedRevision: 0,
          })
        ),
        body: JSON.stringify({ action: "welcome", expectedRevision: 0 }),
      });
    const waiting = await resolve();
    expect(waiting.status).toBe(202);
    expect(await waiting.json()).toMatchObject({
      pendingOnchainRole: true,
      request: { state: "pending" },
    });
    const mine = await app.request(
      `/public/gardens/${GARDEN}/join-requests/me?kind=steward_access`,
      {
        headers: headers(proof("read_self", APPLICANT, { kind: "steward_access" })),
      }
    );
    expect((await mine.json()).request.state).toBe("pending");
    const queue = await app.request(
      `/public/gardens/${GARDEN}/join-requests?state=pending&limit=25&kind=steward_access`,
      {
        headers: headers(proof("list", OPERATOR, { kind: "steward_access" })),
      }
    );
    expect((await queue.json()).items).toMatchObject([{ id: "request-1", state: "pending" }]);
    setSteward(true);
    const recovered = await app.request(
      `/public/gardens/${GARDEN}/join-requests/me?kind=steward_access`,
      {
        headers: headers(proof("read_self", APPLICANT, { kind: "steward_access" })),
      }
    );
    expect((await recovered.json()).request).toMatchObject({ state: "welcomed", revision: 1 });
    const welcomed = await resolve();
    expect(welcomed.status).toBe(200);
    expect(await welcomed.json()).toMatchObject({
      request: { kind: "steward_access", state: "welcomed", revision: 1 },
    });
  });

  it("rejects the wrong signed kind before reconciling an already confirmed steward", async () => {
    const { app, store, setMember, setSteward } = createApp();
    await submitSteward(app);
    setMember(true);
    setSteward(true);
    const resolve = await app.request(`/public/gardens/${GARDEN}/join-requests/request-1/resolve`, {
      method: "POST",
      headers: headers(proof("welcome", OPERATOR, { requestId: "request-1", expectedRevision: 0 })),
      body: JSON.stringify({ action: "welcome", expectedRevision: 0 }),
    });
    expect(resolve.status).toBe(400);
    expect(await store.getById(GARDEN, "request-1")).toMatchObject({ state: "pending" });
    const withdraw = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
      method: "DELETE",
      headers: headers(
        proof("withdraw", APPLICANT, { requestId: "request-1", expectedRevision: 0 })
      ),
    });
    expect(withdraw.status).toBe(404);
    expect(await store.getById(GARDEN, "request-1")).toMatchObject({ state: "pending" });
  });

  it("requires operator or owner authority to review steward requests", async () => {
    const { app, store } = createApp();
    await submitSteward(app);
    const queue = await app.request(
      `/public/gardens/${GARDEN}/join-requests?state=pending&limit=25&kind=steward_access`,
      {
        headers: headers(proof("list", APPLICANT, { kind: "steward_access" })),
      }
    );
    expect(queue.status).toBe(403);
    const declined = await app.request(
      `/public/gardens/${GARDEN}/join-requests/request-1/resolve`,
      {
        method: "POST",
        headers: headers(
          proof("decline", APPLICANT, {
            kind: "steward_access",
            requestId: "request-1",
            expectedRevision: 0,
          })
        ),
        body: JSON.stringify({ action: "decline", expectedRevision: 0, reason: "Not available." }),
      }
    );
    expect(declined.status).toBe(403);
    expect(await store.getById(GARDEN, "request-1")).toMatchObject({ state: "pending" });
  });

  it.each([
    "isOpenJoining",
    "isMember",
  ] as const)("keeps a transient %s failure before persistence and allows a fresh signed retry", async (boundary) => {
    const { app, store, chainReader } = createApp();
    chainReader[boundary].mockRejectedValueOnce(new Error("RPC temporarily unavailable"));
    const create = vi.spyOn(store, "create");
    const failed = await submit(app);
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({ errorCode: "request_not_saved" });
    expect(create).not.toHaveBeenCalled();
    const mine = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
      headers: headers(proof("read_self")),
    });
    expect(await mine.json()).toEqual({ ok: true, request: null });
    const saved = await submit(app);
    expect(saved.status).toBe(201);
    const retry = await submit(app);
    expect(retry.status).toBe(200);
    expect((await retry.json()).request.id).toBe((await saved.json()).request.id);
    expect(
      (await store.listPending(GARDEN, { nowIso: new Date(NOW).toISOString() })).items
    ).toHaveLength(1);
  });

  it("never persists after the pre-write deadline is exhausted", async () => {
    let clock = NOW;
    const { app, store, chainReader } = createApp({ now: () => clock });
    const create = vi.spyOn(store, "create");
    chainReader.isOpenJoining.mockImplementation(async () => {
      clock += 8_001;
      return false;
    });
    const response = await submit(app);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ errorCode: "request_not_saved" });
    expect(create).not.toHaveBeenCalled();
    expect(store.inspectEncryptedRecords()).toHaveLength(0);
    expect(store.inspectProofKeys()).toHaveLength(0);
  });

  it.each([
    "pending at deadline",
    "completing at deadline",
    "aborted",
  ] as const)("finishes an admitted create when its proof claim is %s", async (boundary) => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const { app, store } = createApp({ now: Date.now });
    const controller = new AbortController();
    let releaseClaim!: () => void;
    let markClaimStarted!: () => void;
    const paused = new Promise<void>((resolve) => (releaseClaim = resolve));
    const started = new Promise<void>((resolve) => (markClaimStarted = resolve));
    const claimProof = store.claimProof.bind(store);
    vi.spyOn(store, "claimProof").mockImplementationOnce(async (...args) => {
      markClaimStarted();
      await paused;
      return claimProof(...args);
    });
    try {
      const response = app.request(`/public/gardens/${GARDEN}/join-requests`, {
        method: "POST",
        headers: headers(proof("create")),
        body: JSON.stringify({ displayName: "Maya", requestedVia: "garden_detail" }),
        signal: controller.signal,
      });
      await started;
      if (boundary === "pending at deadline") await vi.advanceTimersByTimeAsync(8_001);
      else if (boundary === "completing at deadline") vi.setSystemTime(NOW + 8_001);
      else controller.abort();
      releaseClaim();
      const saved = await response;
      expect(saved.status).toBe(201);
      expect((await saved.json()).request).toMatchObject({ id: "request-1", state: "pending" });
      const mine = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
        headers: headers(proof("read_self")),
      });
      expect((await mine.json()).request.id).toBe("request-1");
      const retry = await submit(app);
      expect(retry.status).toBe(200);
      expect((await retry.json()).request.id).toBe("request-1");
      expect((await store.listPending(GARDEN)).items).toHaveLength(1);
    } finally {
      releaseClaim();
      vi.useRealTimers();
    }
  });

  it("verifies real signed grant content and rejects tampering without weakening writes", async () => {
    const signer = privateKeyToAccount(`0x${"11".repeat(32)}` as `0x${string}`);
    const signatureVerifier = createGardenJoinRequestSignatureVerifier({
      chain: arbitrum,
      rpcUrl: "http://127.0.0.1:3009",
    });
    const { app, store } = createApp({ signatureVerifier });
    const input = { displayName: "Maya", requestedVia: "garden_detail" as const };
    const unsigned = {
      ...proof("create", signer.address as `0x${string}`),
      readSelf: { audience: ORIGIN, content: input },
    };
    const grant = {
      ...unsigned,
      signature: await signer.signMessage({
        message: buildGardenJoinProofMessage(unsigned, { ...input, note: null }),
      }),
    };
    const created = await app.request(`/public/gardens/${GARDEN}/join-requests`, {
      method: "POST",
      headers: headers(grant),
      body: JSON.stringify(input),
    });
    expect(created.status).toBe(201);
    const mine = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
      headers: headers(grant),
    });
    expect(mine.status).toBe(200);
    const mismatch = await app.request(`/public/gardens/${GARDEN}/join-requests`, {
      method: "POST",
      headers: headers(grant),
      body: JSON.stringify({ ...input, displayName: "Different person" }),
    });
    expect(mismatch.status).toBe(400);
    expect(store.inspectEncryptedRecords()).toHaveLength(1);
    const fetch = vi.fn(async () =>
      Response.json({ jsonrpc: "2.0", id: 1, result: `0x${"0".repeat(64)}` })
    );
    vi.stubGlobal("fetch", fetch);
    try {
      const tampered = {
        ...grant,
        readSelf: { ...grant.readSelf, content: { ...input, displayName: "Altered" } },
      };
      const rejected = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
        headers: headers(tampered),
      });
      expect(rejected.status).toBe(401);
    } finally {
      vi.unstubAllGlobals();
    }
    const wrongGarden = await app.request(`/public/gardens/${SECOND_GARDEN}/join-requests/me`, {
      headers: headers(grant),
    });
    expect(wrongGarden.status).toBe(400);
    const withdrawal = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
      method: "DELETE",
      headers: headers(grant),
    });
    expect(withdrawal.status).toBe(400);
  });

  it("allows status recovery before create while leaving the create nonce unused", async () => {
    const { app } = createApp();
    const input = { displayName: "Maya", requestedVia: "garden_detail" as const };
    const grant = { ...proof("create"), readSelf: { audience: ORIGIN, content: input } };
    const mine = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
      headers: headers(grant),
    });
    expect(mine.status).toBe(200);
    expect(await mine.json()).toMatchObject({ request: null });
    const created = await app.request(`/public/gardens/${GARDEN}/join-requests`, {
      method: "POST",
      headers: headers(grant),
      body: JSON.stringify(input),
    });
    expect(created.status).toBe(201);
  });

  it("accepts an explicitly audience-bound create grant only for its own status", async () => {
    const { app } = createApp();
    const input = { displayName: "Maya", requestedVia: "garden_detail" as const };
    const grant = { ...proof("create"), readSelf: { audience: ORIGIN, content: input } };
    const created = await app.request(`/public/gardens/${GARDEN}/join-requests`, {
      method: "POST",
      headers: headers(grant),
      body: JSON.stringify(input),
    });
    expect(created.status).toBe(201);
    const mine = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
      headers: headers(grant),
    });
    expect(mine.status).toBe(200);
    expect(await mine.json()).toMatchObject({ request: { state: "pending" } });
    const queue = await app.request(
      `/public/gardens/${GARDEN}/join-requests?state=pending&limit=25`,
      { headers: headers(grant) }
    );
    expect(queue.status).toBe(400);
    const differentAudience = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
      headers: headers(grant, "https://green-goods-preview-greenpilldevguild.vercel.app"),
    });
    expect(differentAudience.status).toBe(401);
  });

  it("reconciles a store failure after persistence without creating a second pending request", async () => {
    const { app, store } = createApp();
    const persist = store.create.bind(store);
    vi.spyOn(store, "create").mockImplementationOnce(async (input) => {
      await persist(input);
      throw new Error("Response lost after commit");
    });
    const failed = await submit(app);
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({ errorCode: "provider_unavailable" });
    const unsigned = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
      headers: { origin: ORIGIN },
    });
    expect(unsigned.status).toBe(400);
    const mine = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
      headers: headers(proof("read_self")),
    });
    expect((await mine.json()).request).toMatchObject({ id: "request-1", state: "pending" });
    const retry = await submit(app);
    expect(retry.status).toBe(200);
    expect((await retry.json()).request.id).toBe("request-1");
    expect(
      (await store.listPending(GARDEN, { nowIso: new Date(NOW).toISOString() })).items
    ).toHaveLength(1);
  });

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

  it("does not let a stale withdrawal proof delete a replacement request", async () => {
    const { app } = createApp();
    const created = await submit(app);
    const first = (await created.json()).request as { id: string; revision: number };
    const staleProof = proof("withdraw", APPLICANT, {
      requestId: first.id,
      expectedRevision: first.revision,
    });
    const withdrawn = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
      method: "DELETE",
      headers: headers(
        proof("withdraw", APPLICANT, {
          requestId: first.id,
          expectedRevision: first.revision,
        })
      ),
    });
    expect(withdrawn.status).toBe(200);

    const replacement = await submit(app);
    expect(replacement.status).toBe(201);
    const replacementBody = await replacement.json();
    expect(replacementBody.request.id).not.toBe(first.id);

    const staleWithdrawal = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
      method: "DELETE",
      headers: headers(staleProof),
    });
    expect(staleWithdrawal.status).toBe(404);

    const mine = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
      headers: headers(proof("read_self")),
    });
    expect(await mine.json()).toMatchObject({
      request: { id: replacementBody.request.id, state: "pending" },
    });
  });

  it("omits expired pending requests from self and queue reads", async () => {
    const { app, store } = createApp();
    await store.create({
      gardenAddress: GARDEN,
      accountAddress: APPLICANT,
      displayName: "Expired applicant",
      requestedVia: "garden_detail",
      requestedAt: new Date(NOW - 31 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(NOW - 1).toISOString(),
    });

    const mine = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
      headers: headers(proof("read_self")),
    });
    expect(mine.status).toBe(200);
    expect(await mine.json()).toEqual({ ok: true, request: null });

    await store.create({
      gardenAddress: GARDEN,
      accountAddress: APPLICANT,
      displayName: "Expired queue item",
      requestedVia: "garden_detail",
      requestedAt: new Date(NOW - 31 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(NOW - 1).toISOString(),
    });
    const listed = await app.request(
      `/public/gardens/${GARDEN}/join-requests?state=pending&limit=25`,
      { headers: headers(proof("list", OPERATOR)) }
    );
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({ items: [] });
    expect(store.inspectEncryptedRecords()).toHaveLength(0);
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

  it("names the dependency a failed create was waiting on, without keeping the raw error", async () => {
    mockPostHog.capture.mockClear();
    initAgentAnalytics({ apiKey: "phc_agent_test", enabled: true });
    const logged = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const { app, chainReader } = createApp();
    chainReader.isMember.mockRejectedValue(
      new Error("HTTP request failed. URL: https://rpc.example/v2/secret-key")
    );

    try {
      const response = await submit(app);

      expect(response.status).toBe(503);
      expect(logged).toHaveBeenCalledWith(
        { operation: "create", stage: "membership_read", errorName: "Error" },
        "Garden join request operation unavailable"
      );
      expect(JSON.stringify(logged.mock.calls)).not.toContain("secret-key");
      await vi.waitFor(() =>
        expect(mockPostHog.capture).toHaveBeenCalledWith({
          distinctId: "green-goods-agent-runtime",
          event: "join_request_create_rejected",
          properties: expect.objectContaining({
            error_class: "service_unavailable",
            stage: "membership_read",
          }),
        })
      );
    } finally {
      logged.mockRestore();
      resetAgentAnalyticsForTests();
    }
  });

  it("names the dependency a failed status check was waiting on", async () => {
    const logged = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const { app, chainReader } = createApp();
    expect((await submit(app)).status).toBe(201);
    // `name` is writable, so only a class name is kept; the rest goes the way of the message.
    const failure = new Error("HTTP request failed. URL: https://rpc.example/v2/secret-key");
    failure.name = "secrettoken";
    chainReader.isMember.mockRejectedValue(failure);

    try {
      const mine = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
        headers: headers(proof("read_self")),
      });

      expect(mine.status).toBe(503);
      expect(logged).toHaveBeenCalledWith(
        { operation: "read_self", stage: "membership_read", errorName: "unknown" },
        "Garden join request operation unavailable"
      );
      expect(JSON.stringify(logged.mock.calls)).not.toContain("secret");
    } finally {
      logged.mockRestore();
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

  it("retains the per-garden pre-authentication limit below the aggregate ceiling", async () => {
    const signatureVerifier = vi.fn(async () => false);
    const { app } = createApp({ signatureVerifier });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await submitFor(app, APPLICANT)).status).toBe(401);
    }

    expect((await submitForGarden(app, SECOND_GARDEN, APPLICANT)).status).toBe(401);
    expect(signatureVerifier).toHaveBeenCalledTimes(11);
  });

  it("caps pre-authentication verification across garden and origin rotation", async () => {
    const signatureVerifier = vi.fn(async () => false);
    const { app } = createApp({ signatureVerifier });

    for (let attempt = 1; attempt <= 30; attempt += 1) {
      const gardenAddress = `0x${attempt.toString(16).padStart(40, "0")}` as Address;
      const origin = `https://green-goods-${attempt}-greenpilldevguild.vercel.app`;
      expect((await submitForGarden(app, gardenAddress, APPLICANT, origin)).status).toBe(401);
    }

    const limitedGarden = `0x${"31".padStart(40, "0")}` as Address;
    const limited = await submitForGarden(
      app,
      limitedGarden,
      APPLICANT,
      "https://green-goods-next-greenpilldevguild.vercel.app"
    );
    expect(limited.status).toBe(429);
    expect(signatureVerifier).toHaveBeenCalledTimes(30);
  });

  it("caps read verification across self, list, and origin rotation", async () => {
    const signatureVerifier = vi.fn(async () => false);
    const { app } = createApp({ signatureVerifier });

    for (let attempt = 1; attempt <= 120; attempt += 1) {
      const origin = `https://green-goods-read-${attempt}-greenpilldevguild.vercel.app`;
      const response =
        attempt % 2 === 0
          ? await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
              headers: headers(proof("read_self"), origin),
            })
          : await app.request(`/public/gardens/${GARDEN}/join-requests?state=pending&limit=25`, {
              headers: headers(proof("list", OPERATOR), origin),
            });
      expect(response.status).toBe(401);
    }

    const limited = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
      headers: headers(
        proof("read_self"),
        "https://green-goods-read-next-greenpilldevguild.vercel.app"
      ),
    });
    expect(limited.status).toBe(429);
    expect(signatureVerifier).toHaveBeenCalledTimes(120);
  });

  it("caps resolve verification across withdrawal, resolution, and origin rotation", async () => {
    const signatureVerifier = vi.fn(async () => false);
    const { app } = createApp({ signatureVerifier });

    for (let attempt = 1; attempt <= 30; attempt += 1) {
      const origin = `https://green-goods-resolve-${attempt}-greenpilldevguild.vercel.app`;
      const response =
        attempt % 2 === 0
          ? await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
              method: "DELETE",
              headers: headers(
                proof("withdraw", APPLICANT, {
                  requestId: "request-1",
                  expectedRevision: 0,
                }),
                origin
              ),
            })
          : await app.request(`/public/gardens/${GARDEN}/join-requests/request-1/resolve`, {
              method: "POST",
              headers: headers(
                proof("decline", OPERATOR, {
                  requestId: "request-1",
                  expectedRevision: 0,
                }),
                origin
              ),
              body: JSON.stringify({
                action: "decline",
                expectedRevision: 0,
                reason: "No capacity.",
              }),
            });
      expect(response.status).toBe(401);
    }

    const limited = await app.request(`/public/gardens/${GARDEN}/join-requests/me`, {
      method: "DELETE",
      headers: headers(
        proof("withdraw", APPLICANT, { requestId: "request-1", expectedRevision: 0 }),
        "https://green-goods-resolve-next-greenpilldevguild.vercel.app"
      ),
    });
    expect(limited.status).toBe(429);
    expect(signatureVerifier).toHaveBeenCalledTimes(30);
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
      `0x${"99".padStart(40, "0")}` as Address,
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
      `0x${"fe".padStart(40, "0")}` as Address,
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
    expect(await availability.json()).toEqual({ ok: true, enabled: false, supportedKinds: [] });
  });

  it("advertises both request kinds only when the service is available", async () => {
    const { app } = createApp();
    const enabled = await app.request("/public/features/garden-join-requests", {
      headers: { origin: ORIGIN },
    });
    expect(await enabled.json()).toEqual({
      ok: true,
      enabled: true,
      supportedKinds: ["garden_membership", "steward_access"],
    });
    const unavailable = createServer({ isAIReady: () => true, gardenJoinRequestsEnabled: true });
    const disabled = await unavailable.request("/public/features/garden-join-requests", {
      headers: { origin: ORIGIN },
    });
    expect(await disabled.json()).toEqual({ ok: true, enabled: false, supportedKinds: [] });
  });
});
