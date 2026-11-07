import type { Database } from "bun:sqlite";
import {
  PASSKEY_DISPLAY_NAMES_BATCH_LIMIT,
  PASSKEY_DISPLAY_NAMES_METHOD,
  PUBLIC_AGENT_ROUTES,
} from "@green-goods/shared/public-contracts";
import { BaseError } from "viem";
import { arbitrum } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { InMemoryPublicRateLimiter, PUBLIC_RATE_LIMIT_POLICIES } from "../api/public-protection";
import { createServer } from "../api/server";
import { closeDB, initDB } from "../services/db";
import { loggers } from "../services/logger";
import {
  createPasskeyDirectory,
  type HostedPasskeyNameCheck,
  type PasskeyDirectoryDeps,
} from "../services/passkey-directory";
import {
  createHostedPasskeyLookup,
  createSqlitePasskeyDirectoryStore,
  createSqlitePasskeyDisplayNames,
  MemoryPasskeyDirectoryStore,
} from "../services/passkey-directory-adapters";
import { passkeyDirectoryStoreContract } from "./test-utils/passkey-directory-store-contract";
import {
  createSoftwarePasskeyRegistration,
  type SoftwarePasskeyOptions,
} from "./test-utils/software-passkey";

const DOMAIN = "greengoods.app";
const BETA = "https://beta.greengoods.app";
const WWW = "https://www.greengoods.app";
const ADMIN = "https://admin.greengoods.app";
const PREVIEW = "https://green-goods-git-some-branch-greenpilldevguild.vercel.app";
const LOCALHOST = "http://localhost:3001";
const LOOPBACK_ADDRESS = "http://127.0.0.1:3001";
const NOW = 1_759_600_000_000;

function createDirectoryApp(
  options: {
    hostedNameTaken?: HostedPasskeyNameCheck;
    allowLocalDevelopment?: boolean;
    displayNames?: PasskeyDirectoryDeps["displayNames"];
    store?: PasskeyDirectoryDeps["store"];
  } = {}
) {
  let now = NOW;
  const store = options.store ?? new MemoryPasskeyDirectoryStore();
  const app = createServer({
    isAIReady: () => true,
    allowedOrigins: new Set([
      BETA,
      "https://beta.admin.greengoods.app",
      WWW,
      ADMIN,
      LOCALHOST,
      LOOPBACK_ADDRESS,
    ]),
    publicRateLimiter: new InMemoryPublicRateLimiter(),
    passkeyDirectory: createPasskeyDirectory({
      store,
      relyingParty: { id: DOMAIN, name: "Green Goods" },
      hostedNameTaken: options.hostedNameTaken,
      displayNames: options.displayNames,
      allowLocalDevelopment: options.allowLocalDevelopment,
      now: () => now,
    }),
    now: () => now,
  });
  return {
    app,
    store,
    advance(ms: number) {
      now += ms;
    },
  };
}

type RpcBody = {
  result?: any;
  error?: { code: number; message: string };
};

