import {
  canonicalSavedOfferPayload,
  SAVED_OFFER_MAX_BYTES,
  SAVED_OFFERS_ROUTES,
  validateSavedOfferPayload,
  type SavedOfferApiError,
} from "@green-goods/shared/public-contracts";
import type { Address } from "@green-goods/shared/types";
import type { Context, Hono } from "hono";
import type { SavedOfferStore } from "../../services/saved-offers";
import { logger } from "../../services/logger";
import { captureAgentException } from "../../services/sentry";
import { readLimitedJsonBody } from "../http/body";
import {
  checkOrigin,
  checkRateLimit,
  publicBrowserCorsPreflight,
  publicBrowserCorsResponse,
} from "../http/public";
import { safeError } from "../http/responses";
import type { SavedOfferRouteContext } from "./saved-offers";

const MUTATION_BODY_LIMIT = SAVED_OFFER_MAX_BYTES + 4 * 1024;

export function registerSavedOfferRecordRoutes(app: Hono, ctx: SavedOfferRouteContext): void {
  const route = `${SAVED_OFFERS_ROUTES.collection}/:savedOfferId`;
  for (const path of [SAVED_OFFERS_ROUTES.collection, route]) {
    app.options(path, (c) => publicBrowserCorsPreflight(c, ctx.deps));
  }
  app.get(SAVED_OFFERS_ROUTES.collection, (c) => list(c, ctx));
  app.get(route, (c) => read(c, ctx));
  app.put(route, (c) => put(c, ctx));
  app.delete(route, (c) => remove(c, ctx));
}

async function list(c: Context, ctx: SavedOfferRouteContext) {
  const authenticated = await authenticate(c, ctx, "saved_offers_read");
  if (!authenticated.ok) return authenticated.response;
  try {
    const records = await authenticated.store.list(authenticated.chainId, authenticated.owner);
    return publicBrowserCorsResponse(c, ctx.deps, { ok: true, records });
  } catch {
    return unavailable(c, ctx, "record_list");
  }
}

async function read(c: Context, ctx: SavedOfferRouteContext) {
  const authenticated = await authenticate(c, ctx, "saved_offers_read");
  if (!authenticated.ok) return authenticated.response;
  const savedOfferId = c.req.param("savedOfferId");
  if (!savedOfferId) {
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      savedOfferError("not_found", "Saved Offer not found."),
      404
    );
  }
  try {
    const record = await authenticated.store.get(
      authenticated.chainId,
      authenticated.owner,
      savedOfferId
    );
    if (!record) {
      return publicBrowserCorsResponse(
        c,
        ctx.deps,
        savedOfferError("not_found", "Saved Offer not found."),
        404
      );
    }
    return publicBrowserCorsResponse(c, ctx.deps, { ok: true, record });
  } catch {
    return unavailable(c, ctx, "record_read");
  }
}

async function put(c: Context, ctx: SavedOfferRouteContext) {
  const authenticated = await authenticate(c, ctx, "saved_offers_mutation");
  if (!authenticated.ok) return authenticated.response;
  const body = await readLimitedJsonBody<unknown>(c.req.raw, MUTATION_BODY_LIMIT);
  if (!body.ok) return publicBrowserCorsResponse(c, ctx.deps, body.error, body.status);
  const candidate = body.value as { payload?: unknown; expectedVersion?: unknown } | undefined;
  const parsed = validateSavedOfferPayload(candidate?.payload);
  if (!parsed.ok) {
    const status = parsed.error.message === "Saved Offer payload is too large." ? 413 : 400;
    return publicBrowserCorsResponse(c, ctx.deps, parsed.error, status);
  }
  if (
    parsed.value.savedOfferId !== c.req.param("savedOfferId") ||
    !Number.isSafeInteger(candidate?.expectedVersion) ||
    (candidate?.expectedVersion as number) < 0
  ) {
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      savedOfferError("invalid_request", "Invalid Saved Offer mutation."),
      400
    );
  }
  try {
    const result = await authenticated.store.compareAndSwap({
      chainId: authenticated.chainId,
      owner: authenticated.owner,
      savedOfferId: parsed.value.savedOfferId,
      payload: canonicalSavedOfferPayload(parsed.value),
      expectedVersion: candidate?.expectedVersion as number,
      updatedAt: new Date(ctx.deps.now?.() ?? Date.now()).toISOString(),
    });
    if (!result.ok) {
      if (result.reason === "owner_limit_exceeded") {
        return publicBrowserCorsResponse(
          c,
          ctx.deps,
          savedOfferError("owner_limit_exceeded", "The Saved Offer storage limit was reached."),
          409
        );
      }
      return versionConflict(c, ctx, result.currentVersion);
    }
    return publicBrowserCorsResponse(c, ctx.deps, { ok: true, record: result.record });
  } catch {
    return unavailable(c, ctx, "record_write");
  }
}

