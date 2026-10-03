import {
  buildGardenJoinProofMessage,
  decodeGardenJoinAuthorization,
  validateGardenJoinProofEnvelope,
  type GardenJoinProofAction,
  type GardenJoinProofContent,
  type GardenJoinProofEnvelope,
  type GardenJoinRequestApiErrorCode,
} from "@green-goods/shared/public-contracts/join-requests";
import type { Address } from "@green-goods/shared/public-contracts";
import type { Context } from "hono";
import type { GardenJoinRequestStore } from "../../services/garden-join-requests";
import { logger } from "../../services/logger";
import { checkOrigin, publicBrowserCorsResponse } from "../http/public";
import type { ApiRouteContext } from "../http/route-context";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export type GardenJoinRequestRouteContext = ApiRouteContext & {
  store?: GardenJoinRequestStore;
  budget?: ReturnType<typeof import("./garden-join-request-budget").createGardenJoinRequestBudget>;
};

export function prepareGardenJoinRequest(c: Context, ctx: GardenJoinRequestRouteContext) {
  const originError = checkOrigin(c, ctx.deps);
  if (originError) {
    return {
      ok: false as const,
      response: publicBrowserCorsResponse(c, ctx.deps, originError, 403),
    };
  }
  const garden = normalizeAddress(c.req.param("garden"));
  if (!garden) {
    return {
      ok: false as const,
      response: gardenJoinRequestFailure(c, ctx, "invalid_request", "Invalid garden address.", 400),
    };
  }
  return { ok: true as const, garden };
}

export async function authenticateGardenJoinRequest(
  c: Context,
  ctx: GardenJoinRequestRouteContext,
  expectedAction: GardenJoinProofAction,
  content: GardenJoinProofContent = {}
): Promise<{ ok: true; proof: GardenJoinProofEnvelope } | { ok: false; response: Response }> {
  const chainId = ctx.deps.gardenJoinRequestChainId;
  const verifier = ctx.deps.gardenJoinRequestSignatureVerifier;
  if (!chainId || !verifier) {
    return {
      ok: false,
      response: gardenJoinRequestsUnavailable(c, ctx, expectedAction === "create"),
    };
  }
  const envelope = decodeGardenJoinAuthorization(c.req.header("authorization"));
  const grantsRead =
    expectedAction === "read_self" &&
    envelope !== null &&
    typeof envelope === "object" &&
    "action" in envelope &&
    envelope.action === "create" &&
    "readSelf" in envelope;
  const validation = validateGardenJoinProofEnvelope(envelope, {
    nowSeconds: Math.floor((ctx.deps.now?.() ?? Date.now()) / 1000),
    expectedAction: grantsRead ? "create" : expectedAction,
    allowedChainIds: [chainId],
  });
  if (!validation.ok) {
    const status = validation.error.errorCode === "signature_expired" ? 401 : 400;
    return {
      ok: false,
      response: publicBrowserCorsResponse(c, ctx.deps, validation.error, status),
    };
  }
  if (validation.value.readSelf && validation.value.readSelf.audience !== c.req.header("origin")) {
    return {
      ok: false,
      response: gardenJoinRequestFailure(
        c,
        ctx,
        "signature_invalid",
        "The status authorization audience does not match.",
        401
      ),
    };
  }
  if (expectedAction === "create" && validation.value.readSelf) {
    const signed = validation.value.readSelf.content;
    if (
      signed.displayName !== content.displayName ||
      (signed.note ?? null) !== (content.note ?? null) ||
      signed.requestedVia !== content.requestedVia
    ) {
      return {
        ok: false,
        response: gardenJoinRequestFailure(
          c,
          ctx,
          "invalid_request",
          "The signed introduction does not match this request.",
          400
        ),
      };
    }
  }
  const garden = normalizeAddress(c.req.param("garden"));
  if (!garden || validation.value.gardenAddress !== garden) {
    return {
      ok: false,
      response: gardenJoinRequestFailure(
        c,
        ctx,
        "invalid_request",
        "The signed garden does not match this request.",
        400
      ),
    };
  }
  const { signature, factory, factoryData, ...messageProof } = validation.value;
  try {
    const verify = () =>
      verifier({
        chainId: validation.value.chainId,
        address: validation.value.accountAddress,
        message: buildGardenJoinProofMessage(messageProof, content),
        signature,
        ...(factory && factoryData ? { factory, factoryData } : {}),
      });
    const verified = ctx.budget ? await ctx.budget.run(verify) : await verify();
    if (!verified) {
      return {
        ok: false,
        response: gardenJoinRequestFailure(
          c,
          ctx,
          "signature_invalid",
          "The join-request signature is invalid.",
          401
        ),
      };
    }
    return { ok: true, proof: validation.value };
  } catch (error) {
    reportGardenJoinRequestUnavailable(expectedAction, "signature_verification", error);
    return {
      ok: false,
      response: gardenJoinRequestsUnavailable(c, ctx, expectedAction === "create"),
    };
  }
}

export function claimGardenJoinRequestProof(
  store: GardenJoinRequestStore,
  proof: GardenJoinProofEnvelope
) {
  return store.claimProof(proof.nonce, new Date(proof.expiresAt * 1000).toISOString());
}

export function gardenJoinRequestFailure(
  c: Context,
  ctx: GardenJoinRequestRouteContext,
  errorCode: GardenJoinRequestApiErrorCode,
  message: string,
  status: number
) {
  return publicBrowserCorsResponse(c, ctx.deps, { ok: false, errorCode, message }, status);
}

/**
 * An error's class name ends in `Error` or `Exception`. `name` is writable, so a name in any
 * other shape is not a class name and could carry the same URL or address the message does:
 * it is logged as `unknown`. The client's failure telemetry applies the same rule to its own
 * sink (`modules/garden-join-requests/analytics.ts`).
 */
function loggableErrorName(name: string): string {
  return /^[A-Za-z]{0,40}(Error|Exception)$/.test(name) ? name : "unknown";
}

/**
 * Record why a join-request operation answered "unavailable".
 *
 * Every route turns a thrown dependency into the same 503, so without this the
 * chain read, the signature check, and the store all fail identically and
 * silently. The caught error can carry an RPC URL with its key or an account
 * address, so only the operation, the stage it failed in, and the error's class
 * name are kept.
 */
export function reportGardenJoinRequestUnavailable(
  operation: string,
  stage: string,
  error: unknown
): void {
  const errorName = error instanceof Error ? loggableErrorName(error.name) : typeof error;
  logger.error({ operation, stage, errorName }, "Garden join request operation unavailable");
}

export function gardenJoinRequestsUnavailable(
  c: Context,
  ctx: GardenJoinRequestRouteContext,
  createNotAttempted = false
) {
  return gardenJoinRequestFailure(
    c,
    ctx,
    createNotAttempted ? "request_not_saved" : "provider_unavailable",
    createNotAttempted
      ? "This attempt did not save a request. Please try again."
      : "Garden join requests are unavailable right now.",
    503
  );
}

function normalizeAddress(value: string | undefined): Address | null {
  return value && ADDRESS_PATTERN.test(value) ? (value.toLowerCase() as Address) : null;
}
