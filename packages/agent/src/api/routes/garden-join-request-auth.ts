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
import { checkOrigin, publicBrowserCorsResponse } from "../http/public";
import type { ApiRouteContext } from "../http/route-context";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export type GardenJoinRequestRouteContext = ApiRouteContext & {
  store?: GardenJoinRequestStore;
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
    return { ok: false, response: gardenJoinRequestsUnavailable(c, ctx) };
  }
  const validation = validateGardenJoinProofEnvelope(
    decodeGardenJoinAuthorization(c.req.header("authorization")),
    {
      nowSeconds: Math.floor((ctx.deps.now?.() ?? Date.now()) / 1000),
      expectedAction,
      allowedChainIds: [chainId],
    }
  );
  if (!validation.ok) {
    const status = validation.error.errorCode === "signature_expired" ? 401 : 400;
    return {
      ok: false,
      response: publicBrowserCorsResponse(c, ctx.deps, validation.error, status),
    };
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
    const verified = await verifier({
      chainId: validation.value.chainId,
      address: validation.value.accountAddress,
      message: buildGardenJoinProofMessage(messageProof, content),
      signature,
      ...(factory && factoryData ? { factory, factoryData } : {}),
    });
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
  } catch {
    return { ok: false, response: gardenJoinRequestsUnavailable(c, ctx) };
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

export function gardenJoinRequestsUnavailable(c: Context, ctx: GardenJoinRequestRouteContext) {
  return gardenJoinRequestFailure(
    c,
    ctx,
    "provider_unavailable",
    "Garden join requests are unavailable right now.",
    503
  );
}

function normalizeAddress(value: string | undefined): Address | null {
  return value && ADDRESS_PATTERN.test(value) ? (value.toLowerCase() as Address) : null;
}
