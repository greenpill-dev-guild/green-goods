import type { ReportingErrorCode } from "@green-goods/shared/modules/agent-reporting";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type * as z from "zod";
import type { AccountProofVerifier } from "../../../services/reporting/browser-access";
import type { GrantDeps } from "../../../services/reporting/grants";
import type { ReportingChain } from "../../../services/reporting/chain";
import type { PrivateMediaStore } from "../../../services/reporting/media-store";
import type { ReportingCore } from "../../../services/reporting/runtime";
import { type BrowserSession, sessionFromToken } from "../../../services/reporting/sessions";
import {
  type InMemoryPublicRateLimiter,
  PUBLIC_RATE_LIMIT_POLICIES,
  publicIpRateLimitKey,
  publicMaterialRateLimitKey,
  type TrustedProxyConfig,
} from "../../public-protection";

/**
 * HTTP boundary for the browser ceremonies behind the same-origin `/api/messaging` proxy. Browser
 * mutations need the exact canonical Origin and a CSRF token bound to the caller's pre-session or
 * session; cookies are host-only, HttpOnly and scoped to the proxy path. Every response is private
 * (`no-store`, `no-referrer`) and failures are typed without revealing other resources.
 */
export interface MessagingRouteDeps {
  core: () => ReportingCore;
  chain: ReportingChain;
  verifier: AccountProofVerifier;
  media: PrivateMediaStore;
  rateLimiter: InMemoryPublicRateLimiter;
  trustedProxy?: TrustedProxyConfig;
  /** Present only when delegation has a verified module; otherwise grants are unsupported. */
  grants?: Omit<GrantDeps, "core" | "chain">;
  /** Only the loopback development driver serves plain HTTP. */
  secureCookies: boolean;
  cookiePath: string;
}

export const PREAUTH_COOKIE = "gg_msg_pre";
export const SESSION_COOKIE = "gg_msg_session";
export const CSRF_HEADER = "x-gg-csrf";
export const BOOTSTRAP_HEADER = "x-gg-bootstrap";

const STATUS: Record<ReportingErrorCode, 400 | 401 | 403 | 404 | 409 | 423 | 429 | 503> = {
  access_required: 401,
  stale_revision: 409,
  unsupported_scope: 403,
  dependency_unavailable: 503,
  outcome_unknown: 409,
  unavailable: 404,
  conflict: 409,
  forbidden: 403,
  invalid_request: 400,
  paused: 423,
  rate_limited: 429,
};

export const privateResponses: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "no-referrer");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Vary", "Cookie, Origin");
};

export function failure(c: Context, errorCode: ReportingErrorCode): Response {
  return c.json({ ok: false, errorCode }, STATUS[errorCode]);
}

export function hasExactOrigin(c: Context, deps: MessagingRouteDeps): boolean {
  return c.req.header("origin") === deps.core().settings.browserOrigin;
}

export function limited(
  c: Context,
  deps: MessagingRouteDeps,
  route: "messaging_bootstrap" | "messaging_proof" | "messaging_read" | "messaging_mutation",
  material?: string
): boolean {
  const key = material
    ? publicMaterialRateLimitKey({ route, material })
    : publicIpRateLimitKey({ route, request: c.req.raw, trustedProxy: deps.trustedProxy });
  return !deps.rateLimiter.check(key, PUBLIC_RATE_LIMIT_POLICIES[route], deps.core().clock.now())
    .allowed;
}

export async function readBody<T>(
  c: Context,
  schema: z.ZodType<T>,
  maxBytes = 16 * 1024
): Promise<T | null> {
  const text = await c.req.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeCookie(
  c: Context,
  deps: MessagingRouteDeps,
  name: string,
  value: string,
  maxAgeSeconds: number
): void {
  setCookie(c, name, value, {
    path: deps.cookiePath,
    httpOnly: true,
    secure: deps.secureCookies,
    sameSite: "Lax",
    maxAge: Math.max(1, Math.floor(maxAgeSeconds)),
  });
}

export function clearCookie(c: Context, deps: MessagingRouteDeps, name: string): void {
  deleteCookie(c, name, { path: deps.cookiePath, secure: deps.secureCookies });
}

export function preauthToken(c: Context): string | undefined {
  return getCookie(c, PREAUTH_COOKIE);
}

/**
 * Resolves the caller's scoped session. Mutations additionally need the exact Origin and the
 * session's CSRF token; a missing or revoked session is `access_required`, never another scope.
 */
export function currentSession(
  c: Context,
  deps: MessagingRouteDeps,
  mutation: boolean
): BrowserSession | null {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  if (mutation && !hasExactOrigin(c, deps)) return null;
  const csrf = mutation ? (c.req.header(CSRF_HEADER) ?? "") : undefined;
  return sessionFromToken(deps.core(), token, csrf);
}
