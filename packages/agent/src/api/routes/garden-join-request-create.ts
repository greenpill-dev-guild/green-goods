import { createGardenJoinRequestBudget } from "./garden-join-request-budget";
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
  reportGardenJoinRequestUnavailable,
} from "./garden-join-request-auth";
import {
  validateCreateGardenJoinRequest,
  type GardenJoinRequestKind,
} from "@green-goods/shared/public-contracts/join-requests";
import type { Context } from "hono";

const BODY_LIMIT_BYTES = 8 * 1024;

export async function handleCreateGardenJoinRequest(
  c: Context,
  ctx: GardenJoinRequestRouteContext
) {
  ctx = {
    ...ctx,
    budget: createGardenJoinRequestBudget(ctx.deps.now ?? Date.now, c.req.raw.signal),
  };
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
  const kind = parsed.value.kind ?? "garden_membership";
  const authenticated = await authenticateGardenJoinRequest(
    c,
    ctx,
    "create",
    {
      displayName: parsed.value.displayName,
      note: parsed.value.note ?? null,
      requestedVia: parsed.value.requestedVia,
    },
    kind
  );
  if (!authenticated.ok) {
    void trackCreateRejected(
      authenticated.response.status >= 500 ? "service_unavailable" : "authentication_failed",
      false,
      "signature_verification",
      kind
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
    void trackCreateRejected(
      "rate_limited",
      authenticated.proof.factory !== undefined,
      undefined,
      kind
    );
    return publicBrowserCorsResponse(c, ctx.deps, rateError, 429);
  }

  const chain = ctx.deps.gardenJoinRequestChainReader;
  const store = ctx.store;
  if (!chain || !store) {
    void trackCreateRejected(
      "service_unavailable",
      authenticated.proof.factory !== undefined,
      undefined,
      kind
    );
    return gardenJoinRequestsUnavailable(c, ctx, true);
  }
  let gardenRateLimitReserved = false;
  // Which dependency the request was waiting on, so a 503 names its cause.
  let stage: CreateStage = kind === "steward_access" ? "steward_read" : "open_joining_read";
  try {
    if (kind === "steward_access") {
      if (
        await ctx.budget!.run(() =>
          chain.isSteward(preflight.garden, authenticated.proof.accountAddress)
        )
      ) {
        void trackCreateRejected(
          "already_steward",
          authenticated.proof.factory !== undefined,
          undefined,
          kind
        );
        return gardenJoinRequestFailure(
          c,
          ctx,
          "already_steward",
          "You already have steward access to this garden.",
          409
        );
      }
    } else {
      const [opening, membership] = await ctx.budget!.run(() =>
        Promise.allSettled([
          chain.isOpenJoining(preflight.garden),
          chain.isMember(preflight.garden, authenticated.proof.accountAddress),
        ])
      );
      if (opening.status === "rejected") throw opening.reason;
      if (opening.value) {
        void trackCreateRejected(
          "open_joining",
          authenticated.proof.factory !== undefined,
          undefined,
          kind
        );
        return gardenJoinRequestFailure(
          c,
          ctx,
          "open_joining_enabled",
          "This garden is open. Join it directly instead.",
          409
        );
      }
      stage = "membership_read";
      if (membership.status === "rejected") throw membership.reason;
      if (membership.value) {
        void trackCreateRejected(
          "already_member",
          authenticated.proof.factory !== undefined,
          undefined,
          kind
        );
        return gardenJoinRequestFailure(
          c,
          ctx,
          "already_member",
          "You are already a member of this garden.",
          409
        );
      }
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
      void trackCreateRejected(
        "rate_limited",
        authenticated.proof.factory !== undefined,
        undefined,
        kind
      );
      return publicBrowserCorsResponse(c, ctx.deps, gardenRateError, 429);
    }
    gardenRateLimitReserved = true;
    stage = "proof_claim";
    // Proof consumption starts the write. Check admission once, then let both
    // mutations finish even if the read budget expires or the client disconnects.
    ctx.budget!.assertRemaining();
    if (!(await claimGardenJoinRequestProof(store, authenticated.proof))) {
      releaseMaterialRateLimit(ctx.deps, "join_request_create_garden", preflight.garden);
      gardenRateLimitReserved = false;
      void trackCreateRejected(
        "proof_replayed",
        authenticated.proof.factory !== undefined,
        undefined,
        kind
      );
      return gardenJoinRequestFailure(
        c,
        ctx,
        "idempotency_conflict",
        "This signed request was already used.",
        409
      );
    }
    const now = ctx.deps.now?.() ?? Date.now();
    stage = "store_create";
    const result = await store.create({
      gardenAddress: preflight.garden,
      accountAddress: authenticated.proof.accountAddress,
      kind,
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
      void trackCreateRejected(
        "queue_full",
        authenticated.proof.factory !== undefined,
        undefined,
        kind
      );
      return gardenJoinRequestFailure(
        c,
        ctx,
        "queue_full",
        "This garden's request queue is full right now.",
        409
      );
    }
    void trackGardenJoinRequestEvent("join_request_created", {
      kind,
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
  } catch (error) {
    if (gardenRateLimitReserved) {
      releaseMaterialRateLimit(ctx.deps, "join_request_create_garden", preflight.garden);
    }
    reportGardenJoinRequestUnavailable("create", stage, error);
    void trackCreateRejected(
      "service_unavailable",
      authenticated.proof.factory !== undefined,
      stage,
      kind
    );
    // Before store.create no join request can have been written by this attempt.
    // A store failure may happen after commit; only a signed status read can reconcile it.
    return gardenJoinRequestsUnavailable(c, ctx, stage !== "store_create");
  }
}

type CreateStage =
  | "signature_verification"
  | "open_joining_read"
  | "membership_read"
  | "steward_read"
  | "proof_claim"
  | "store_create";

function trackCreateRejected(
  errorClass:
    | "already_member"
    | "already_steward"
    | "authentication_failed"
    | "invalid_request"
    | "open_joining"
    | "proof_replayed"
    | "queue_full"
    | "rate_limited"
    | "service_unavailable",
  isCounterfactual = false,
  stage?: CreateStage,
  kind: GardenJoinRequestKind = "garden_membership"
): Promise<void> {
  return trackGardenJoinRequestEvent("join_request_create_rejected", {
    kind,
    error_class: errorClass,
    is_counterfactual: isCounterfactual,
    retry: false,
    ...(stage ? { stage } : {}),
  });
}
