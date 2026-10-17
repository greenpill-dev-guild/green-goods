// Local stand-in for the Green Goods sites and a prototype of directory adoption.
//
// - A CONNECT proxy on 127.0.0.1:47080 sends every https request for greengoods.app and its
//   subdomains to one TLS server, so pages and the browser's own /.well-known fetch keep their
//   real hostnames and the default port. Nothing else is proxied.
// - The TLS server on 127.0.0.1:47443 serves the page bundle, /.well-known/webauthn (switchable),
//   and three directory calls: challenge, adopt, lookup.
// - A control server on 127.0.0.1:47081 lets the runner switch the related-origins file and read
//   the logs.
import net from "node:net";
import { resolve } from "node:path";

const RIG = import.meta.dir;
const REPO = resolve(RIG, "../../../../..");
// The throwaway TLS key stays outside the repository (see README.md).
const CERTS = process.env.RIG_CERT_DIR;
if (!CERTS) throw new Error("Set RIG_CERT_DIR to the folder holding key.pem, cert.pem and spki.txt");
const SHARED_SRC = `${REPO}/packages/shared/src`;
// Resolved the way the agent loads it in production: ESM under Bun, from the agent package.
const AGENT_DIR = `${REPO}/packages/agent`;
const { verifyAuthenticationResponse } = await import(Bun.resolveSync("@simplewebauthn/server", AGENT_DIR));
const { isoCBOR, cose } = await import(Bun.resolveSync("@simplewebauthn/server/helpers", AGENT_DIR));
const { verifyPasskeyAssertion } = await import(`${SHARED_SRC}/modules/auth/passkey-assertion.ts`);

const ENV = {
  DEV: false,
  PROD: true,
  MODE: "production",
  BASE_URL: "/",
  VITE_CHAIN_ID: "42161",
  VITE_DEBUG_MODE: "false",
  VITE_PASSKEY_RP_ID: "",
  VITE_PASSKEY_SERVER_ENABLED: "",
  VITE_API_BASE_URL: "",
};

const build = await Bun.build({
  entrypoints: [`${RIG}/page.ts`],
  target: "browser",
  format: "esm",
  minify: false,
  define: { __GG_ENV__: JSON.stringify(ENV) },
  plugins: [
    {
      name: "rig-resolution",
      setup(builder) {
        // The page lives outside the repo; its bare imports resolve as Shared's would.
        builder.onResolve({ filter: /^[^./]/ }, (args) =>
          args.importer.startsWith(RIG)
            ? { path: Bun.resolveSync(args.path, SHARED_SRC) }
            : undefined
        );
        // Shared reads Vite's import.meta.env; hand it a fixed production env instead.
        builder.onLoad({ filter: /packages\/shared\/src\/.*\.tsx?$/ }, async (args) => ({
          contents: (await Bun.file(args.path).text()).replaceAll("import.meta.env", "__GG_ENV__"),
          loader: args.path.endsWith(".tsx") ? "tsx" : "ts",
        }));
      },
    },
  ],
});
if (!build.success) {
  for (const log of build.logs) console.error(log);
  process.exit(1);
}
const bundle = await build.outputs[0].text();

type Mode = "off" | "on" | "admin-only";
const MODES: readonly Mode[] = ["off", "on", "admin-only"];
let mode: Mode = "off";
const wellKnownHits: { host: string; mode: Mode; served: boolean }[] = [];
const proxyLog: string[] = [];

const ALL_ORIGINS = [
  "https://greengoods.app",
  "https://www.greengoods.app",
  "https://beta.greengoods.app",
  "https://admin.greengoods.app",
  "https://beta.admin.greengoods.app",
];
/** Domains a passkey may already carry: the shared one, and the hosts the hosted server issued. */
const ADOPTABLE_RP_IDS = new Set([
  "greengoods.app",
  "www.greengoods.app",
  "beta.greengoods.app",
  "staging.greengoods.app",
]);
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type Entry = {
  id: string;
  publicKey: `0x${string}`;
  rpId: string;
  origin: string;
  signingId?: string;
  /** The credential's bytes in base64url, whatever spelling `id` uses. */
  credentialKey: string;
};
const entries = new Map<string, Entry>();
/**
 * Who holds a credential, keyed by its ID bytes and public key together. `rawId` sits outside the
 * assertion's signature, so ID bytes alone are whatever the client claims; only the pair is bound
 * to a proven key.
 */
const byCredential = new Map<string, string>();
const credentialPair = (credentialKey: string, publicKey: string) =>
  `${credentialKey}|${publicKey.toLowerCase().replace(/^0x/, "").replace(/^04(?=[\da-f]{128}$)/, "")}`;
const pending = new Map<string, number>();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const normalizeName = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

/**
 * Every byte sequence a stored credential ID can stand for. An even-length all-hex string is
 * also valid base64url, so both readings are kept, as `getPasskeyRequestIds` does in the app.
 */
