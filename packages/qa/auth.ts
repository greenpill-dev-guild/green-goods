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
 * 1. **No browser wallet library.** The page is a static file with no bundler,
 *    which is load-bearing. Browser-side signing is plain `window.ethereum`;
 *    SIWE parsing, canonical message creation, and signature recovery use the
 *    existing server-side viem dependency.
 * 2. **No session store.** Sessions are HMAC-signed values carrying their own
 *    expiry, so a restarted function keeps working. Nonces carry the same
 *    authenticated expiry, but a successful sign-in also creates a private,
 *    create-only Blob marker. That marker makes each challenge one-shot.
 */

import { recoverMessageAddress } from "viem";
import {
  createSiweMessage,
  parseSiweMessage as parseViemSiweMessage,
  type SiweMessage,
} from "viem/siwe";

/** Nonces are short-lived: long enough to sign, short enough not to matter. */
const NONCE_TTL_MS = 5 * 60 * 1000;
/** A session outlasts a QA session without outlasting the day. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const SESSION_COOKIE = "qa_session";

/**
 * The addresses allowed to record, from `QA_ALLOWLIST` as a JSON array:
 * `["0x1111111111111111111111111111111111111111"]`.
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
    throw new Error(
      'QA_ALLOWLIST must be a JSON array of addresses, e.g. ["0x1111111111111111111111111111111111111111"]',
    );
  }
  const addresses = parsed.map((address) => {
    if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error(`QA_ALLOWLIST entry is not an address: ${String(address).slice(0, 16)}…`);
    }
    return address.toLowerCase();
  });
  if (new Set(addresses).size !== addresses.length) {
    throw new Error("QA_ALLOWLIST contains the same address more than once");
  }
  return addresses;
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

/** Verify a full SHA-256 HMAC inside WebCrypto rather than timing a JS loop. */
async function validHmac(secret: string, payload: string, signature: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = Uint8Array.from(signature.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(payload));
}

/**
 * EIP-4361 requires the nonce to be at least 8 alphanumeric characters, so the
 * whole value is hex: issue time, randomness, and the full SHA-256 HMAC that makes it
 * unforgeable, concatenated. Carrying its own timestamp means the server does
 * not store every challenge it issues; it records only successful consumption.
 */
export async function issueNonce(secret: string, now: number, random?: string): Promise<string> {
  const issuedAt = now.toString(16).padStart(12, "0");
  const entropy =
    random ??
    [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (!/^[0-9a-f]{16}$/.test(entropy)) throw new Error("nonce entropy must be 16 lowercase hex characters");
  const payload = `${issuedAt}${entropy}`;
  return `${payload}${await hmac(secret, payload)}`;
}

export async function nonceError(secret: string, nonce: string, now: number): Promise<string | null> {
  if (!/^[0-9a-f]{92}$/.test(nonce)) return "malformed nonce";
  const payload = nonce.slice(0, 28);
  if (!(await validHmac(secret, payload, nonce.slice(28)))) return "nonce was not issued by this server";
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
  return createSiweMessage({
    address: fields.address as `0x${string}`,
    chainId: fields.chainId ?? 1,
    domain: fields.domain,
    issuedAt: new Date(fields.issuedAt),
    nonce: fields.nonce,
    statement: "Sign in to record Green Goods QA results.",
    uri: fields.uri,
    version: "1",
  });
}

export interface ParsedMessage {
  domain: string;
  address: string;
  uri: string;
  version: "1";
  chainId: number;
  nonce: string;
  issuedAt: string;
}

export function parseSiweMessage(message: string): ParsedMessage | null {
  try {
    const parsed = parseViemSiweMessage(message);
    if (
      !parsed.domain ||
      !parsed.address ||
      !parsed.uri ||
      parsed.version !== "1" ||
      !Number.isSafeInteger(parsed.chainId) ||
      !parsed.nonce ||
      !parsed.issuedAt
    ) {
      return null;
    }
    // viem parses the ERC-4361 fields. Rebuilding them and requiring byte-for-
    // byte equality also rejects duplicated, reordered, or trailing fields that
    // a permissive field extractor could otherwise ignore.
    if (createSiweMessage(parsed as SiweMessage) !== message) return null;
    return {
      domain: parsed.domain,
      address: parsed.address,
      uri: parsed.uri,
      version: parsed.version,
      chainId: parsed.chainId,
      nonce: parsed.nonce,
      issuedAt: parsed.issuedAt.toISOString(),
    };
  } catch {
    return null;
  }
}

export interface VerifyInput {
  message: string;
  signature: string;
  secret: string;
  allowlist: string[];
  expectedDomain: string;
  expectedUri: string;
  now: number;
}

/**
 * Verify a signed sign-in and return who it proves the caller is.
 *
 * Every rejection returns the same shape so a caller cannot learn which check
 * failed beyond what the tester needs to act on.
 */
export async function verifySignIn(
  input: VerifyInput,
): Promise<{ address: string; nonce: string } | { error: string }> {
  const parsed = parseSiweMessage(input.message);
  if (!parsed) return { error: "malformed sign-in message" };
  // Domain binding: a signature captured on another site must not work here.
  if (parsed.domain !== input.expectedDomain) return { error: "sign-in was issued for another site" };
  if (parsed.uri !== input.expectedUri || parsed.version !== "1" || parsed.chainId !== 1) {
    return { error: "sign-in was issued for another resource" };
  }
  const nonceProblem = await nonceError(input.secret, parsed.nonce, input.now);
  if (nonceProblem) return { error: nonceProblem };
  const nonceIssuedAt = Number.parseInt(parsed.nonce.slice(0, 12), 16);
  if (Date.parse(parsed.issuedAt) !== nonceIssuedAt) {
    return { error: "sign-in timing does not match its challenge" };
  }

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
  return { address: recovered.toLowerCase(), nonce: parsed.nonce };
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
  if (!/^0x[0-9a-f]{40}$/.test(address) || !/^\d{1,16}$/.test(expiresAt)) return null;
  if (!(await validHmac(secret, `${address}.${expiresAt}`, signature))) return null;
  if (!Number.isSafeInteger(Number(expiresAt)) || Number(expiresAt) <= now) return null;
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

/**
 * CSRF boundary for state-changing browser requests.
 *
 * SameSite is a registrable-domain boundary, so a compromised sibling such as
 * `evil.greengoods.app` is still same-site with `qa.greengoods.app`. Browsers
 * forbid script from forging this header; requiring the exact origin closes
 * that sibling-origin gap while preserving the app's same-origin fetches.
 */
export function isSameOriginMutation(request: Request): boolean {
  const submitted = request.headers.get("origin");
  if (!submitted) return false;
  try {
    return new URL(submitted).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  // HttpOnly keeps the token out of reach of any script on the page; SameSite
  // Lax is enough because every write is a same-origin fetch from this app.
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}
