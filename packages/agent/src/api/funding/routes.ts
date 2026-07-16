import {
  buildPublicFundingAvailabilityKey,
  PUBLIC_AGENT_ROUTES,
} from "@green-goods/shared/public-contracts";
import type { Context, Hono } from "hono";
import {
  createFundingIntentId,
  createIdempotencyFingerprint,
  createReceiptToken,
  expireIfAbandoned,
  hashSecret,
  redactFundingReceipt,
} from "../../services/funding-intents";
import { readLimitedJsonBody } from "../http/body";
import {
  checkOrigin,
  checkRateLimit,
  publicBrowserCorsPreflight,
  publicBrowserCorsResponse,
} from "../http/public";
import { isPublicApiError, safeError } from "../http/responses";
import type { FundingRouteContext } from "./context";
import {
  buildFundingReceiptUrl,
  createFundingIntentRecord,
  handleFundingIntentProof,
  hasReceiptTokenBody,
  hasReceiptTokenQuery,
} from "./records";
import { handleThirdwebWebhook } from "./webhook";
import { normalizeAddress, parseBaseUnitAmount, validateFundingIntentRequest } from "./validation";

export type { FundingRouteContext } from "./context";

export function registerFundingRoutes(app: Hono, ctx: FundingRouteContext): void {
  app.options(PUBLIC_AGENT_ROUTES.fundingIntents, (c) => publicBrowserCorsPreflight(c, ctx.deps));
  app.post(PUBLIC_AGENT_ROUTES.fundingIntents, (c) => handleFundingIntentCreate(c, ctx));
  app.options(PUBLIC_AGENT_ROUTES.fundingIntentProof, (c) =>
    publicBrowserCorsPreflight(c, ctx.deps)
  );
  app.post(PUBLIC_AGENT_ROUTES.fundingIntentProof, (c) => handleFundingIntentProof(c, ctx));
  app.options("/public/funding-intents/:id", (c) => publicBrowserCorsPreflight(c, ctx.deps));
  app.get("/public/funding-intents/:id", (c) => handleFundingReceipt(c, ctx));
  app.post(PUBLIC_AGENT_ROUTES.thirdwebWebhook, (c) => handleThirdwebWebhook(c, ctx));
}

