/**
 * Sign-In With Ethereum for the QA app.
 *
 * This replaces a deployment password we cannot have: Vercel's Password
 * Protection is a paid add-on, and without it `qa.greengoods.app` and its API
 * were reachable by anyone with the URL. Wallet auth is not a workaround for
 * that — it is strictly better, because it also closes the gap the old model
 * never could: the API no longer takes a tester's NAME from the request body
 * and hope. The signing address IS the identity, so nobody can record as
 * someone else even if they hold every other secret.
 *
 * Two deliberate constraints shape the implementation:
 *
 * 1. **No wallet library.** The page is a static file with no bundler, which is
 *    load-bearing (a syntax error is the only build risk). Browser-side signing
 *    is plain `window.ethereum`; only signature RECOVERY needs a library, and
 *    that runs server-side where a dependency costs nothing.
 * 2. **No session store.** Nonces and sessions are HMAC-signed values carrying
 *    their own expiry, so neither needs a database, and a restarted function
 *    keeps working. The cost is that a nonce is replayable inside its short
 *    window, which for a three-person internal tool is the right trade.
 */

import { recoverMessageAddress } from "viem";

/** Nonces are short-lived: long enough to sign, short enough not to matter. */
const NONCE_TTL_MS = 5 * 60 * 1000;
/** A session outlasts a QA session without outlasting the day. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const SESSION_COOKIE = "qa_session";

/**
 * The addresses allowed to record, from `QA_ALLOWLIST` as a JSON array:
 * `["0xabc…","0xdef…"]`.
 *
 * Addresses only, no names. A tester's display name is theirs to declare and
 * lives inside their own shard — the allowlist answers "may this wallet
 * record", which is a different question from "what should we call them", and
 * keeping them apart means adding a teammate never means editing two things.
 */
export function parseAllowlist(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("QA_ALLOWLIST is not valid JSON");
  }
  if (!Array.isArray(parsed)) {
    throw new Error('QA_ALLOWLIST must be a JSON array of addresses, e.g. ["0xabc…","0xdef…"]');
  }
  return parsed.map((address) => {
    if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error(`QA_ALLOWLIST entry is not an address: ${String(address).slice(0, 16)}…`);
    }
    return address.toLowerCase();
  });
}

/** Case-insensitive because address casing is a checksum, not an identity. */
export function isAllowed(allowlist: string[], address: string): boolean {
  return allowlist.includes(address.toLowerCase());
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Constant-time compare so a forged token cannot be discovered byte by byte. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let differing = 0;
  for (let index = 0; index < a.length; index++) differing |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return differing === 0;
}

/**
 * EIP-4361 requires the nonce to be at least 8 alphanumeric characters, so the
 * whole value is hex: issue time, randomness, and the HMAC that makes it
 * unforgeable, concatenated. Carrying its own timestamp is what removes the
 * need to remember issued nonces anywhere.
 */
export async function issueNonce(secret: string, now: number, random?: string): Promise<string> {
  const issuedAt = now.toString(16).padStart(12, "0");
  const entropy =
    random ??
    [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const payload = `${issuedAt}${entropy}`;
  return `${payload}${(await hmac(secret, payload)).slice(0, 32)}`;
}

export async function nonceError(secret: string, nonce: string, now: number): Promise<string | null> {
  if (!/^[0-9a-f]{60}$/.test(nonce)) return "malformed nonce";
  const payload = nonce.slice(0, 28);
  const expected = (await hmac(secret, payload)).slice(0, 32);
  if (!sameSecret(nonce.slice(28), expected)) return "nonce was not issued by this server";
  const issuedAt = Number.parseInt(payload.slice(0, 12), 16);
  if (!Number.isFinite(issuedAt)) return "malformed nonce";
  if (now - issuedAt > NONCE_TTL_MS) return "nonce expired — reload and sign in again";
  // A clock that reports the nonce as issued in the future means the value did
  // not come from here; treat it as forged rather than tolerating skew.
  if (issuedAt - now > 60_000) return "nonce is not yet valid";
  return null;
}

/** The exact text the wallet signs. Built here so both sides cannot drift. */
export function siweMessage(fields: {
  domain: string;
  address: string;
  uri: string;
  nonce: string;
  issuedAt: string;
  chainId?: number;
}): string {
  return [
    `${fields.domain} wants you to sign in with your Ethereum account:`,
    fields.address,
    "",
    "Sign in to record Green Goods QA results.",
    "",
    `URI: ${fields.uri}`,
    "Version: 1",
    `Chain ID: ${fields.chainId ?? 1}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
  ].join("\n");
}

export interface ParsedMessage {
  domain: string;
  address: string;
  nonce: string;
  issuedAt: string;
}

export function parseSiweMessage(message: string): ParsedMessage | null {
  const lines = message.split("\n");
  const domain = lines[0]?.match(/^(\S+) wants you to sign in with your Ethereum account:$/)?.[1];
  const address = lines[1]?.trim();
  const nonce = message.match(/^Nonce: (.+)$/m)?.[1]?.trim();
  const issuedAt = message.match(/^Issued At: (.+)$/m)?.[1]?.trim();
  if (!domain || !address || !nonce || !issuedAt) return null;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return null;
  return { domain, address, nonce, issuedAt };
}

export interface VerifyInput {
  message: string;
  signature: string;
  secret: string;
  allowlist: string[];
  expectedDomain: string;
  now: number;
}

/**
 * Verify a signed sign-in and return who it proves the caller is.
 *
 * Every rejection returns the same shape so a caller cannot learn which check
 * failed beyond what the tester needs to act on.
 */
export async function verifySignIn(input: VerifyInput): Promise<{ address: string } | { error: string }> {
  const parsed = parseSiweMessage(input.message);
  if (!parsed) return { error: "malformed sign-in message" };
  // Domain binding: a signature captured on another site must not work here.
  if (parsed.domain !== input.expectedDomain) return { error: "sign-in was issued for another site" };
  const nonceProblem = await nonceError(input.secret, parsed.nonce, input.now);
  if (nonceProblem) return { error: nonceProblem };

  let recovered: string;
  try {
    recovered = await recoverMessageAddress({
      message: input.message,
      signature: input.signature as `0x${string}`,
    });
  } catch {
    return { error: "signature could not be verified" };
  }
  if (recovered.toLowerCase() !== parsed.address.toLowerCase()) {
    return { error: "signature does not match the stated address" };
  }
  if (!isAllowed(input.allowlist, recovered)) {
    return { error: "this address is not on the QA allowlist" };
  }
  return { address: recovered.toLowerCase() };
}

/** `<address>.<expiry>.<hmac>` — self-describing, self-expiring, unforgeable. */
export async function issueSession(secret: string, address: string, now: number): Promise<string> {
  const expiresAt = now + SESSION_TTL_MS;
  const payload = `${address.toLowerCase()}.${expiresAt}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function readSession(
  secret: string,
  token: string | null,
  now: number,
): Promise<{ address: string } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [address, expiresAt, signature] = parts;
  if (!sameSecret(signature, await hmac(secret, `${address}.${expiresAt}`))) return null;
  if (!Number.isFinite(Number(expiresAt)) || Number(expiresAt) <= now) return null;
  return { address };
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || null;
  }
  return null;
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  // HttpOnly keeps the token out of reach of any script on the page; SameSite
  // Lax is enough because every write is a same-origin fetch from this app.
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}