function credentialIdReadings(id: string): Uint8Array[] {
  const readings = [Uint8Array.from(Buffer.from(id, "base64url"))];
  const hex = id.replace(/^0x/, "");
  if (hex.length > 0 && hex.length % 2 === 0 && /^[\da-f]+$/i.test(hex)) {
    readings.unshift(Uint8Array.from(hex.match(/.{2}/g)!, (byte) => parseInt(byte, 16)));
  }
  return readings;
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

/** The directory stores 0x04 || x || y; the library verifies against a COSE EC2 key. */
function coseKey(publicKey: string): Uint8Array {
  const hex = publicKey.replace(/^0x/, "").replace(/^04(?=[\da-f]{128}$)/i, "");
  const bytes = Buffer.from(hex, "hex");
  return isoCBOR.encode(
    new Map<number, number | Uint8Array>([
      [cose.COSEKEYS.kty, cose.COSEKTY.EC2],
      [cose.COSEKEYS.alg, cose.COSEALG.ES256],
      [cose.COSEKEYS.crv, cose.COSECRV.P256],
      [cose.COSEKEYS.x, new Uint8Array(bytes.subarray(0, 32))],
      [cose.COSEKEYS.y, new Uint8Array(bytes.subarray(32, 64))],
    ])
  );
}

async function adopt(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  if (!ALL_ORIGINS.includes(origin)) return json({ ok: false, code: "origin_not_allowed" });
  const body = (await request.json()) as {
    userName?: string;
    credentialId?: string;
    publicKey?: `0x${string}`;
    rpId?: string;
    response?: { id: string; rawId: string; response: { clientDataJSON: string } };
  };
  const userName = normalizeName(body.userName);
  const { credentialId, publicKey, rpId, response } = body;
  if (userName.length < 3 || !credentialId || !publicKey || !rpId || !response) {
    return json({ ok: false, code: "invalid_request" });
  }
  if (!ADOPTABLE_RP_IDS.has(rpId)) return json({ ok: false, code: "rp_not_adoptable" });
  // Adoption runs where the passkey already works: on its own host, or under the shared domain.
  const host = new URL(origin).hostname;
  if (!(host === rpId || host.endsWith(`.${rpId}`))) return json({ ok: false, code: "wrong_site" });

  let challenge: string;
  try {
    challenge = JSON.parse(Buffer.from(response.response.clientDataJSON, "base64url").toString())
      .challenge;
  } catch {
    return json({ ok: false, code: "verification_failed" });
  }
  // One challenge, one attempt: spent before anything else is checked. Its verdict is applied
  // after proof of possession, so an identical retry can be answered from the stored result.
  const expiresAt = pending.get(challenge);
  pending.delete(challenge);
  const challengeLive = expiresAt !== undefined && expiresAt >= Date.now();

  // The stored ID must stand for the bytes the browser just used, under either reading.
  const rawId = Uint8Array.from(Buffer.from(response.rawId, "base64url"));
  if (!credentialIdReadings(credentialId).some((reading) => sameBytes(reading, rawId))) {
    return json({ ok: false, code: "credential_mismatch" });
  }

  // Diagnostic only: the agent's WebAuthn library as installed. Its ES256 check needs the ASN.1
  // schema from @peculiar/asn1-ecc, which resolves a different @peculiar/asn1-schema copy.
  let library: string;
  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      credential: { id: response.id, publicKey: coseKey(publicKey), counter: 0 },
      requireUserVerification: true,
    });
    library = verification.verified ? "verified" : "rejected";
  } catch (error) {
    library = `threw: ${String(error).slice(0, 120)}`;
  }

  // The decision: the app's own WebCrypto check (type, challenge, origin, RP ID hash, UP and UV
  // flags, P-256 signature), which has no ASN.1 dependency.
  const bytes = (field: string) => {
    const view = Buffer.from(field, "base64url");
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
  };
  const assertion = response as unknown as {
    response: { authenticatorData: string; clientDataJSON: string; signature: string };
  };
  const verified = await verifyPasskeyAssertion({
    response: {
      response: {
        authenticatorData: bytes(assertion.response.authenticatorData),
        clientDataJSON: bytes(assertion.response.clientDataJSON),
        signature: bytes(assertion.response.signature),
      },
    } as unknown as Credential,
    publicKey,
    challenge: new Uint8Array(Buffer.from(challenge, "base64url")),
    rpId,
    origin,
  });
  if (!verified) return json({ ok: false, code: "verification_failed", library });

  // Idempotent completion: the same name, exact ID string, credential bytes and key as a stored
  // entry is that entry's result, whether or not the challenge is still live. The ID string has
  // to match too: Kernel hashes that exact string, so the other spelling of the same passkey is a
  // different account. The key comes from the assertion's own bytes.
  const credentialKey = Buffer.from(rawId).toString("base64url");
  const existing = entries.get(userName);
  const identical =
    existing !== undefined &&
    existing.id === credentialId &&
    existing.credentialKey === credentialKey &&
    existing.publicKey.toLowerCase() === publicKey.toLowerCase();
  if (identical) return json({ ok: true, alreadyAdopted: true, library });
  if (!challengeLive) return json({ ok: false, code: "challenge_expired" });
  if (existing) return json({ ok: false, code: "name_taken" });
  // Uniqueness is on the credential's bytes and its proven key together. A hex and a base64url
  // spelling of one passkey cannot land under two names. A claim of someone else's ID bytes with
  // another key cannot block that someone's own adoption, because the pair differs.
  const pair = credentialPair(credentialKey, publicKey);
  if (byCredential.has(pair)) return json({ ok: false, code: "credential_exists" });

  // The ID is kept exactly as the account stored it: Kernel hashes that string into the address.
  // The browser's own ID travels beside it, so a hex-shaped stored ID can still name the passkey.
  entries.set(userName, { id: credentialId, publicKey, rpId, origin, signingId: response.id, credentialKey });
  byCredential.set(pair, userName);
  return json({ ok: true, library, entry: { userName, id: credentialId, signingId: response.id, rpId, origin } });
}

