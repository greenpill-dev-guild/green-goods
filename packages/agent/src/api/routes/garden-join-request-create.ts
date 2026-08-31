import {
  GARDEN_JOIN_REQUEST_RETENTION_MS,
  toGardenJoinRequestSelfRecord,
} from "../../services/garden-join-requests";
import { trackGardenJoinRequestEvent } from "../../services/analytics";
import { readLimitedJsonBody } from "../http/body";
import {
  checkMaterialRateLimit,
  checkRateLimit,
  publicBrowserCorsResponse,
  releaseMaterialRateLimit,
} from "../http/public";
import {
  authenticateGardenJoinRequest,
  claimGardenJoinRequestProof,
  type GardenJoinRequestRouteContext,
  gardenJoinRequestFailure,
  gardenJoinRequestsUnavailable,
  prepareGardenJoinRequest,
} from "./garden-join-request-auth";
import { validateCreateGardenJoinRequest } from "@green-goods/shared/public-contracts/join-requests";
import type { Context } from "hono";

const BODY_LIMIT_BYTES = 8 * 1024;

export async function handleCreateGardenJoinRequest(
  c: Context,
  ctx: GardenJoinRequestRouteContext
) {
  const preflight = prepareGardenJoinRequest(c, ctx);
  if (!preflight.ok) return preflight.response;
  const preAuthRateError = checkRateLimit(c, ctx.deps, "join_request_create", preflight.garden);
  if (preAuthRateError) {
    ctx.deps.gardenJoinRequestRateLimitPressure?.mark(
      preflight.garden,
      ctx.deps.now?.() ?? Date.now()
    );
    void trackCreateRejected("rate_limited");
    return publicBrowserCorsResponse(c, ctx.deps, preAuthRateError, 429);
  }
  const body = await readLimitedJsonBody<unknown>(c.req.raw, BODY_LIMIT_BYTES);
  if (!body.ok) {
    void trackCreateRejected("invalid_request");
    return publicBrowserCorsResponse(c, ctx.deps, body.error, body.status);
  }
  const parsed = validateCreateGardenJoinRequest(body.value);
  if (!parsed.ok) {
    void trackCreateRejected("invalid_request");
    return publicBrowserCorsResponse(c, ctx.deps, parsed.error, 400);
  }
  const authenticated = await authenticateGardenJoinRequest(c, ctx, "create", {
    displayName: parsed.value.displayName,
    note: parsed.value.note ?? null,
    requestedVia: parsed.value.requestedVia,
  });
  if (!authenticated.ok) {
    void trackCreateRejected(
      authenticated.response.status >= 500 ? "service_unavailable" : "authentication_failed"
    );
    return authenticated.response;
  }
  const rateError = checkMaterialRateLimit(
    ctx.deps,
    "join_request_create_account",
    `${preflight.garden}:${authenticated.proof.accountAddress}`
  );
  if (rateError) {
    ctx.deps.gardenJoinRequestRateLimitPressure?.mark(
      preflight.garden,
      ctx.deps.now?.() ?? Date.now()
    );
    void trackCreateRejected("rate_limited", authenticated.proof.factory !== undefined);
    return publicBrowserCorsResponse(c, ctx.deps, rateError, 429);
  }

  const chain = ctx.deps.gardenJoinRequestChainReader;
  const store = ctx.store;
  if (!chain || !store) {
    void trackCreateRejected("service_unavailable", authenticated.proof.factory !== undefined);
    return gardenJoinRequestsUnavailable(c, ctx);
  }
  let gardenRateLimitReserved = false;
  try {
    if (await chain.isOpenJoining(preflight.garden)) {
      void trackCreateRejected("open_joining", authenticated.proof.factory !== undefined);
      return gardenJoinRequestFailure(
        c,
        ctx,
        "open_joining_enabled",
        "This garden is open. Join it directly instead.",
        409
      );
    }
    if (await chain.isMember(preflight.garden, authenticated.proof.accountAddress)) {
      void trackCreateRejected("already_member", authenticated.proof.factory !== undefined);
      return gardenJoinRequestFailure(
        c,
        ctx,
        "already_member",
        "You are already a member of this garden.",
        409
      );
    }
    const gardenRateError = checkMaterialRateLimit(
      ctx.deps,
      "join_request_create_garden",
      preflight.garden
    );
    if (gardenRateError) {
      ctx.deps.gardenJoinRequestRateLimitPressure?.mark(
        preflight.garden,
        ctx.deps.now?.() ?? Date.now()
      );
      void trackCreateRejected("rate_limited", authenticated.proof.factory !== undefined);
      return publicBrowserCorsResponse(c, ctx.deps, gardenRateError, 429);
    }
    gardenRateLimitReserved = true;
    if (!(await claimGardenJoinRequestProof(store, authenticated.proof))) {
      releaseMaterialRateLimit(ctx.deps, "join_request_create_garden", preflight.garden);
      gardenRateLimitReserved = false;
      void trackCreateRejected("proof_replayed", authenticated.proof.factory !== undefined);
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
    if (!result.created) {
      releaseMaterialRateLimit(ctx.deps, "join_request_create_garden", preflight.garden);
      gardenRateLimitReserved = false;
    }
    if ("full" in result) {
      void trackCreateRejected("queue_full", authenticated.proof.factory !== undefined);
      return gardenJoinRequestFailure(
        c,
        ctx,
        "queue_full",
        "This garden's request queue is full right now.",
        409
      );
    }
    void trackGardenJoinRequestEvent("join_request_created", {
      kind: "garden_membership",
      requested_via: parsed.value.requestedVia,
      is_counterfactual: authenticated.proof.factory !== undefined,
      retry: !result.created,
    });
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      { ok: true, request: toGardenJoinRequestSelfRecord(result.request) },
      result.created ? 201 : 200
    );
  } catch {
    if (gardenRateLimitReserved) {
      releaseMaterialRateLimit(ctx.deps, "join_request_create_garden", preflight.garden);
    }
    void trackCreateRejected("service_unavailable", authenticated.proof.factory !== undefined);
    return gardenJoinRequestsUnavailable(c, ctx);
  }
}

function trackCreateRejected(
  errorClass:
    | "already_member"
    | "authentication_failed"
    | "invalid_request"
    | "open_joining"
    | "proof_replayed"
    | "queue_full"
    | "rate_limited"
    | "service_unavailable",
  isCounterfactual = false
): Promise<void> {
  return trackGardenJoinRequestEvent("join_request_create_rejected", {
    kind: "garden_membership",
    error_class: errorClass,
    is_counterfactual: isCounterfactual,
    retry: false,
  });
}
