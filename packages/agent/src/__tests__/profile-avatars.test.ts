import { Database } from "bun:sqlite";
import { buildProfileAvatarMessage } from "@green-goods/shared/profile-avatar/protocol";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BaseError, CallExecutionError, ExecutionRevertedError } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import { InMemoryPublicRateLimiter } from "../api/public-protection";
import { createServer } from "../api/server";
import { compareAndSwapProfileAvatar, getProfileAvatar } from "../services/db/profile-avatars";
import { initSchema } from "../services/db/schema";
import {
  createViemProfileAvatarSignatureVerifier,
  MemoryProfileAvatarStore,
} from "../services/profile-avatars";

const ORIGIN = "https://greengoods.app";
const CHAIN_ID = 42161;
const ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
const OTHER_ADDRESS = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const NOW = 1_753_777_600_000;
const URI = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

function createAvatarApp(
  options: {
    verify?: ReturnType<typeof vi.fn>;
    now?: number;
    configuredChainId?: number | null;
  } = {}
) {
  const store = new MemoryProfileAvatarStore();
  const verify = options.verify ?? vi.fn(async () => true);
  const now = options.now ?? NOW;
  const app = createServer({
    isAIReady: () => true,
    allowedOrigins: new Set([ORIGIN]),
    publicRateLimiter: new InMemoryPublicRateLimiter(),
    profileAvatarStore: store,
    profileAvatarChainId:
      options.configuredChainId === null ? undefined : (options.configuredChainId ?? CHAIN_ID),
    profileAvatarSignatureVerifier: verify,
    now: () => now,
  });
  return { app, store, verify };
}

function avatarUrl(address = ADDRESS, chainId = CHAIN_ID) {
  return `/public/profile-avatars/${chainId}/${address}`;
}

function mutation(
  overrides: Partial<{
    avatarUri: string | null;
    expectedVersion: number;
    issuedAt: number;
    signature: string;
    factory: string;
    factoryData: string;
  }> = {}
) {
  return {
    avatarUri: URI,
    expectedVersion: 0,
    issuedAt: Math.floor(NOW / 1000),
    signature: "0x1234",
    ...overrides,
  };
}

function headers(origin = ORIGIN) {
  return { origin, "content-type": "application/json" };
}

async function expectErrorCode(response: Response, status: number, errorCode: string) {
  expect(response.status).toBe(status);
  expect((await response.json()).errorCode).toBe(errorCode);
}