async function handleFundingIntentCreate(c: Context, ctx: FundingRouteContext) {
  const { deps, fundingIntents, now, providerProofRegistry, thirdwebCheckout } = ctx;
  const originError = checkOrigin(c, deps);
  if (originError) return publicBrowserCorsResponse(c, deps, originError, 403);
  const bodyResult = await readLimitedJsonBody<unknown>(c.req.raw);
  if (!bodyResult.ok)
    return publicBrowserCorsResponse(c, deps, bodyResult.error, bodyResult.status);
  const request = validateFundingIntentRequest(bodyResult.value);
  if (isPublicApiError(request)) return publicBrowserCorsResponse(c, deps, request, 400);
  const rateError = checkRateLimit(
    c,
    deps,
    "funding_create",
    [request.gardenId, request.destinationAddress, request.fundingIntent].join(":")
  );
  if (rateError) return publicBrowserCorsResponse(c, deps, rateError, 429);
  const routeScopedAvailability =
    request.sourceRoute === undefined ? {} : { sourceRoute: request.sourceRoute };
  const availabilityInput = {
    gardenKey: request.gardenId,
    destinationType: request.destinationType,
    destinationAddress: request.destinationAddress,
    fundingIntent: request.fundingIntent,
    paymentMethod: request.paymentMethod,
    chainId: request.chainId,
    token: request.token,
    provider: "thirdweb" as const,
    ...routeScopedAvailability,
  };
  const expectedAvailabilityKey = buildPublicFundingAvailabilityKey(availabilityInput);
  const availability = providerProofRegistry.resolve(availabilityInput);
  if (request.availabilityKey !== expectedAvailabilityKey || availability.state !== "live") {
    return publicBrowserCorsResponse(
      c,
      deps,
      safeError("funding_unavailable", "This funding method is not available yet."),
      409
    );
  }
  if (!thirdwebCheckout) {
    return publicBrowserCorsResponse(
      c,
      deps,
      safeError("provider_unavailable", "This funding provider is unavailable right now."),
      503
    );
  }
  const idempotencyFingerprint = createIdempotencyFingerprint(request, "thirdweb");
  if (!idempotencyFingerprint) {
    return publicBrowserCorsResponse(c, deps, safeError("invalid_request", "Invalid amount."), 400);
  }
  const existing = await fundingIntents.getByClientRequestId(request.clientRequestId);
  const receiptToken = createReceiptToken();
  const receiptTokenHash = hashSecret(receiptToken);
  if (existing) {
    if (existing.idempotencyFingerprint !== idempotencyFingerprint) {
      return publicBrowserCorsResponse(
        c,
        deps,
        safeError("idempotency_conflict", "This client request id was already used."),
        409
      );
    }
    const updated = await fundingIntents.update({
      ...existing,
      receiptTokenHash,
      updatedAt: new Date(now()).toISOString(),
    });
    return publicBrowserCorsResponse(c, deps, {
      ok: true,
      id: updated.id,
      status: updated.status,
      provider: "thirdweb",
      checkoutSession: updated.checkoutSession,
      quoteExpiresAt: updated.quoteExpiresAt,
      receiptToken,
      receiptUrl: buildFundingReceiptUrl(updated.sourceRoute ?? "/fund", updated.id, receiptToken),
      publicReceipt: redactFundingReceipt(updated),
    });
  }
  const currentTime = now();
  const fundingIntentId = createFundingIntentId();
  const quoteExpiresAt = new Date(currentTime + 10 * 60 * 1000).toISOString();
  let checkout;
  try {
    checkout = await thirdwebCheckout.createSession({
      fundingIntentId,
      request,
      availabilityProofReference: availability.proofReference,
      quoteExpiresAt,
    });
  } catch {
    return publicBrowserCorsResponse(
      c,
      deps,
      safeError("provider_unavailable", "This funding provider is unavailable right now."),
      503
    );
  }
  if (
    !checkout.providerSessionId ||
    parseBaseUnitAmount(checkout.quotedAssetAmount) === undefined ||
    parseBaseUnitAmount(checkout.minAssetAmount) === undefined
  ) {
    return publicBrowserCorsResponse(
      c,
      deps,
      safeError("provider_unavailable", "This funding provider is unavailable right now."),
      503
    );
  }
  const checkoutReceiverAddress =
    checkout.receiverAddress ?? checkout.checkoutSession.checkoutPayload?.receiverAddress;
  if (
    request.fundingIntent === "endow" &&
    normalizeAddress(checkoutReceiverAddress) !== normalizeAddress(request.receiverAddress)
  ) {
    return publicBrowserCorsResponse(
      c,
      deps,
      safeError("provider_unavailable", "This funding provider is unavailable right now."),
      503
    );
  }
  const record = createFundingIntentRecord({
    id: fundingIntentId,
    request,
    idempotencyFingerprint,
    receiptTokenHash,
    checkout,
    now: currentTime,
  });
  await fundingIntents.create(record);
  await fundingIntents.appendEvent(
    record.id,
    record.status,
    "funding intent checkout session created"
  );
  return publicBrowserCorsResponse(c, deps, {
    ok: true,
    id: record.id,
    status: record.status,
    provider: "thirdweb",
    checkoutSession: record.checkoutSession,
    quoteExpiresAt: record.quoteExpiresAt,
    receiptToken,
    receiptUrl: buildFundingReceiptUrl(record.sourceRoute ?? "/fund", record.id, receiptToken),
    publicReceipt: redactFundingReceipt(record),
  });
}

async function handleFundingReceipt(
  c: Context<{}, "/public/funding-intents/:id">,
  ctx: FundingRouteContext
) {
  const { deps, fundingIntents, now } = ctx;
  const originError = checkOrigin(c, deps);
  if (originError) return publicBrowserCorsResponse(c, deps, originError, 403);
  if (hasReceiptTokenQuery(c.req.raw) || (await hasReceiptTokenBody(c.req.raw))) {
    return publicBrowserCorsResponse(
      c,
      deps,
      safeError("invalid_request", "Receipt tokens must use the header."),
      400
    );
  }
  const id = c.req.param("id");
  const rateError = checkRateLimit(c, deps, "receipt_read", id);
  if (rateError) return publicBrowserCorsResponse(c, deps, rateError, 429);
  const receiptToken = c.req.header("x-gg-receipt-token");
  if (!receiptToken) {
    return publicBrowserCorsResponse(
      c,
      deps,
      safeError("receipt_token_required", "Receipt token is required."),
      401
    );
  }
  const record = await fundingIntents.getById(id);
  if (!record || record.receiptTokenHash !== hashSecret(receiptToken)) {
    return publicBrowserCorsResponse(
      c,
      deps,
      safeError("receipt_token_invalid", "Receipt token is invalid."),
      401
    );
  }
  const reconciled = expireIfAbandoned(record, now());
  if (reconciled !== record) {
    await fundingIntents.update(reconciled);
    await fundingIntents.appendEvent(reconciled.id, reconciled.status, "expired on receipt read");
  }
  return publicBrowserCorsResponse(c, deps, {
    ok: true,
    publicReceipt: redactFundingReceipt(reconciled),
  });
}
