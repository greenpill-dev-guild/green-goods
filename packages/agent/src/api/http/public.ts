import type { PublicApiError } from "@green-goods/shared/public-contracts";
import type { Context } from "hono";
import {
  InMemoryPublicRateLimiter,
  isOriginAllowed,
  PUBLIC_RATE_LIMIT_POLICIES,
  publicIpRateLimitKey,
  publicMaterialRateLimitKey,
  publicRateLimitKey,
  resolveAllowedOrigins,
} from "../public-protection";
import type { ServerDeps } from "../server";
import { jsonNoStore, safeError } from "./responses";

const defaultPublicRateLimiter = new InMemoryPublicRateLimiter();

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => Boolean(value?.trim()));
}

function getAllowedOrigins(deps: ServerDeps): Set<string> {
  const configuredOrigins = firstNonEmpty(
    process.env.AGENT_ALLOWED_ORIGINS,
    process.env.AGENT_PUBLIC_ALLOWED_ORIGINS
  );
  return (
    deps.allowedOrigins ??
    resolveAllowedOrigins(configuredOrigins, {
      includeDevelopmentDefaults:
        process.env.NODE_ENV === "development" || process.env.APP_ENV === "development",
    })
  );
}

export function checkOrigin(c: Context, deps: ServerDeps): PublicApiError | undefined {
  if (isOriginAllowed(c.req.raw, getAllowedOrigins(deps))) return undefined;
  return safeError("origin_not_allowed", "This origin is not allowed.");
}

export function checkRateLimit(
  c: Context,
  deps: ServerDeps,
  route: Parameters<typeof publicRateLimitKey>[0]["route"],
  material: string
): PublicApiError | undefined {
  return checkRateLimitWithPolicy(c, deps, route, material, PUBLIC_RATE_LIMIT_POLICIES[route]);
}

export function checkRateLimitWithPolicy(
  c: Context,
  deps: ServerDeps,
  route: Parameters<typeof publicRateLimitKey>[0]["route"],
  material: string,
  policy: { limit: number; windowMs: number }
): PublicApiError | undefined {
  const limiter = deps.publicRateLimiter ?? defaultPublicRateLimiter;
  const now = deps.now?.() ?? Date.now();
  if (route !== "join_request_create") {
    const ipResult = limiter.check(
      publicIpRateLimitKey({
        route,
        request: c.req.raw,
        trustedProxy: deps.trustedProxy,
      }),
      policy,
      now
    );
    if (!ipResult.allowed) {
      return safeError("rate_limited", "Too many requests. Please try again later.", {
        params: { retryAfterSeconds: ipResult.retryAfterSeconds ?? 60 },
      });
    }
  }
  const key = publicRateLimitKey({
    route,
    request: c.req.raw,
    material,
    trustedProxy: deps.trustedProxy,
  });
  const result = limiter.check(key, policy, now);
  if (result.allowed) return undefined;
  return safeError("rate_limited", "Too many requests. Please try again later.", {
    params: { retryAfterSeconds: result.retryAfterSeconds ?? 60 },
  });
}

/** Apply a post-authentication limit without adding a second shared-IP bucket. */
export function checkMaterialRateLimit(
  deps: ServerDeps,
  route: Parameters<typeof publicMaterialRateLimitKey>[0]["route"],
  material: string
): PublicApiError | undefined {
  const limiter = deps.publicRateLimiter ?? defaultPublicRateLimiter;
  const now = deps.now?.() ?? Date.now();
  const result = limiter.check(
    publicMaterialRateLimitKey({ route, material }),
    PUBLIC_RATE_LIMIT_POLICIES[route],
    now
  );
  if (result.allowed) return undefined;
  return safeError("rate_limited", "Too many requests. Please try again later.", {
    params: { retryAfterSeconds: result.retryAfterSeconds ?? 60 },
  });
}

function setPublicBrowserCorsHeaders(c: Context, deps: ServerDeps): void {
  const origin = c.req.header("origin");
  if (!origin || !isOriginAllowed(c.req.raw, getAllowedOrigins(deps))) return;

  c.header("Access-Control-Allow-Origin", origin);
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-GG-Receipt-Token");
  c.header("Access-Control-Max-Age", "600");
  c.header("Vary", "Origin");
}

export function publicBrowserCorsResponse(
  c: Context,
  deps: ServerDeps,
  body: unknown,
  status = 200
) {
  setPublicBrowserCorsHeaders(c, deps);
  return jsonNoStore(c, body, status);
}

export function publicBrowserCorsPreflight(c: Context, deps: ServerDeps) {
  const originError = checkOrigin(c, deps);
  if (originError) return publicBrowserCorsResponse(c, deps, originError, 403);
  setPublicBrowserCorsHeaders(c, deps);
  return c.body(null, 204);
}
