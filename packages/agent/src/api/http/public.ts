import { PUBLIC_AGENT_ROUTES, type PublicApiError } from "@green-goods/shared/public-contracts";
import type { Context } from "hono";
import {
  InMemoryPublicRateLimiter,
  isOriginAllowed,
  PUBLIC_RATE_LIMIT_POLICIES,
  publicIpMaterialRateLimitKey,
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

function getAllowedOrigins(deps: ServerDeps, request: Request): Set<string> {
  const configuredOrigins = firstNonEmpty(
    process.env.AGENT_ALLOWED_ORIGINS,
    process.env.AGENT_PUBLIC_ALLOWED_ORIGINS
  );
  const origins =
    deps.allowedOrigins ??
    resolveAllowedOrigins(configuredOrigins, {
      includeDevelopmentDefaults:
        process.env.NODE_ENV === "development" || process.env.APP_ENV === "development",
    });
  // The standalone Cookie Jar consumes only the public upload signer.
  // Keep this integration out of identity and all other public route allowlists.
  if (new URL(request.url).pathname !== PUBLIC_AGENT_ROUTES.uploadSign) return origins;
  const uploadOrigins = new Set(origins);
  uploadOrigins.add("https://cookies.greengoods.app");
  if (process.env.APP_ENV === "development" || process.env.NODE_ENV === "development") {
    uploadOrigins.add("http://127.0.0.1:3041");
    uploadOrigins.add("http://localhost:3041");
  }
  return uploadOrigins;
}

export function checkOrigin(c: Context, deps: ServerDeps): PublicApiError | undefined {
  if (isOriginAllowed(c.req.raw, getAllowedOrigins(deps, c.req.raw))) return undefined;
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
  const isJoinRequestRoute =
    route === "join_request_create" ||
    route === "join_request_read" ||
    route === "join_request_resolve";
  const isPasskeyRoute = route === "passkey_registration" || route === "passkey_lookup";
  const usesOriginIndependentKeys =
    isJoinRequestRoute ||
    isPasskeyRoute ||
    route === "garden_impact_read" ||
    route === "commitment_impact_read";
  if (usesOriginIndependentKeys) {
    const aggregateRoute = route === "join_request_create" ? "join_request_create_ip" : route;
    const aggregateIpResult = limiter.check(
      publicIpMaterialRateLimitKey({
        route: aggregateRoute,
        request: c.req.raw,
        material: isPasskeyRoute ? "all-names" : "all-gardens",
        trustedProxy: deps.trustedProxy,
      }),
      PUBLIC_RATE_LIMIT_POLICIES[aggregateRoute],
      now
    );
    if (!aggregateIpResult.allowed) {
      return safeError("rate_limited", "Too many requests. Please try again later.", {
        params: { retryAfterSeconds: aggregateIpResult.retryAfterSeconds ?? 60 },
      });
    }
  } else {
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
  const key = usesOriginIndependentKeys
    ? publicIpMaterialRateLimitKey({
        route,
        request: c.req.raw,
        material: isPasskeyRoute ? `name:${material}` : material,
        trustedProxy: deps.trustedProxy,
      })
    : publicRateLimitKey({
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

/** Return one previously consumed post-authentication slot to its bucket. */
export function releaseMaterialRateLimit(
  deps: ServerDeps,
  route: Parameters<typeof publicMaterialRateLimitKey>[0]["route"],
  material: string
): void {
  const limiter = deps.publicRateLimiter ?? defaultPublicRateLimiter;
  limiter.release(publicMaterialRateLimitKey({ route, material }), deps.now?.() ?? Date.now());
}

function setPublicBrowserCorsHeaders(c: Context, deps: ServerDeps): void {
  const origin = c.req.header("origin");
  if (!origin || !isOriginAllowed(c.req.raw, getAllowedOrigins(deps, c.req.raw))) return;

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
