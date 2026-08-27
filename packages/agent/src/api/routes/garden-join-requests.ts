import {
  GARDEN_JOIN_REQUEST_DEFAULT_PAGE_SIZE,
  GARDEN_JOIN_REQUEST_MAX_PAGE_SIZE,
  validateCreateGardenJoinRequest,
} from "@green-goods/shared/public-contracts";
import type { Context, Hono } from "hono";
import {
  GARDEN_JOIN_REQUEST_RETENTION_MS,
  toGardenJoinRequestSelfRecord,
} from "../../services/garden-join-requests";
import { readLimitedJsonBody } from "../http/body";
import {
  checkMaterialRateLimit,
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
import { handleGardenJoinRequestResolution } from "./garden-join-request-resolution";

const BODY_LIMIT_BYTES = 8 * 1024;

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
  app.post(collection, (c) => handleCreate(c, ctx));
  app.get(collection, (c) => handleList(c, ctx));
  app.get(mine, (c) => handleMine(c, ctx));
  app.delete(mine, (c) => handleWithdraw(c, ctx));
  app.post(resolve, (c) => handleGardenJoinRequestResolution(c, ctx));
}

async function handleCreate(c: Context, ctx: GardenJoinRequestRouteContext) {
  const preflight = prepareGardenJoinRequest(c, ctx);
  if (!preflight.ok) return preflight.response;
  const preAuthRateError = checkRateLimit(c, ctx.deps, "join_request_create", preflight.garden);
  if (preAuthRateError) {
    return publicBrowserCorsResponse(c, ctx.deps, preAuthRateError, 429);
  }
  const body = await readLimitedJsonBody<unknown>(c.req.raw, BODY_LIMIT_BYTES);
  if (!body.ok) return publicBrowserCorsResponse(c, ctx.deps, body.error, body.status);
  const parsed = validateCreateGardenJoinRequest(body.value);
  if (!parsed.ok) return publicBrowserCorsResponse(c, ctx.deps, parsed.error, 400);
  const authenticated = await authenticateGardenJoinRequest(c, ctx, "create", {
    displayName: parsed.value.displayName,
    note: parsed.value.note ?? null,
    requestedVia: parsed.value.requestedVia,
  });
  if (!authenticated.ok) return authenticated.response;
  const rateError =
    checkMaterialRateLimit(
      ctx.deps,
      "join_request_create_account",
      `${preflight.garden}:${authenticated.proof.accountAddress}`
    ) ?? checkMaterialRateLimit(ctx.deps, "join_request_create_garden", preflight.garden);
  if (rateError) return publicBrowserCorsResponse(c, ctx.deps, rateError, 429);

  const chain = ctx.deps.gardenJoinRequestChainReader;
  const store = ctx.store;
  if (!chain || !store) return gardenJoinRequestsUnavailable(c, ctx);
  try {
    if (await chain.isMember(preflight.garden, authenticated.proof.accountAddress)) {
      return gardenJoinRequestFailure(
        c,
        ctx,
        "already_member",
        "You are already a member of this garden.",
        409
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
    const now = ctx.deps.now?.() ?? Date.now();
    const result = await store.create({
      gardenAddress: preflight.garden,
      accountAddress: authenticated.proof.accountAddress,
      displayName: parsed.value.displayName,
      ...(parsed.value.note ? { note: parsed.value.note } : {}),
      requestedVia: parsed.value.requestedVia,
      requestedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + GARDEN_JOIN_REQUEST_RETENTION_MS).toISOString(),
    });
    if ("full" in result) {
      return gardenJoinRequestFailure(
        c,
        ctx,
        "queue_full",
        "This garden's request queue is full right now.",
        409
      );
    }
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      { ok: true, request: toGardenJoinRequestSelfRecord(result.request) },
      result.created ? 201 : 200
    );
  } catch {
    return gardenJoinRequestsUnavailable(c, ctx);
  }
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
    let request = await store.getMine(preflight.garden, authenticated.proof.accountAddress);
    if (
      request &&
      request.state !== "welcomed" &&
      (await chain.isMember(preflight.garden, authenticated.proof.accountAddress))
    ) {
      request = await store.reconcileWelcomed(
        preflight.garden,
        request.id,
        new Date(ctx.deps.now?.() ?? Date.now()).toISOString()
      );
    }
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
    if (!(await claimGardenJoinRequestProof(store, authenticated.proof))) {
      return gardenJoinRequestFailure(
        c,
        ctx,
        "idempotency_conflict",
        "This signed request was already used.",
        409
      );
    }
    const withdrawn = await store.withdraw(preflight.garden, authenticated.proof.accountAddress);
    if (!withdrawn)
      return gardenJoinRequestFailure(
        c,
        ctx,
        "request_not_found",
        "No pending request was found.",
        404
      );
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
    });
    const items = [];
    const resolvedAt = new Date(ctx.deps.now?.() ?? Date.now()).toISOString();
    for (const request of page.items) {
      if (await chain.isMember(preflight.garden, request.accountAddress)) {
        await store.reconcileWelcomed(preflight.garden, request.id, resolvedAt);
      } else {
        items.push(request);
      }
    }
    return publicBrowserCorsResponse(c, ctx.deps, {
      ok: true,
      items,
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    });
  } catch {
    return gardenJoinRequestsUnavailable(c, ctx);
  }
}
