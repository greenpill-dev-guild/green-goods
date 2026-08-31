/**
 * Sign-in endpoint for the QA app.
 *
 *   GET    /api/auth  → a nonce to sign, plus who you already are (if anyone)
 *   POST   /api/auth  → { message, signature } → consumes once, sets the cookie
 *   DELETE /api/auth  → signs out by expiring the session cookie
 *
 * Named method exports, not a default export: Vercel reads a default export as
 * the Node `(req, res)` signature and discards a returned `Response`, which
 * hangs the request until the 300s platform timeout.
 */

import { get, put } from "@vercel/blob";

import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  isAllowed,
  isSameOriginMutation,
  issueNonce,
  issueSession,
  parseAllowlist,
  readCookie,
  readSession,
  sessionCookie,
  siweMessage,
  verifySignIn,
} from "../auth.js";

const MAX_BODY_BYTES = 8 * 1024;
const NONCE_MARKER_PREFIX = "qa/auth/nonces/";

/** The narrow Blob surface one-shot nonce consumption needs. */
export interface NonceStore {
  put(
    pathname: string,
    body: string,
    options: {
      access: "private";
      addRandomSuffix: false;
      allowOverwrite: false;
      contentType: "text/plain";
    },
  ): Promise<unknown>;
  get(
    pathname: string,
    options: { access: "private"; useCache: false },
  ): Promise<{ statusCode: number } | null>;
}

const productionNonceStore: NonceStore = { get, put };

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store", ...headers },
  });
}

/**
 * The secret and allowlist are required. Falling back to defaults would ship an
 * app that looks authenticated and is not — the failure this whole change
 * exists to prevent — so a missing secret refuses every request loudly.
 */
function config(): { secret: string; allowlist: string[] } | { error: string } {
  const secret = process.env.QA_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return { error: "QA_SESSION_SECRET is missing or too short (needs 32+ characters)" };
  }
  try {
    const allowlist = parseAllowlist(process.env.QA_ALLOWLIST);
    if (!allowlist.length) return { error: "QA_ALLOWLIST is empty — nobody can sign in" };
    return { secret, allowlist };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "QA_ALLOWLIST is invalid" };
  }
}

function origin(request: Request): { domain: string; uri: string } {
  const url = new URL(request.url);
  return { domain: url.host, uri: `${url.protocol}//${url.host}` };
}

async function nonceMarkerPath(nonce: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${NONCE_MARKER_PREFIX}${hex}.txt`;
}

/**
 * Atomically consume a verified nonce.
 *
 * Blob's create-only write is the serialization point: one concurrent request
 * creates the marker, and every later request finds it. If a failed write
 * cannot be proven to be a duplicate, sign-in fails closed rather than minting
 * a session from an uncertain challenge state.
 */
export async function consumeNonce(nonce: string, store: NonceStore = productionNonceStore): Promise<boolean> {
  const pathname = await nonceMarkerPath(nonce);
  try {
    await store.put(pathname, "used", {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "text/plain",
    });
    return true;
  } catch (writeError) {
    let existing: { statusCode: number } | null;
    try {
      existing = await store.get(pathname, { access: "private", useCache: false });
    } catch (readError) {
      throw new Error("nonce consumption store is unavailable", { cause: readError });
    }
    if (existing?.statusCode === 200) return false;
    throw new Error("nonce consumption store is unavailable", { cause: writeError });
  }
}

export async function GET(request: Request): Promise<Response> {
  const settings = config();
  if ("error" in settings) return json({ error: settings.error }, 503);
  const { domain, uri } = origin(request);
  const now = Date.now();

  const session = await readSession(
    settings.secret,
    readCookie(request.headers.get("cookie"), SESSION_COOKIE),
    now,
  );
  // Whether this caller is already signed in. What they are CALLED comes from
  // their own shard via /api/state, not from here — the allowlist holds
  // addresses only.
  const signedIn = session && isAllowed(settings.allowlist, session.address) ? session.address : null;

  const nonce = await issueNonce(settings.secret, now);
  const issuedAt = new Date(now).toISOString();
  // The page never composes the message itself. Building it in two places is a
  // silent-drift hazard where a stray character makes every signature fail
  // verification, so the server hands back the exact text to sign.
  const address = new URL(request.url).searchParams.get("address");
  const message =
    address && /^0x[0-9a-fA-F]{40}$/.test(address)
      ? siweMessage({ domain, address, uri, nonce, issuedAt })
      : null;

  return json({
    domain,
    uri,
    nonce,
    issuedAt,
    message,
    // Null rather than absent so the page can tell "signed out" from "the
    // request failed" without inspecting status codes.
    address: signedIn,
  });
}

export async function handlePost(
  request: Request,
  store: NonceStore = productionNonceStore,
  now = Date.now(),
): Promise<Response> {
  if (!isSameOriginMutation(request)) return json({ error: "cross-origin request refused" }, 403);
  const settings = config();
  if ("error" in settings) return json({ error: settings.error }, 503);

  let body: { message?: unknown; signature?: unknown };
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json({ error: "payload too large" }, 413);
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "body must be a JSON object" }, 400);
    }
    body = parsed as { message?: unknown; signature?: unknown };
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  if (typeof body.message !== "string" || typeof body.signature !== "string") {
    return json({ error: "message and signature are required" }, 400);
  }

  const result = await verifySignIn({
    message: body.message,
    signature: body.signature,
    secret: settings.secret,
    allowlist: settings.allowlist,
    expectedDomain: origin(request).domain,
    expectedUri: origin(request).uri,
    now,
  });
  if ("error" in result) return json({ error: result.error }, 401);

  try {
    if (!(await consumeNonce(result.nonce, store))) {
      return json({ error: "sign-in challenge was already used — start again" }, 401);
    }
  } catch (error) {
    console.error(
      "qa/auth: nonce consumption failed",
      error instanceof Error ? error.message : "unknown storage error",
    );
    return json({ error: "sign-in state is unavailable — try again" }, 503);
  }

  const token = await issueSession(settings.secret, result.address, now);
  return json(
    { address: result.address },
    200,
    { "Set-Cookie": sessionCookie(token, Math.floor(SESSION_TTL_MS / 1000)) },
  );
}

export async function POST(request: Request): Promise<Response> {
  return handlePost(request);
}

export async function DELETE(request: Request): Promise<Response> {
  if (!isSameOriginMutation(request)) return json({ error: "cross-origin request refused" }, 403);
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
}