async function remove(c: Context, ctx: SavedOfferRouteContext) {
  const authenticated = await authenticate(c, ctx, "saved_offers_mutation");
  if (!authenticated.ok) return authenticated.response;
  const savedOfferId = c.req.param("savedOfferId");
  if (!savedOfferId) {
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      savedOfferError("not_found", "Saved Offer not found."),
      404
    );
  }
  const body = await readLimitedJsonBody<unknown>(c.req.raw, 2 * 1024);
  if (!body.ok) return publicBrowserCorsResponse(c, ctx.deps, body.error, body.status);
  const expectedVersion = (body.value as { expectedVersion?: unknown } | undefined)
    ?.expectedVersion;
  if (!Number.isSafeInteger(expectedVersion) || (expectedVersion as number) < 0) {
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      savedOfferError("invalid_request", "Invalid expected version."),
      400
    );
  }
  try {
    const result = await authenticated.store.tombstone({
      chainId: authenticated.chainId,
      owner: authenticated.owner,
      savedOfferId,
      expectedVersion: expectedVersion as number,
      updatedAt: new Date(ctx.deps.now?.() ?? Date.now()).toISOString(),
    });
    if (!result.ok) {
      if (result.reason === "not_found") {
        return publicBrowserCorsResponse(
          c,
          ctx.deps,
          savedOfferError("not_found", "Saved Offer not found."),
          404
        );
      }
      return versionConflict(c, ctx, result.currentVersion);
    }
    return publicBrowserCorsResponse(c, ctx.deps, { ok: true, version: result.version });
  } catch {
    return unavailable(c, ctx, "record_delete");
  }
}

async function authenticate(
  c: Context,
  ctx: SavedOfferRouteContext,
  route: "saved_offers_read" | "saved_offers_mutation"
): Promise<
  | { ok: true; chainId: number; owner: Address; store: SavedOfferStore }
  | { ok: false; response: Response }
> {
  const originError = checkOrigin(c, ctx.deps);
  if (originError) {
    return { ok: false, response: publicBrowserCorsResponse(c, ctx.deps, originError, 403) };
  }
  const token = bearerToken(c.req.header("authorization"));
  if (!token) {
    return {
      ok: false,
      response: publicBrowserCorsResponse(
        c,
        ctx.deps,
        savedOfferError("authentication_required", "Authentication is required."),
        401
      ),
    };
  }
  const rateError = checkRateLimit(c, ctx.deps, route, token.slice(0, 16));
  if (rateError) {
    return { ok: false, response: publicBrowserCorsResponse(c, ctx.deps, rateError, 429) };
  }
  if (!ctx.savedOffersSessionStore || !ctx.savedOfferStore) {
    return { ok: false, response: unavailable(c, ctx, "authentication_configuration") };
  }
  try {
    const session = await ctx.savedOffersSessionStore.authenticate(token);
    if (!session) {
      return {
        ok: false,
        response: publicBrowserCorsResponse(
          c,
          ctx.deps,
          savedOfferError("session_expired", "The session is invalid or expired."),
          401
        ),
      };
    }
    return { ok: true, chainId: session.chainId, owner: session.owner, store: ctx.savedOfferStore };
  } catch {
    return { ok: false, response: unavailable(c, ctx, "session_authenticate") };
  }
}

function bearerToken(value: string | undefined): string | undefined {
  return value?.match(/^Bearer ([A-Za-z0-9._-]{32,1024})$/)?.[1];
}

function versionConflict(c: Context, ctx: SavedOfferRouteContext, currentVersion: number) {
  return publicBrowserCorsResponse(
    c,
    ctx.deps,
    {
      ...savedOfferError("version_conflict", "The Saved Offer was updated elsewhere."),
      currentVersion,
    },
    409
  );
}

function unavailable(c: Context, ctx: SavedOfferRouteContext, operation: string) {
  logger.error({ operation }, "Saved Offers operation unavailable");
  captureAgentException(new Error("Saved Offers operation unavailable"), {
    source: "saved-offers",
    surface: "public-api",
    route: "saved-offers",
    method: c.req.method,
    status: 503,
    metadata: { operation },
  });
  return publicBrowserCorsResponse(
    c,
    ctx.deps,
    safeError("provider_unavailable", "Saved Offers are unavailable right now."),
    503
  );
}

function savedOfferError(
  errorCode: SavedOfferApiError["errorCode"],
  message: string
): SavedOfferApiError {
  return { ok: false, errorCode, message };
}