describe("profile avatar public API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the canonical missing record without caching", async () => {
    const { app } = createAvatarApp();

    const response = await app.request(avatarUrl(), { headers: { origin: ORIGIN } });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      ok: true,
      record: { avatarUri: null, version: 0, updatedAt: null },
    });
  });

  it("creates, replaces, and clears a versioned tombstone", async () => {
    const { app } = createAvatarApp();
    const created = await app.request(avatarUrl(), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(mutation()),
    });
    expect(created.status).toBe(200);
    expect((await created.json()).record).toMatchObject({ avatarUri: URI, version: 1 });

    const replacement = "ipfs://bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
    const replaced = await app.request(avatarUrl(), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(mutation({ avatarUri: replacement, expectedVersion: 1 })),
    });
    expect(replaced.status).toBe(200);
    expect((await replaced.json()).record).toMatchObject({ avatarUri: replacement, version: 2 });

    const cleared = await app.request(avatarUrl(), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(mutation({ avatarUri: null, expectedVersion: 2 })),
    });
    expect(cleared.status).toBe(200);
    expect((await cleared.json()).record).toMatchObject({ avatarUri: null, version: 3 });

    const read = await app.request(avatarUrl(), { headers: { origin: ORIGIN } });
    expect((await read.json()).record).toMatchObject({ avatarUri: null, version: 3 });
  });

  it("allows exactly one concurrent compare-and-swap mutation", async () => {
    const { app } = createAvatarApp();
    const request = () =>
      app.request(avatarUrl(), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(mutation()),
      });

    const [first, second] = await Promise.all([request(), request()]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const conflicted = first.status === 409 ? first : second;
    await expectErrorCode(conflicted, 409, "version_conflict");
  });

  it("keeps atomic CAS conflicts and tombstones in the SQLite adapter", () => {
    const database = new Database(":memory:");
    initSchema(database);
    const input = {
      chainId: CHAIN_ID,
      address: ADDRESS as `0x${string}`,
      avatarUri: URI,
      expectedVersion: 0,
      updatedAt: new Date(NOW).toISOString(),
    };

    try {
      const created = compareAndSwapProfileAvatar(database, input);
      const concurrent = compareAndSwapProfileAvatar(database, input);
      expect(created).toMatchObject({ ok: true, record: { version: 1, avatarUri: URI } });
      expect(concurrent).toMatchObject({ ok: false, record: { version: 1, avatarUri: URI } });

      const cleared = compareAndSwapProfileAvatar(database, {
        ...input,
        avatarUri: null,
        expectedVersion: 1,
      });
      expect(cleared).toMatchObject({ ok: true, record: { version: 2, avatarUri: null } });

      const replay = compareAndSwapProfileAvatar(database, input);
      expect(replay).toMatchObject({ ok: false, record: { version: 2, avatarUri: null } });
      expect(getProfileAvatar(database, CHAIN_ID, ADDRESS as `0x${string}`)).toMatchObject({
        version: 2,
        avatarUri: null,
      });
    } finally {
      database.close();
    }
  });

  it("normalizes mixed-case addresses at the SQLite boundary", () => {
    const database = new Database(":memory:");
    initSchema(database);
    const mixedCaseAddress = "0x1234567890aBcDeF1234567890AbCdEf12345678" as `0x${string}`;

    try {
      expect(
        compareAndSwapProfileAvatar(database, {
          chainId: CHAIN_ID,
          address: mixedCaseAddress,
          avatarUri: URI,
          expectedVersion: 0,
          updatedAt: new Date(NOW).toISOString(),
        })
      ).toMatchObject({
        ok: true,
        record: { address: ADDRESS, version: 1 },
      });
      expect(
        compareAndSwapProfileAvatar(database, {
          chainId: CHAIN_ID,
          address: ADDRESS as `0x${string}`,
          avatarUri: null,
          expectedVersion: 1,
          updatedAt: new Date(NOW + 1).toISOString(),
        })
      ).toMatchObject({
        ok: true,
        record: { address: ADDRESS, version: 2, avatarUri: null },
      });
      expect(getProfileAvatar(database, CHAIN_ID, mixedCaseAddress)).toMatchObject({
        address: ADDRESS,
        version: 2,
      });
      expect(getProfileAvatar(database, CHAIN_ID, ADDRESS as `0x${string}`)).toMatchObject({
        address: ADDRESS,
        version: 2,
      });
    } finally {
      database.close();
    }
  });

  it("does not allow a stale mutation to resurrect a clear tombstone", async () => {
    const { app } = createAvatarApp();
    await app.request(avatarUrl(), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(mutation()),
    });
    await app.request(avatarUrl(), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(mutation({ avatarUri: null, expectedVersion: 1 })),
    });

    const replay = await app.request(avatarUrl(), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(mutation()),
    });
    await expectErrorCode(replay, 409, "version_conflict");
  });

  it("rejects malformed URIs, unsupported chains, expired and future signatures", async () => {
    const { app } = createAvatarApp();
    const invalidUri = await app.request(avatarUrl(), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(mutation({ avatarUri: "ipfs://bafybeigdyrzt5q" })),
    });
    const wrongChain = await app.request(avatarUrl(ADDRESS, 1), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(mutation()),
    });
    const expired = await app.request(avatarUrl(), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(mutation({ issuedAt: Math.floor(NOW / 1000) - 301 })),
    });
    const future = await app.request(avatarUrl(), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(mutation({ issuedAt: Math.floor(NOW / 1000) + 31 })),
    });

    await expectErrorCode(invalidUri, 400, "invalid_request");
    await expectErrorCode(wrongChain, 400, "chain_unsupported");
    await expectErrorCode(expired, 400, "signature_expired");
    await expectErrorCode(future, 400, "signature_expired");
  });

  it("returns provider unavailable when avatar verification is not configured", async () => {
    const { app } = createAvatarApp({ configuredChainId: null });
    const response = await app.request(avatarUrl(), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(mutation()),
    });

    await expectErrorCode(response, 503, "provider_unavailable");
  });

  it("verifies a canonical EOA signature through the production verifier", async () => {
    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );
    const payload = mutation();
    const signature = await account.signMessage({
      message: buildProfileAvatarMessage({
        chainId: CHAIN_ID,
        address: account.address,
        avatarUri: payload.avatarUri,
        expectedVersion: payload.expectedVersion,
        issuedAt: payload.issuedAt,
      }),
    });
    const verificationClient = {
      call: vi.fn(async () => {
        throw new Error("EOA verification must not use RPC");
      }),
    };
    const { app } = createAvatarApp({
      verify: vi.fn(
        createViemProfileAvatarSignatureVerifier({
          chain: arbitrum,
          rpcUrl: "http://unused.invalid",
          client: verificationClient,
        })
      ),
    });

    const response = await app.request(avatarUrl(account.address), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ ...payload, signature }),
    });

    expect(response.status).toBe(200);
    expect(verificationClient.call).not.toHaveBeenCalled();
  });

  it("distinguishes invalid smart-account signatures from RPC failures", async () => {
    const healthyClient = {
      call: vi.fn(async () => ({ data: "0x0" as const })),
    };
    const forged = createAvatarApp({
      verify: vi.fn(
        createViemProfileAvatarSignatureVerifier({
          chain: arbitrum,
          rpcUrl: "http://unused.invalid",
          client: healthyClient,
        })
      ),
    });
    const forgedResponse = await forged.app.request(avatarUrl(), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(mutation()),
    });
    await expectErrorCode(forgedResponse, 401, "signature_invalid");
    expect(healthyClient.call).toHaveBeenCalledTimes(1);

    const emptyClient = {
      call: vi.fn(async () => ({ data: "0x" as const })),
    };
    const empty = createAvatarApp({
      verify: vi.fn(
        createViemProfileAvatarSignatureVerifier({
          chain: arbitrum,
          rpcUrl: "http://unused.invalid",
          client: emptyClient,
        })
      ),
    });
    const emptyResponse = await empty.app.request(avatarUrl(), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(mutation()),
    });
    await expectErrorCode(emptyResponse, 401, "signature_invalid");
    expect(emptyClient.call).toHaveBeenCalledTimes(1);

    const revertedClient = {
      call: vi.fn(async () => {
        throw new CallExecutionError(new ExecutionRevertedError(), { data: "0x" });
      }),
    };
    const reverted = createAvatarApp({
      verify: vi.fn(
        createViemProfileAvatarSignatureVerifier({
          chain: arbitrum,
          rpcUrl: "http://unused.invalid",
          client: revertedClient,
        })
      ),
    });
    const revertedResponse = await reverted.app.request(avatarUrl(), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(mutation()),
    });
    await expectErrorCode(revertedResponse, 401, "signature_invalid");

    const unavailableClient = {
      call: vi.fn(async () => {
        throw new CallExecutionError(new BaseError("rpc unavailable"), { data: "0x" });
      }),
    };
    const unavailable = createAvatarApp({
      verify: vi.fn(
        createViemProfileAvatarSignatureVerifier({
          chain: arbitrum,
          rpcUrl: "http://unused.invalid",
          client: unavailableClient,
        })
      ),
    });
    const unavailableResponse = await unavailable.app.request(avatarUrl(), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(mutation()),
    });
    await expectErrorCode(unavailableResponse, 503, "provider_unavailable");
    expect(unavailableClient.call).toHaveBeenCalledTimes(1);
  });

  it("uses the production validator call for deployed and counterfactual smart accounts", async () => {
    const verificationClient = {
      call: vi.fn(async () => ({ data: "0x1" as const })),
    };
    const verify = createViemProfileAvatarSignatureVerifier({
      chain: arbitrum,
      rpcUrl: "http://unused.invalid",
      client: verificationClient,
    });
    const input = {
      chainId: CHAIN_ID,
      address: OTHER_ADDRESS as `0x${string}`,
      message: "signed avatar message",
      signature: "0x1234" as const,
    };

    await expect(verify(input)).resolves.toBe(true);
    await expect(
      verify({
        ...input,
        factory: "0x1111111111111111111111111111111111111111",
        factoryData: "0xabcdef",
      })
    ).resolves.toBe(true);

    expect(verificationClient.call).toHaveBeenCalledTimes(2);
    const deployedCallData = verificationClient.call.mock.calls[0]?.[0].data;
    const counterfactualCallData = verificationClient.call.mock.calls[1]?.[0].data;
    expect(counterfactualCallData).not.toBe(deployedCallData);
    expect(counterfactualCallData).toContain("1111111111111111111111111111111111111111");
    expect(counterfactualCallData).toContain("abcdef");
  });

  it("passes EOA and ERC-1271/ERC-6492 inputs to the injected verifier", async () => {
    const verify = vi.fn(async () => true);
    const { app } = createAvatarApp({ verify });
    const response = await app.request(avatarUrl(OTHER_ADDRESS), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(
        mutation({
          factory: "0x1111111111111111111111111111111111111111",
          factoryData: "0xabcdef",
        })
      ),
    });

    expect(response.status).toBe(200);
    expect(verify).toHaveBeenCalledWith(
      expect.objectContaining({
        address: OTHER_ADDRESS,
        factory: "0x1111111111111111111111111111111111111111",
        factoryData: "0xabcdef",
      })
    );
  });

  it("enforces the trusted origin and fixed read/mutation limits", async () => {
    const { app } = createAvatarApp();
    const rejectedOrigin = await app.request(avatarUrl(), {
      headers: { origin: "https://example.invalid" },
    });
    await expectErrorCode(rejectedOrigin, 403, "origin_not_allowed");

    for (let index = 0; index < 10; index += 1) {
      const response = await app.request(avatarUrl(`${ADDRESS.slice(0, -1)}${index}`), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(mutation()),
      });
      expect(response.status).toBe(200);
    }
    const limitedMutation = await app.request(avatarUrl(), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(mutation()),
    });
    await expectErrorCode(limitedMutation, 429, "rate_limited");

    for (let index = 0; index < 120; index += 1) {
      expect((await app.request(avatarUrl(), { headers: { origin: ORIGIN } })).status).toBe(200);
    }
    await expectErrorCode(
      await app.request(avatarUrl(), { headers: { origin: ORIGIN } }),
      429,
      "rate_limited"
    );
  });
});
