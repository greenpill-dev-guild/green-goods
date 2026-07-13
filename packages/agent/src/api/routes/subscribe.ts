import {
  PUBLIC_AGENT_ROUTES,
  type PublicLocale,
  type PublicSubscribeRequest,
} from "@green-goods/shared/public-contracts";
import type { Hono } from "hono";
import { readLimitedJsonBody } from "../http/body";
import type { ApiRouteContext } from "../http/route-context";
import {
  checkOrigin,
  checkRateLimit,
  publicBrowserCorsPreflight,
  publicBrowserCorsResponse,
} from "../http/public";
import { safeError } from "../http/responses";

const PUBLIC_SUBSCRIBE_LOCALES = new Set<PublicLocale>(["en", "es", "pt"]);
const PUBLIC_SUBSCRIBE_SOURCES = new Set<NonNullable<PublicSubscribeRequest["source"]>>([
  "homepage_get_in_touch",
  "fund_receipt",
  "footer",
  "unknown",
]);

export function registerSubscribeRoutes(app: Hono, ctx: ApiRouteContext): void {
  const { deps } = ctx;

  app.options(PUBLIC_AGENT_ROUTES.subscribe, (c) => {
    return publicBrowserCorsPreflight(c, deps);
  });

  app.post(PUBLIC_AGENT_ROUTES.subscribe, async (c) => {
    const originError = checkOrigin(c, deps);
    if (originError) return publicBrowserCorsResponse(c, deps, originError, 403);

    const bodyResult = await readLimitedJsonBody<Partial<PublicSubscribeRequest>>(c.req.raw);
    if (!bodyResult.ok)
      return publicBrowserCorsResponse(c, deps, bodyResult.error, bodyResult.status);

    const body = bodyResult.value;
    const email = body?.email?.trim().toLowerCase();
    const rateError = checkRateLimit(c, deps, "subscribe", email ?? "invalid");
    if (rateError) return publicBrowserCorsResponse(c, deps, rateError, 429);

    if (!isEmail(email)) {
      return publicBrowserCorsResponse(
        c,
        deps,
        safeError("invalid_email", "Enter a valid email address."),
        400
      );
    }
    if (body?.consent !== true) {
      return publicBrowserCorsResponse(
        c,
        deps,
        safeError("consent_required", "Consent is required."),
        400
      );
    }
    if (!deps.subscriptionClient) {
      return publicBrowserCorsResponse(
        c,
        deps,
        safeError("provider_unavailable", "Subscription is unavailable right now."),
        503
      );
    }

    try {
      const status = await deps.subscriptionClient.subscribe({
        email,
        locale: normalizePublicSubscribeLocale(body.locale),
        source: normalizePublicSubscribeSource(body.source),
        consentedAt: new Date(deps.now?.() ?? Date.now()).toISOString(),
      });
      return publicBrowserCorsResponse(c, deps, { ok: true, status });
    } catch {
      return publicBrowserCorsResponse(
        c,
        deps,
        safeError("provider_unavailable", "Subscription is unavailable right now."),
        503
      );
    }
  });
}

function isEmail(value: string | undefined): value is string {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizePublicSubscribeLocale(value: unknown): PublicLocale | undefined {
  return typeof value === "string" && PUBLIC_SUBSCRIBE_LOCALES.has(value as PublicLocale)
    ? (value as PublicLocale)
    : undefined;
}

function normalizePublicSubscribeSource(
  value: unknown
): NonNullable<PublicSubscribeRequest["source"]> {
  return typeof value === "string" &&
    PUBLIC_SUBSCRIBE_SOURCES.has(value as NonNullable<PublicSubscribeRequest["source"]>)
    ? (value as NonNullable<PublicSubscribeRequest["source"]>)
    : "unknown";
}
