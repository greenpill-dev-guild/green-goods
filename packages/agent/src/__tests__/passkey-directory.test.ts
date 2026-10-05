import { PUBLIC_AGENT_ROUTES } from "@green-goods/shared/public-contracts";
import { describe, expect, it } from "vitest";
import { InMemoryPublicRateLimiter, PUBLIC_RATE_LIMIT_POLICIES } from "../api/public-protection";
import { createServer } from "../api/server";
import { createPasskeyDirectory, type HostedPasskeyNameCheck } from "../services/passkey-directory";
import {
  createHostedPasskeyNameCheck,
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
const PREVIEW = "https://green-goods-git-some-branch-greenpilldevguild.vercel.app";
const LOCALHOST = "http://localhost:3001";
const NOW = 1_759_600_000_000;

function createDirectoryApp(
  options: { hostedNameTaken?: HostedPasskeyNameCheck; allowLocalDevelopment?: boolean } = {}
) {
  let now = NOW;
  const store = new MemoryPasskeyDirectoryStore();
  const app = createServer({
    isAIReady: () => true,
    allowedOrigins: new Set([BETA, WWW, LOCALHOST]),
    publicRateLimiter: new InMemoryPublicRateLimiter(),
    passkeyDirectory: createPasskeyDirectory({
      store,
      relyingParty: { id: DOMAIN, name: "Green Goods" },
      hostedNameTaken: options.hostedNameTaken,
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
  options: { origin?: string; passkey?: Partial<SoftwarePasskeyOptions> } = {}
) {
  const origin = options.origin ?? BETA;
  const start = await call(app, "pks_startRegistration", [{ userName }], origin);
  const passkey = createSoftwarePasskeyRegistration({
    rpId: DOMAIN,
    origin,
    challenge: start.result?.challenge,
    ...options.passkey,
  });
  const verify = await call(
    app,
    "pks_verifyRegistration",
    [passkey.credential, { userName }],
    origin
  );
  return { start, passkey, verify };
}

describe("passkey directory", () => {
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
      success: true,
      id: passkey.credentialId,
      publicKey: passkey.publicKey,
      userName: "ana",
    });
    const found = await call(app, "pks_getCredentials", [{ userName: "ana" }], WWW);
    expect(found.result).toEqual([
      { id: passkey.credentialId, publicKey: passkey.publicKey, rpId: DOMAIN },
    ]);
  });

  it("holds a name for its first owner, however it is spelled", async () => {
    const { app } = createDirectoryApp();
    const first = await signUp(app, "Ana");

    const again = await call(app, "pks_startRegistration", [{ userName: " @ANA " }], WWW);

    expect(again.error?.message).toBe("That name is already registered.");
    const found = await call(app, "pks_getCredentials", [{ userName: "@ana" }]);
    expect(found.result).toEqual([
      { id: first.passkey.credentialId, publicKey: first.passkey.publicKey, rpId: DOMAIN },
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

  it("answers only sites under its own domain", async () => {
    const { app } = createDirectoryApp();

    const unlisted = await app.request(PUBLIC_AGENT_ROUTES.passkeyDirectory, {
      method: "POST",
      headers: { origin: "https://example.com", "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "pks_getCredentials", params: [{}] }),
    });
    expect(unlisted.status).toBe(403);

    // A preview deployment may call the agent, but a browser would never let it use the domain.
    const preview = await call(app, "pks_startRegistration", [{ userName: "ana" }], PREVIEW);
    expect(preview.error?.message).toBe("Passkeys are not available from this origin.");
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

  it("stops registrations from one address past the limit, with a code clients do not retry", async () => {
    const { app } = createDirectoryApp();
    const { limit } = PUBLIC_RATE_LIMIT_POLICIES.passkey_registration;
    for (let attempt = 0; attempt < limit; attempt += 1) {
      await call(app, "pks_startRegistration", [{ userName: `name-${attempt}` }]);
    }

    const blocked = await call(app, "pks_startRegistration", [{ userName: "one-more" }]);

    expect(blocked.error).toEqual({
      code: -32000,
      message: "Too many requests. Please try again later.",
    });
  });
});

describe("hosted passkey name check", () => {
  it("asks the hosted server by name and reports whether it holds one", async () => {
    const requests: Array<{ url: string; origin: string | null; body: any }> = [];
    const hosted = createHostedPasskeyNameCheck({
      rpcUrl: "https://hosted.example/rpc?apikey=test",
      origin: "https://greengoods.app",
      fetch: (async (url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        requests.push({ url, origin: new Headers(init.headers).get("origin"), body });
        const held = body.params[0].userName === "dida";
        return Response.json({ jsonrpc: "2.0", id: 1, result: held ? [{ id: "a" }] : [] });
      }) as unknown as typeof fetch,
    });

    expect(await hosted("dida")).toBe(true);
    expect(await hosted("novo")).toBe(false);
    expect(requests[0]).toEqual({
      url: "https://hosted.example/rpc?apikey=test",
      origin: "https://greengoods.app",
      body: { jsonrpc: "2.0", id: 1, method: "pks_getCredentials", params: [{ userName: "dida" }] },
    });
  });

  it("fails instead of guessing when the hosted server gives no answer", async () => {
    const refusing = createHostedPasskeyNameCheck({
      rpcUrl: "https://hosted.example/rpc",
      origin: "https://greengoods.app",
      fetch: (async () =>
        Response.json({
          jsonrpc: "2.0",
          id: 1,
          error: { message: "Origin header is missing" },
        })) as unknown as typeof fetch,
    });
    const failing = createHostedPasskeyNameCheck({
      rpcUrl: "https://hosted.example/rpc",
      origin: "https://greengoods.app",
      fetch: (async () => new Response("bad gateway", { status: 502 })) as unknown as typeof fetch,
    });

    // A transport error can quote the address, which carries the API key.
    const unreachable = createHostedPasskeyNameCheck({
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
