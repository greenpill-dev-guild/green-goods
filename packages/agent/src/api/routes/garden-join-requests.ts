import {
  GARDEN_JOIN_REQUEST_DEFAULT_PAGE_SIZE,
  GARDEN_JOIN_REQUEST_MAX_PAGE_SIZE,
} from "@green-goods/shared/public-contracts/join-requests";
import type { Context, Hono } from "hono";
import { toGardenJoinRequestSelfRecord } from "../../services/garden-join-requests";
import {
  checkRateLimit,
  publicBrowserCorsPreflight,
  publicBrowserCorsResponse,
} from "../http/public";
import {
  authenticateGardenJoinRequest,
  claimGardenJoinRequestProof,
  type GardenJoinRequestRouteContext,
  gardenJoinRequestFailure,
  gardenJoinRequestsUnavailable,
  prepareGardenJoinRequest,
} from "./garden-join-request-auth";
import { handleCreateGardenJoinRequest } from "./garden-join-request-create";
import { handleGardenJoinRequestResolution } from "./garden-join-request-resolution";
import { trackGardenJoinRequestEvent } from "../../services/analytics";

export function registerGardenJoinRequestRoutes(
  app: Hono,
  ctx: GardenJoinRequestRouteContext
): void {
  const collection = "/public/gardens/:garden/join-requests";
  const mine = "/public/gardens/:garden/join-requests/me";
  const resolve = "/public/gardens/:garden/join-requests/:requestId/resolve";
  app.options(collection, (c) => publicBrowserCorsPreflight(c, ctx.deps));
  app.options(mine, (c) => publicBrowserCorsPreflight(c, ctx.deps));
  app.options(resolve, (c) => publicBrowserCorsPreflight(c, ctx.deps));
  app.post(collection, (c) => handleCreateGardenJoinRequest(c, ctx));
  app.get(collection, (c) => handleList(c, ctx));
  app.get(mine, (c) => handleMine(c, ctx));
  app.delete(mine, (c) => handleWithdraw(c, ctx));
  app.post(resolve, (c) => handleGardenJoinRequestResolution(c, ctx));
}

async function handleMine(c: Context, ctx: GardenJoinRequestRouteContext) {
  const preflight = prepareGardenJoinRequest(c, ctx);
  if (!preflight.ok) return preflight.response;
  const rateError = checkRateLimit(c, ctx.deps, "join_request_read", preflight.garden);
  if (rateError) return publicBrowserCorsResponse(c, ctx.deps, rateError, 429);
  const authenticated = await authenticateGardenJoinRequest(c, ctx, "read_self");
  if (!authenticated.ok) return authenticated.response;
  const store = ctx.store;
  const chain = ctx.deps.gardenJoinRequestChainReader;
  if (!store || !chain) return gardenJoinRequestsUnavailable(c, ctx);
  try {
    const nowIso = new Date(ctx.deps.now?.() ?? Date.now()).toISOString();
    let request = await store.getMine(preflight.garden, authenticated.proof.accountAddress, nowIso);
    if (
      request &&
      request.state !== "welcomed" &&
      (await chain.isMember(preflight.garden, authenticated.proof.accountAddress))
    ) {
      request = await store.reconcileWelcomed(preflight.garden, request.id, nowIso);
    }
    void trackGardenJoinRequestEvent("join_request_status_checked", {
      state: request?.state ?? "none",
      is_counterfactual: authenticated.proof.factory !== undefined,
    });
    return publicBrowserCorsResponse(c, ctx.deps, {
      ok: true,
      request: request ? toGardenJoinRequestSelfRecord(request) : null,
    });
  } catch {
    return gardenJoinRequestsUnavailable(c, ctx);
  }
}

