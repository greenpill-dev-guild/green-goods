import {
  buildSavedOffersSessionMessage,
  canonicalSavedOfferPayload,
  normalizeSavedOfferAddress,
  SAVED_OFFER_MAX_BYTES,
  SAVED_OFFERS_ROUTES,
  validateSavedOfferPayload,
  validateSavedOffersSessionRequest,
  type SavedOfferApiError,
} from "@green-goods/shared/public-contracts";
import type { Address } from "@green-goods/shared/types";
import type { Context, Hono } from "hono";
import type { SavedOfferStore, SavedOffersSessionStore } from "../../services/saved-offers";
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
import type { ApiRouteContext } from "../http/route-context";

const CHALLENGE_BODY_LIMIT = 2 * 1024;
const SESSION_BODY_LIMIT = 8 * 1024;
const MUTATION_BODY_LIMIT = SAVED_OFFER_MAX_BYTES + 4 * 1024;
const SESSION_MESSAGE_MAX_AGE_SECONDS = 5 * 60;
const SESSION_MESSAGE_FUTURE_SKEW_SECONDS = 30;

export type SavedOfferRouteContext = ApiRouteContext & {
  savedOfferStore?: SavedOfferStore;
  savedOffersSessionStore?: SavedOffersSessionStore;
};

export function registerSavedOfferRoutes(app: Hono, ctx: SavedOfferRouteContext): void {
  const recordRoute = `${SAVED_OFFERS_ROUTES.collection}/:savedOfferId`;
  for (const route of [
    SAVED_OFFERS_ROUTES.challenge,
    SAVED_OFFERS_ROUTES.session,
    SAVED_OFFERS_ROUTES.collection,
    recordRoute,
  ]) {
    app.options(route, (c) => publicBrowserCorsPreflight(c, ctx.deps));
  }
  app.post(SAVED_OFFERS_ROUTES.challenge, (c) => challenge(c, ctx));
  app.post(SAVED_OFFERS_ROUTES.session, (c) => createSession(c, ctx));
  app.get(SAVED_OFFERS_ROUTES.collection, (c) => list(c, ctx));
  app.get(recordRoute, (c) => read(c, ctx));
  app.put(recordRoute, (c) => put(c, ctx));
  app.delete(recordRoute, (c) => remove(c, ctx));
}

async function challenge(c: Context, ctx: SavedOfferRouteContext) {
  const originError = checkOrigin(c, ctx.deps);
  if (originError) return publicBrowserCorsResponse(c, ctx.deps, originError, 403);
  const body = await readLimitedJsonBody<unknown>(c.req.raw, CHALLENGE_BODY_LIMIT);
  if (!body.ok) return publicBrowserCorsResponse(c, ctx.deps, body.error, body.status);
  const candidate = body.value as { chainId?: unknown; owner?: unknown } | undefined;
  const owner =
    typeof candidate?.owner === "string" ? normalizeSavedOfferAddress(candidate.owner) : null;
  if (!Number.isSafeInteger(candidate?.chainId) || (candidate?.chainId as number) <= 0 || !owner) {
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      savedOfferError("invalid_request", "Invalid challenge request."),
      400
    );
  }
  if (!isSupportedChain(ctx, candidate?.chainId as number)) {
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      savedOfferError("chain_unsupported", "Unsupported chain."),
      400
    );
  }
  const rateError = checkRateLimit(c, ctx.deps, "saved_offers_challenge", owner);
  if (rateError) return publicBrowserCorsResponse(c, ctx.deps, rateError, 429);
  const sessions = ctx.savedOffersSessionStore;
  const audience = ctx.deps.savedOffersAudience;
  if (!sessions || !audience) return unavailable(c, ctx, "challenge_configuration");
  try {
    const issued = await sessions.issueChallenge({
      chainId: candidate?.chainId as number,
      owner,
      audience,
    });
    return publicBrowserCorsResponse(c, ctx.deps, { ok: true, ...issued, audience });
  } catch {
    return unavailable(c, ctx, "challenge_issue");
  }
}