async function call(
  app: ReturnType<typeof createServer>,
  method: string,
  params: unknown[],
  origin = BETA
): Promise<RpcBody> {
  const response = await app.request(PUBLIC_AGENT_ROUTES.passkeyDirectory, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as RpcBody;
}

/** Sign up the way the app does: ask for options, create the passkey, hand it back. */
async function signUp(
  app: ReturnType<typeof createServer>,
  userName: string,
  options: {
    origin?: string;
    passkey?: Partial<SoftwarePasskeyOptions>;
    accountProfileVersion?: number;
  } = {}
) {
  const origin = options.origin ?? BETA;
  const context = {
    userName,
    ...(options.accountProfileVersion === undefined
      ? {}
      : { accountProfileVersion: options.accountProfileVersion }),
  };
  const start = await call(app, "pks_startRegistration", [context], origin);
  const passkey = createSoftwarePasskeyRegistration({
    rpId: DOMAIN,
    origin,
    challenge: start.result?.challenge,
    ...options.passkey,
  });
  const verify = await call(app, "pks_verifyRegistration", [passkey.credential, context], origin);
  return { start, passkey, verify };
}

describe("passkey directory", () => {
  it("keeps hosted credential discovery read-only and ignores previously cached labels", async () => {
    const address = "0x1111111111111111111111111111111111111111";
    const sqlite = Reflect.get(initDB(":memory:"), "db") as Database;
    try {
      // An older Agent could have written this row from an unauthenticated lookup.
      sqlite.run(`CREATE TABLE hosted_passkey_display_names (
        chainId INTEGER NOT NULL, address TEXT NOT NULL, userName TEXT NOT NULL,
        PRIMARY KEY (chainId, address, userName)
      )`);
      sqlite
        .query("INSERT INTO hosted_passkey_display_names VALUES (?, ?, ?)")
        .run(arbitrum.id, address, "maya");
      const hostedNameTaken = vi.fn(async () => true);
      const { app } = createDirectoryApp({
        store: createSqlitePasskeyDirectoryStore(),
        displayNames: createSqlitePasskeyDisplayNames(arbitrum, "http://127.0.0.1:1"),
        hostedNameTaken,
      });

      await expect(
        call(app, "pks_getCredentials", [{ userName: " @MAYA " }], WWW)
      ).resolves.toMatchObject({ result: [] });
      expect(hostedNameTaken).not.toHaveBeenCalled();
      await expect(
        call(
          app,
          PASSKEY_DISPLAY_NAMES_METHOD,
          [{ chainId: arbitrum.id, addresses: [address] }],
          WWW
        )
      ).resolves.toMatchObject({ result: [null] });
      expect(sqlite.query("SELECT userName FROM hosted_passkey_display_names").all()).toEqual([
        { userName: "maya" },
      ]);
    } finally {
      await closeDB();
    }
  });

  it("serves only labels for requested addresses and validates the lookup batch", async () => {
    const maya = "0x1111111111111111111111111111111111111111";
    const unknown = "0x2222222222222222222222222222222222222222";
    const { app } = createDirectoryApp({
      displayNames: {
        chainId: 42161,
        lookup: async (addresses) => addresses.map((address) => (address === maya ? "maya" : null)),
      },
    });
    await expect(
      call(app, PASSKEY_DISPLAY_NAMES_METHOD, [{ chainId: 42161, addresses: [unknown, maya] }], WWW)
    ).resolves.toMatchObject({ result: [null, "maya"] });
    await expect(
      call(app, PASSKEY_DISPLAY_NAMES_METHOD, [{ chainId: 42220, addresses: [maya] }])
    ).resolves.toMatchObject({ result: [null] });
    for (const addresses of [
      ["invalid"],
      Array(PASSKEY_DISPLAY_NAMES_BATCH_LIMIT + 1).fill(maya),
    ]) {
      await expect(
        call(app, PASSKEY_DISPLAY_NAMES_METHOD, [{ chainId: 42161, addresses }])
      ).resolves.toMatchObject({ error: { code: -32602 } });
    }
  });

  it("logs a safe display-name failure category without exposing provider details", async () => {
    const warn = vi.spyOn(loggers.api, "warn").mockImplementation(() => undefined);
    try {
      const { app } = createDirectoryApp({
        displayNames: {
          chainId: 42161,
          async lookup() {
            throw new BaseError("https://rpc.example/private-token");
          },
        },
      });
      await expect(
        call(app, PASSKEY_DISPLAY_NAMES_METHOD, [
          { chainId: 42161, addresses: ["0x1111111111111111111111111111111111111111"] },
        ])
      ).resolves.toMatchObject({
        error: { code: -32603, message: "Passkey sign-up is unavailable right now." },
      });

      expect(warn.mock.calls).toEqual([
        [{ reason: "chain_client_error" }, "Could not look up passkey display names"],
      ]);
    } finally {
      warn.mockRestore();
    }
  });

  it("rejects an attested empty credential ID even when the browser envelope supplies an ID", async () => {
    const { app, store } = createDirectoryApp();
    const { verify } = await signUp(app, "maya", {
      accountProfileVersion: 1,
      passkey: { emptyAttestedCredentialId: true },
    });

    expect(verify.error?.message).toBe("Passkey verification failed.");
    expect(await store.findByName("maya")).toBeUndefined();
  });

  it.each([
    [BETA, "kernel-0.3.3"],
    ["https://beta.admin.greengoods.app", "kernel-0.3.3"],
    [WWW, "kernel-0.3.1-legacy"],
    [ADMIN, "kernel-0.3.1-legacy"],
  ])("pins new account profiles at registration on %s", async (origin, accountProfile) => {
    const { app, store } = createDirectoryApp();
    const { start, verify } = await signUp(app, "ana", { origin, accountProfileVersion: 1 });
    expect(start.result.accountProfile).toBe(accountProfile);
    expect(verify.result.accountProfile).toBe(accountProfile);
    expect(await store.findByName("ana")).toMatchObject({ accountProfile });
    for (const otherOrigin of [BETA, WWW]) {
      const found = await call(
        app,
        "pks_getCredentials",
        [{ userName: "ana", accountProfileVersion: 1 }],
        otherOrigin
      );
      expect(found.result[0].accountProfile).toBe(accountProfile);
    }
    if (accountProfile === "kernel-0.3.3") {
      const oldClient = await call(app, "pks_getCredentials", [{ userName: "ana" }], WWW);
      expect(oldClient.error?.message).toBe("Update Green Goods to sign in to this account.");
    }
  });

  it("keeps older beta clients on their original recipe and binds the profile to the challenge", async () => {
    const { app, store } = createDirectoryApp();
    await signUp(app, "older-client");
    expect(await store.findByName("older-client")).toMatchObject({
      accountProfile: "kernel-0.3.1-legacy",
    });
    const start = await call(app, "pks_startRegistration", [
      { userName: "ana", accountProfileVersion: 1 },
    ]);
    const passkey = createSoftwarePasskeyRegistration({
      rpId: DOMAIN,
      origin: BETA,
      challenge: start.result.challenge,
    });
    const downgraded = await call(app, "pks_verifyRegistration", [
      passkey.credential,
      { userName: "ana" },
    ]);
    expect(downgraded.error).toBeDefined();
    expect(await store.findByName("ana")).toBeUndefined();
  });

  it("issues one domain to every site, so a passkey made on one is found from another", async () => {
    const { app } = createDirectoryApp();

    const { start, passkey, verify } = await signUp(app, "ana");

    expect(start.result.rp).toEqual({ id: DOMAIN, name: "Green Goods" });
    expect(start.result.authenticatorSelection).toMatchObject({
      authenticatorAttachment: "platform",
      requireResidentKey: false,
      userVerification: "required",
    });
    expect(verify.result).toEqual({
      accountProfile: "kernel-0.3.1-legacy",
      success: true,
      id: passkey.credentialId,
      publicKey: passkey.publicKey,
      userName: "ana",
    });
    for (const origin of [WWW, ADMIN]) {
      const found = await call(app, "pks_getCredentials", [{ userName: "ana" }], origin);
      expect(found.result).toEqual([
        {
          id: passkey.credentialId,
          signingId: passkey.credentialId,
          publicKey: passkey.publicKey,
          rpId: DOMAIN,
          accountProfile: "kernel-0.3.1-legacy",
        },
      ]);
    }
  });

  it("holds a name for its first owner, however it is spelled", async () => {
    const { app } = createDirectoryApp();
    const first = await signUp(app, "Ana");

    const again = await call(app, "pks_startRegistration", [{ userName: " @ANA " }], WWW);

    expect(again.error?.message).toBe("That name is already registered.");
    const found = await call(app, "pks_getCredentials", [{ userName: "@ana" }]);
    expect(found.result).toEqual([
      {
        id: first.passkey.credentialId,
        signingId: first.passkey.credentialId,
        publicKey: first.passkey.publicKey,
        rpId: DOMAIN,
        accountProfile: "kernel-0.3.1-legacy",
      },
    ]);
    expect((await call(app, "pks_startRegistration", [{ userName: "ab" }])).error?.code).toBe(
      -32602
    );
  });

  it("refuses a name the hosted server already holds, and refuses when it cannot ask", async () => {
    const held = createDirectoryApp({ hostedNameTaken: async (name) => name === "dida" });
    expect(
      (await call(held.app, "pks_startRegistration", [{ userName: "dida" }])).error?.message
    ).toBe("That name is already registered.");
    expect(
      (await call(held.app, "pks_startRegistration", [{ userName: "novo" }])).result?.rp.id
    ).toBe(DOMAIN);

    const unreachable = createDirectoryApp({
      hostedNameTaken: async () => {
        throw new Error("hosted server down");
      },
    });
    const refused = await call(unreachable.app, "pks_startRegistration", [{ userName: "novo" }]);
    expect(refused.error).toEqual({
      code: -32603,
      message: "Passkey sign-up is unavailable right now.",
    });
  });

  it.each([
    ["was made for another domain", { rpId: "beta.greengoods.app" }],
    ["reports another page", { origin: WWW }],
    ["skipped user verification", { userVerified: false }],
    ["uses a key the account cannot verify", { algorithm: -35 }],
  ] as const)("stores nothing when the passkey %s", async (_reason, passkey) => {
    const { app, store } = createDirectoryApp();

    const { verify } = await signUp(app, "ana", { passkey });

    expect(verify.error).toEqual({ code: -32000, message: "Passkey verification failed." });
    expect(await store.findByName("ana")).toBeUndefined();
  });

  it("accepts each sign-up attempt once, and only for five minutes", async () => {
    const reused = createDirectoryApp();
    const { passkey } = await signUp(reused.app, "ana");
    const replay = await call(reused.app, "pks_verifyRegistration", [
      passkey.credential,
      { userName: "ana" },
    ]);
    expect(replay.error?.message).toBe("Passkey verification expired. Start again.");

    const slow = createDirectoryApp();
    const start = await call(slow.app, "pks_startRegistration", [{ userName: "bea" }]);
    slow.advance(5 * 60 * 1000);
    const late = await call(slow.app, "pks_verifyRegistration", [
      createSoftwarePasskeyRegistration({
        rpId: DOMAIN,
        origin: BETA,
        challenge: start.result.challenge,
      }).credential,
      { userName: "bea" },
    ]);
    expect(late.error?.message).toBe("Passkey verification expired. Start again.");
    expect(await slow.store.findByName("bea")).toBeUndefined();
  });

  it.each([
    "https://unapproved.greengoods.app",
    PREVIEW,
    "https://beta.greengoods.app:444",
    "http://beta.greengoods.app",
    "https://example.com",
    "",
  ])("refuses every directory call and preflight from an unlisted site: %s", async (origin) => {
    const { app } = createDirectoryApp();
    for (const method of [
      "pks_startRegistration",
      "pks_verifyRegistration",
      "pks_getCredentials",
    ]) {
      const response = await app.request(PUBLIC_AGENT_ROUTES.passkeyDirectory, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [{}] }),
      });
      expect(response.status).toBe(403);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    }
    const preflight = await app.request(PUBLIC_AGENT_ROUTES.passkeyDirectory, {
      method: "OPTIONS",
      headers: { origin, "access-control-request-method": "POST" },
    });
    expect(preflight.status).toBe(403);
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("uses the router's decoded path when refusing an unlisted preview", async () => {
    const { app } = createDirectoryApp();
    const response = await app.request("/public/passkeys/%72pc", {
      method: "POST",
      headers: { origin: PREVIEW, "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "pks_getCredentials", params: [{}] }),
    });
    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("requires the listed site's passkey domain, with localhost only in development", async () => {
    const { app } = createDirectoryApp();

    const unlisted = await app.request(PUBLIC_AGENT_ROUTES.passkeyDirectory, {
      method: "POST",
      headers: { origin: "https://example.com", "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "pks_getCredentials", params: [{}] }),
    });
    expect(unlisted.status).toBe(403);

    const local = await call(app, "pks_startRegistration", [{ userName: "ana" }], LOCALHOST);
    expect(local.error?.message).toBe("Passkeys are not available from this origin.");

    const development = createDirectoryApp({ allowLocalDevelopment: true });
    const localDev = await call(
      development.app,
      "pks_startRegistration",
      [{ userName: "ana" }],
      LOCALHOST
    );
    expect(localDev.result.rp.id).toBe("localhost");
    // A browser cannot create a passkey on an address, so local development means `localhost`.
    const loopback = await call(
      development.app,
      "pks_startRegistration",
      [{ userName: "ana" }],
      LOOPBACK_ADDRESS
    );
    expect(loopback.error?.message).toBe("Passkeys are not available from this origin.");
  });

  it("answers the preflight and reports malformed calls as JSON-RPC errors", async () => {
    const { app } = createDirectoryApp();

    const preflight = await app.request(PUBLIC_AGENT_ROUTES.passkeyDirectory, {
      method: "OPTIONS",
      headers: { origin: BETA, "access-control-request-method": "POST" },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(BETA);

    expect((await call(app, "pks_startAuthentication", [])).error?.code).toBe(-32601);
    const malformed = await app.request(PUBLIC_AGENT_ROUTES.passkeyDirectory, {
      method: "POST",
      headers: { origin: BETA, "content-type": "application/json" },
      body: JSON.stringify({ method: "pks_getCredentials" }),
    });
    expect((await malformed.json()).error.code).toBe(-32600);
    expect((await call(app, "pks_getCredentials", [{ userName: 7 }])).result).toEqual([]);
    const garbage = await call(app, "pks_verifyRegistration", [{ id: "x" }, { userName: "ana" }]);
    expect(garbage.error?.message).toBe("Passkey verification failed.");
  });

  it.each([
    ["pks_startRegistration", "passkey_registration"],
    ["pks_getCredentials", "passkey_lookup"],
  ] as const)("keeps the %s peer budget across names and Origin headers", async (method, route) => {
    const { app, advance } = createDirectoryApp();
    const { limit, windowMs } = PUBLIC_RATE_LIMIT_POLICIES[route];
    for (let attempt = 0; attempt < limit; attempt += 1) {
      const origin = attempt % 2 === 0 ? BETA : WWW;
      // A valid name must not share the aggregate bucket's internal material.
      const userName = attempt === 0 ? "all-names" : `name-${attempt}`;
      expect((await call(app, method, [{ userName }], origin)).error).toBeUndefined();
    }

    const blocked = await call(app, method, [{ userName: "one-more" }], BETA);

    expect(blocked.error).toEqual({
      code: -32000,
      message: "Too many requests. Please try again later.",
    });
    // Origin-independent budgets still reset, so the group can recover after the window.
    advance(windowMs);
    expect((await call(app, method, [{ userName: "one-more" }], BETA)).error).toBeUndefined();
  });
});

describe("hosted passkey lookup", () => {
  it("asks the hosted server by name and preserves its exact IDs", async () => {
    const requests: Array<{ url: string; origin: string | null; body: any }> = [];
    const hosted = createHostedPasskeyLookup({
      rpcUrl: "https://hosted.example/rpc?apikey=test",
      origin: "https://greengoods.app",
      fetch: (async (url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        requests.push({ url, origin: new Headers(init.headers).get("origin"), body });
        const held = body.params[0].userName === "dida";
        return Response.json({ jsonrpc: "2.0", id: 1, result: held ? [{ id: "a" }] : [] });
      }) as unknown as typeof fetch,
    });

    expect(await hosted("dida")).toEqual([{ id: "a" }]);
    expect(await hosted("novo")).toEqual([]);
    expect(requests[0]).toEqual({
      url: "https://hosted.example/rpc?apikey=test",
      origin: "https://greengoods.app",
      body: { jsonrpc: "2.0", id: 1, method: "pks_getCredentials", params: [{ userName: "dida" }] },
    });
  });

  it("fails instead of guessing when the hosted server gives no answer", async () => {
    const refusing = createHostedPasskeyLookup({
      rpcUrl: "https://hosted.example/rpc",
      origin: "https://greengoods.app",
      fetch: (async () =>
        Response.json({
          jsonrpc: "2.0",
          id: 1,
          error: { message: "Origin header is missing" },
        })) as unknown as typeof fetch,
    });
    const failing = createHostedPasskeyLookup({
      rpcUrl: "https://hosted.example/rpc",
      origin: "https://greengoods.app",
      fetch: (async () => new Response("bad gateway", { status: 502 })) as unknown as typeof fetch,
    });

    // A transport error can quote the address, which carries the API key.
    const unreachable = createHostedPasskeyLookup({
      rpcUrl: "https://hosted.example/rpc?apikey=secret-key",
      origin: "https://greengoods.app",
      fetch: (async () => {
        const error = new Error(
          "Unable to connect to https://hosted.example/rpc?apikey=secret-key"
        );
        error.name = "ConnectionRefused";
        throw error;
      }) as unknown as typeof fetch,
    });

    await expect(refusing("dida")).rejects.toThrow("returned no result");
    await expect(failing("dida")).rejects.toThrow("answered 502");
    const failure = await unreachable("dida").catch((error: Error) => error);
    expect(failure).toMatchObject({
      message: "Hosted passkey lookup could not connect (ConnectionRefused)",
    });
    expect(JSON.stringify(failure, Object.getOwnPropertyNames(failure))).not.toContain(
      "secret-key"
    );
  });
});

passkeyDirectoryStoreContract(
  "memory passkey directory store",
  () => new MemoryPasskeyDirectoryStore()
);