async function handleWithdraw(c: Context, ctx: GardenJoinRequestRouteContext) {
  const preflight = prepareGardenJoinRequest(c, ctx);
  if (!preflight.ok) return preflight.response;
  const rateError = checkRateLimit(c, ctx.deps, "join_request_resolve", preflight.garden);
  if (rateError) return publicBrowserCorsResponse(c, ctx.deps, rateError, 429);
  const authenticated = await authenticateGardenJoinRequest(c, ctx, "withdraw");
  if (!authenticated.ok) return authenticated.response;
  const store = ctx.store;
  if (!store) return gardenJoinRequestsUnavailable(c, ctx);
  try {
    const { requestId, expectedRevision } = authenticated.proof;
    if (!requestId || expectedRevision === undefined) {
      return gardenJoinRequestFailure(
        c,
        ctx,
        "invalid_request",
        "The signed request identity is required.",
        400
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
    const withdrawn = await store.withdraw({
      gardenAddress: preflight.garden,
      accountAddress: authenticated.proof.accountAddress,
      requestId,
      expectedRevision,
    });
    if (!withdrawn)
      return gardenJoinRequestFailure(
        c,
        ctx,
        "request_not_found",
        "No pending request was found.",
        404
      );
    void trackGardenJoinRequestEvent("join_request_withdrawn", {
      kind: "garden_membership",
      is_counterfactual: authenticated.proof.factory !== undefined,
    });
    return publicBrowserCorsResponse(c, ctx.deps, { ok: true });
  } catch {
    return gardenJoinRequestsUnavailable(c, ctx);
  }
}

async function handleList(c: Context, ctx: GardenJoinRequestRouteContext) {
  const preflight = prepareGardenJoinRequest(c, ctx);
  if (!preflight.ok) return preflight.response;
  const rateError = checkRateLimit(c, ctx.deps, "join_request_read", preflight.garden);
  if (rateError) return publicBrowserCorsResponse(c, ctx.deps, rateError, 429);
  if (c.req.query("state") !== "pending") {
    return gardenJoinRequestFailure(
      c,
      ctx,
      "invalid_request",
      "Only pending join requests can be listed.",
      400
    );
  }
  const limitValue = Number(c.req.query("limit") ?? GARDEN_JOIN_REQUEST_DEFAULT_PAGE_SIZE);
  const limit = Number.isSafeInteger(limitValue)
    ? Math.min(Math.max(limitValue, 1), GARDEN_JOIN_REQUEST_MAX_PAGE_SIZE)
    : 0;
  if (!limit) {
    return gardenJoinRequestFailure(c, ctx, "invalid_request", "Invalid page size.", 400);
  }
  const cursor = c.req.query("cursor");
  const authenticated = await authenticateGardenJoinRequest(c, ctx, "list", {
    state: "pending",
    limit,
  });
  if (!authenticated.ok) return authenticated.response;
  if ((authenticated.proof.cursor ?? undefined) !== cursor) {
    return gardenJoinRequestFailure(
      c,
      ctx,
      "invalid_request",
      "The signed cursor does not match this page.",
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
    const page = await store.listPending(preflight.garden, {
      ...(cursor ? { cursor } : {}),
      limit,
      nowIso: new Date(ctx.deps.now?.() ?? Date.now()).toISOString(),
    });
    const items = [];
    const resolvedAt = new Date(ctx.deps.now?.() ?? Date.now()).toISOString();
    const membership = chain.areMembers
      ? await chain.areMembers(
          preflight.garden,
          page.items.map((request) => request.accountAddress)
        )
      : await Promise.all(
          page.items.map((request) => chain.isMember(preflight.garden, request.accountAddress))
        );
    for (const [index, request] of page.items.entries()) {
      if (membership[index]) {
        await store.reconcileWelcomed(preflight.garden, request.id, resolvedAt);
      } else {
        items.push(request);
      }
    }
    return publicBrowserCorsResponse(c, ctx.deps, {
      ok: true,
      items,
      rateLimitedRecently:
        ctx.deps.gardenJoinRequestRateLimitPressure?.hasRecent(
          preflight.garden,
          ctx.deps.now?.() ?? Date.now()
        ) ?? false,
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    });
  } catch {
    return gardenJoinRequestsUnavailable(c, ctx);
  }
}