const page = `<!doctype html><html><head><meta charset="utf-8"><title>rig</title></head><body><script type="module" src="/app.js"></script></body></html>`;

Bun.serve({
  port: 47443,
  hostname: "127.0.0.1",
  tls: { key: Bun.file(`${CERTS}/key.pem`), cert: Bun.file(`${CERTS}/cert.pem`) },
  async fetch(request) {
    const url = new URL(request.url);
    const host = (request.headers.get("host") ?? "").split(":")[0];
    if (url.pathname === "/.well-known/webauthn") {
      const served = mode !== "off" && (host === "beta.greengoods.app" || host === "www.greengoods.app");
      wellKnownHits.push({ host, mode, served });
      if (!served) return new Response("not found", { status: 404 });
      const origins = mode === "on" ? ALL_ORIGINS : ["https://admin.greengoods.app"];
      return json({ origins });
    }
    if (url.pathname === "/app.js") {
      return new Response(bundle, { headers: { "content-type": "text/javascript" } });
    }
    if (url.pathname === "/__dir/challenge" && request.method === "POST") {
      const challenge = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
      pending.set(challenge, Date.now() + CHALLENGE_TTL_MS);
      return json({ challenge });
    }
    if (url.pathname === "/__dir/adopt" && request.method === "POST") return adopt(request);
    if (url.pathname === "/__dir/lookup" && request.method === "POST") {
      const { userName } = (await request.json()) as { userName?: string };
      const entry = entries.get(normalizeName(userName));
      return json({
        entries: entry ? [{ id: entry.id, publicKey: entry.publicKey, rpId: entry.rpId, signingId: entry.signingId }] : [],
      });
    }
    if (url.pathname === "/") return new Response(page, { headers: { "content-type": "text/html" } });
    return new Response("not found", { status: 404 });
  },
});

net
  .createServer((client) => {
    client.once("data", (chunk) => {
      const match = /^CONNECT ([^:\s]+):(\d+) HTTP\/1\.[01]/.exec(chunk.toString("latin1"));
      const target = match ? `${match[1]}:${match[2]}` : "(not CONNECT)";
      const ours =
        match && match[2] === "443" && (match[1] === "greengoods.app" || match[1].endsWith(".greengoods.app"));
      proxyLog.push(`${ours ? "tunnel" : "refused"} ${target}`);
      if (!ours) {
        client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
        return;
      }
      const upstream = net.connect(47443, "127.0.0.1", () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        upstream.pipe(client);
        client.pipe(upstream);
      });
      upstream.on("error", () => client.destroy());
      client.on("error", () => upstream.destroy());
    });
  })
  .listen(47080, "127.0.0.1");

Bun.serve({
  port: 47081,
  hostname: "127.0.0.1",
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/mode") {
      const requested = url.searchParams.get("ror") ?? "off";
      if (!MODES.includes(requested as Mode)) return json({ ok: false, code: "bad_mode" }, 400);
      mode = requested as Mode;
      return json({ mode });
    }
    if (url.pathname === "/reset") {
      entries.clear();
      byCredential.clear();
      pending.clear();
      wellKnownHits.length = 0;
      proxyLog.length = 0;
      return json({ ok: true });
    }
    if (url.pathname === "/log") {
      return json({ mode, wellKnownHits, proxy: [...new Set(proxyLog)], entries: [...entries.keys()] });
    }
    return json({ ok: false }, 404);
  },
});

console.log(`rig ready: bundle ${bundle.length} bytes`);
