import {
  buildSavedOffersSessionMessage,
  normalizeSavedOfferAddress,
  SAVED_OFFERS_ROUTES,
  validateSavedOffersSessionRequest,
  type SavedOfferApiError,
} from "@green-goods/shared/public-contracts";
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
import { registerSavedOfferRecordRoutes } from "./saved-offer-records";

const CHALLENGE_BODY_LIMIT = 2 * 1024;
const SESSION_BODY_LIMIT = 8 * 1024;
const SESSION_MESSAGE_MAX_AGE_SECONDS = 5 * 60;
const SESSION_MESSAGE_FUTURE_SKEW_SECONDS = 30;

export type SavedOfferRouteContext = ApiRouteContext & {
  savedOfferStore?: SavedOfferStore;
  savedOffersSessionStore?: SavedOffersSessionStore;
};

export function registerSavedOfferRoutes(app: Hono, ctx: SavedOfferRouteContext): void {
  for (const route of [SAVED_OFFERS_ROUTES.challenge, SAVED_OFFERS_ROUTES.session]) {
    app.options(route, (c) => publicBrowserCorsPreflight(c, ctx.deps));
  }
  app.post(SAVED_OFFERS_ROUTES.challenge, (c) => challenge(c, ctx));
  app.post(SAVED_OFFERS_ROUTES.session, (c) => createSession(c, ctx));
  registerSavedOfferRecordRoutes(app, ctx);
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

function isSupportedChain(ctx: SavedOfferRouteContext, chainId: number): boolean {
  return Boolean(ctx.deps.savedOffersChainIds?.includes(chainId));
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
