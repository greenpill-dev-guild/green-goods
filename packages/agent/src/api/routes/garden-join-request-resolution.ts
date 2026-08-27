import {
  type GardenJoinProofContent,
  validateResolveGardenJoinRequest,
} from "@green-goods/shared/public-contracts";
import type { Context } from "hono";
import { readLimitedJsonBody } from "../http/body";
import { checkRateLimit, publicBrowserCorsResponse } from "../http/public";
import {
  authenticateGardenJoinRequest,
  claimGardenJoinRequestProof,
  type GardenJoinRequestRouteContext,
  gardenJoinRequestFailure,
  gardenJoinRequestsUnavailable,
  prepareGardenJoinRequest,
} from "./garden-join-request-auth";

const BODY_LIMIT_BYTES = 8 * 1024;

export async function handleGardenJoinRequestResolution(
  c: Context,
  ctx: GardenJoinRequestRouteContext
) {
  const preflight = prepareGardenJoinRequest(c, ctx);
  if (!preflight.ok) return preflight.response;
  const rateError = checkRateLimit(c, ctx.deps, "join_request_resolve", preflight.garden);
  if (rateError) return publicBrowserCorsResponse(c, ctx.deps, rateError, 429);
  const body = await readLimitedJsonBody<unknown>(c.req.raw, BODY_LIMIT_BYTES);
  if (!body.ok) return publicBrowserCorsResponse(c, ctx.deps, body.error, body.status);
  const parsed = validateResolveGardenJoinRequest(body.value);
  if (!parsed.ok) return publicBrowserCorsResponse(c, ctx.deps, parsed.error, 400);
  const requestId = c.req.param("requestId") ?? "";
  const action = parsed.value.action;
  const content: GardenJoinProofContent =
    action === "decline"
      ? { state: "declined", reason: parsed.value.reason }
      : { state: "welcomed" };
  const authenticated = await authenticateGardenJoinRequest(c, ctx, action, content);
  if (!authenticated.ok) return authenticated.response;
  if (
    authenticated.proof.requestId !== requestId ||
    authenticated.proof.expectedRevision !== parsed.value.expectedRevision
  ) {
    return gardenJoinRequestFailure(
      c,
      ctx,
      "invalid_request",
      "The signed request does not match this resolution.",
      400
    );
  }
  const store = ctx.store;
  const chain = ctx.deps.gardenJoinRequestChainReader;
  if (!store || !chain) return gardenJoinRequestsUnavailable(c, ctx);
  try {
    if (!(await chain.canManage(preflight.garden, authenticated.proof.accountAddress))) {
      return gardenJoinRequestFailure(
        c,
        ctx,
        "garden_role_required",
        "An operator or owner role is required.",
        403
      );
    }
    const request = await store.getById(preflight.garden, requestId);
    if (!request) {
      return gardenJoinRequestFailure(c, ctx, "request_not_found", "Join request not found.", 404);
    }
    if (request.revision !== parsed.value.expectedRevision) {
      return gardenJoinRequestFailure(
        c,
        ctx,
        "resolution_conflict",
        "This request changed. Refresh and try again.",
        409
      );
    }
    const isMember = await chain.isMember(preflight.garden, request.accountAddress);
    if (action === "welcome" && !isMember) {
      return publicBrowserCorsResponse(
        c,
        ctx.deps,
        { ok: true, request, pendingOnchainMembership: true },
        202
      );
    }
    if (!(await claimGardenJoinRequestProof(store, authenticated.proof))) {
      return gardenJoinRequestFailure(
        c,
        ctx,
        "idempotency_conflict",
        "This signed request was already used.",
        409
      );
    }
    if (isMember) {
      const welcomed = await store.reconcileWelcomed(
        preflight.garden,
        requestId,
        new Date(ctx.deps.now?.() ?? Date.now()).toISOString()
      );
      return publicBrowserCorsResponse(c, ctx.deps, { ok: true, request: welcomed });
    }
    if (parsed.value.action !== "decline") {
      return gardenJoinRequestFailure(
        c,
        ctx,
        "resolution_conflict",
        "Membership has not been confirmed yet.",
        409
      );
    }
    const resolved = await store.resolve({
      gardenAddress: preflight.garden,
      requestId,
      expectedRevision: parsed.value.expectedRevision,
      state: "declined",
      reason: parsed.value.reason,
      resolvedAt: new Date(ctx.deps.now?.() ?? Date.now()).toISOString(),
    });
    if (!resolved.ok) {
      const status = resolved.reason === "not_found" ? 404 : 409;
      return gardenJoinRequestFailure(
        c,
        ctx,
        resolved.reason === "not_found" ? "request_not_found" : "resolution_conflict",
        "This request changed. Refresh and try again.",
        status
      );
    }
    return publicBrowserCorsResponse(c, ctx.deps, { ok: true, request: resolved.request });
  } catch {
    return gardenJoinRequestsUnavailable(c, ctx);
  }
}
