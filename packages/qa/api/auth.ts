/**
 * Sign-in endpoint for the QA app.
 *
 *   GET    /api/auth  → a nonce to sign, plus who you already are (if anyone)
 *   POST   /api/auth  → { message, signature } → sets the session cookie
 *   DELETE /api/auth  → signs out
 *
 * Named method exports, not a default export: Vercel reads a default export as
 * the Node `(req, res)` signature and discards a returned `Response`, which
 * hangs the request until the 300s platform timeout.
 */

import {
  type Allowed,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  findAllowed,
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

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store", ...headers },
  });
}

/**
 * Both secrets are required. Falling back to a default would mean shipping an
 * app that looks authenticated and is not — the failure this whole change
 * exists to prevent — so a missing secret refuses every request loudly.
 */
function config(): { secret: string; allowlist: Allowed[] } | { error: string } {
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
  const signedIn = session ? findAllowed(settings.allowlist, session.address) : null;

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
    person: signedIn?.person ?? null,
    address: signedIn?.address ?? null,
  });
}

export async function POST(request: Request): Promise<Response> {
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
    now: Date.now(),
  });
  if ("error" in result) return json({ error: result.error }, 401);

  const token = await issueSession(settings.secret, result.address, Date.now());
  return json(
    { person: result.person, address: result.address },
    200,
    { "Set-Cookie": sessionCookie(token, Math.floor(SESSION_TTL_MS / 1000)) },
  );
}

export async function DELETE(): Promise<Response> {
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
}