async function createSession(c: Context, ctx: SavedOfferRouteContext) {
  const originError = checkOrigin(c, ctx.deps);
  if (originError) return publicBrowserCorsResponse(c, ctx.deps, originError, 403);
  const body = await readLimitedJsonBody<unknown>(c.req.raw, SESSION_BODY_LIMIT);
  if (!body.ok) return publicBrowserCorsResponse(c, ctx.deps, body.error, body.status);
  const parsed = validateSavedOffersSessionRequest(body.value);
  if (!parsed.ok) return publicBrowserCorsResponse(c, ctx.deps, parsed.error, 400);
  if (!isSupportedChain(ctx, parsed.value.chainId)) {
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      savedOfferError("chain_unsupported", "Unsupported chain."),
      400
    );
  }
  const rateError = checkRateLimit(c, ctx.deps, "saved_offers_session", parsed.value.owner);
  if (rateError) return publicBrowserCorsResponse(c, ctx.deps, rateError, 429);
  const sessions = ctx.savedOffersSessionStore;
  const verifier = ctx.deps.savedOffersSignatureVerifier;
  const audience = ctx.deps.savedOffersAudience;
  if (!sessions || !verifier || !audience) return unavailable(c, ctx, "session_configuration");

  const now = Math.floor((ctx.deps.now?.() ?? Date.now()) / 1000);
  if (
    parsed.value.issuedAt > now + SESSION_MESSAGE_FUTURE_SKEW_SECONDS ||
    now - parsed.value.issuedAt > SESSION_MESSAGE_MAX_AGE_SECONDS
  ) {
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      savedOfferError("challenge_expired", "The challenge has expired."),
      401
    );
  }
  let challengeState: Awaited<ReturnType<SavedOffersSessionStore["consumeChallenge"]>>;
  try {
    challengeState = await sessions.consumeChallenge({
      chainId: parsed.value.chainId,
      owner: parsed.value.owner,
      audience,
      nonce: parsed.value.nonce,
    });
  } catch {
    return unavailable(c, ctx, "challenge_consume");
  }
  if (challengeState !== "valid") {
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      savedOfferError(
        challengeState === "expired" ? "challenge_expired" : "challenge_invalid",
        "The challenge is invalid or expired."
      ),
      401
    );
  }

  let verified: boolean;
  try {
    verified = await verifier({
      chainId: parsed.value.chainId,
      address: parsed.value.owner,
      message: buildSavedOffersSessionMessage({
        version: 1,
        chainId: parsed.value.chainId,
        owner: parsed.value.owner,
        nonce: parsed.value.nonce,
        audience,
        issuedAt: parsed.value.issuedAt,
      }),
      signature: parsed.value.signature,
      ...(parsed.value.factory && parsed.value.factoryData
        ? { factory: parsed.value.factory, factoryData: parsed.value.factoryData }
        : {}),
    });
  } catch {
    return unavailable(c, ctx, "signature_verify");
  }
  if (!verified) {
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      savedOfferError("signature_invalid", "The session signature is invalid."),
      401
    );
  }
  try {
    const session = await sessions.createSession({
      chainId: parsed.value.chainId,
      owner: parsed.value.owner,
    });
    return publicBrowserCorsResponse(c, ctx.deps, { ok: true, ...session });
  } catch {
    return unavailable(c, ctx, "session_create");
  }
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
    if (!record)
      return publicBrowserCorsResponse(
        c,
        ctx.deps,
        savedOfferError("not_found", "Saved Offer not found."),
        404
      );
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
  if (originError)
    return { ok: false, response: publicBrowserCorsResponse(c, ctx.deps, originError, 403) };
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
  const rateError = checkRateLimit(c, ctx.deps, route, sessionRateMaterial(token));
  if (rateError)
    return { ok: false, response: publicBrowserCorsResponse(c, ctx.deps, rateError, 429) };
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

function isSupportedChain(ctx: SavedOfferRouteContext, chainId: number): boolean {
  return Boolean(ctx.deps.savedOffersChainIds?.includes(chainId));
}

function bearerToken(value: string | undefined): string | undefined {
  const match = value?.match(/^Bearer ([0-9a-f]{64})$/i);
  return match?.[1];
}

function sessionRateMaterial(token: string): string {
  return token.slice(0, 16);
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
