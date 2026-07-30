import {
  buildProfileAvatarMessage,
  normalizeProfileAvatarAddress,
  PROFILE_AVATAR_ROUTE,
  validateProfileAvatarRequest,
  type ProfileAvatarApiError,
} from "@green-goods/shared/profile-avatar/protocol";
import type { Context, Hono } from "hono";
import { readLimitedJsonBody } from "../http/body";
import {
  checkOrigin,
  checkRateLimit,
  publicBrowserCorsPreflight,
  publicBrowserCorsResponse,
} from "../http/public";
import { safeError } from "../http/responses";
import type { ApiRouteContext } from "../http/route-context";
import type { ProfileAvatarStore } from "../../services/profile-avatars";

const AVATAR_BODY_LIMIT_BYTES = 8 * 1024;
const SIGNATURE_MAX_AGE_SECONDS = 5 * 60;
const SIGNATURE_MAX_FUTURE_SKEW_SECONDS = 30;
export type ProfileAvatarRouteContext = ApiRouteContext & {
  profileAvatarStore: ProfileAvatarStore;
};

export function registerProfileAvatarRoutes(app: Hono, ctx: ProfileAvatarRouteContext): void {
  app.options(PROFILE_AVATAR_ROUTE, (c) => publicBrowserCorsPreflight(c, ctx.deps));
  app.get(PROFILE_AVATAR_ROUTE, (c) => handleRead(c, ctx));
  app.post(PROFILE_AVATAR_ROUTE, (c) => handleMutation(c, ctx));
}

async function handleRead(
  c: Context<{}, "/public/profile-avatars/:chainId/:address">,
  ctx: ProfileAvatarRouteContext
) {
  const originError = checkOrigin(c, ctx.deps);
  if (originError) return publicBrowserCorsResponse(c, ctx.deps, originError, 403);

  const target = validateTarget(c, ctx);
  if (!target.ok) return publicBrowserCorsResponse(c, ctx.deps, target.error, target.status);

  const rateError = checkRateLimit(c, ctx.deps, "profile_avatar_read", "profile_avatar_read");
  if (rateError) return publicBrowserCorsResponse(c, ctx.deps, rateError, 429);

  try {
    const record = await ctx.profileAvatarStore.get(target.chainId, target.address);
    return publicBrowserCorsResponse(c, ctx.deps, {
      ok: true,
      record: record ?? {
        chainId: target.chainId,
        address: target.address,
        avatarUri: null,
        version: 0,
        updatedAt: null,
      },
    });
  } catch {
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      safeError("provider_unavailable", "Avatar storage is unavailable right now."),
      503
    );
  }
}

async function handleMutation(
  c: Context<{}, "/public/profile-avatars/:chainId/:address">,
  ctx: ProfileAvatarRouteContext
) {
  const originError = checkOrigin(c, ctx.deps);
  if (originError) return publicBrowserCorsResponse(c, ctx.deps, originError, 403);

  const bodyResult = await readLimitedJsonBody<unknown>(c.req.raw, AVATAR_BODY_LIMIT_BYTES);
  if (!bodyResult.ok)
    return publicBrowserCorsResponse(c, ctx.deps, bodyResult.error, bodyResult.status);

  const configuredChainId = ctx.deps.profileAvatarChainId;
  const validation = validateProfileAvatarRequest(
    Number(c.req.param("chainId")),
    c.req.param("address"),
    bodyResult.value,
    {
      now: () => Math.floor((ctx.deps.now?.() ?? Date.now()) / 1000),
      allowedChainIds: configuredChainId === undefined ? [] : [configuredChainId],
      maxIssuedAtAgeSeconds: SIGNATURE_MAX_AGE_SECONDS,
      maxFutureSkewSeconds: SIGNATURE_MAX_FUTURE_SKEW_SECONDS,
    }
  );
  if (!validation.ok) return publicBrowserCorsResponse(c, ctx.deps, validation.error, 400);
  const address = normalizeProfileAvatarAddress(validation.value.address);
  if (!address) {
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      safeError("invalid_request", "Invalid account address."),
      400
    );
  }

  const rateError = checkRateLimit(
    c,
    ctx.deps,
    "profile_avatar_mutation",
    "profile_avatar_mutation"
  );
  if (rateError) return publicBrowserCorsResponse(c, ctx.deps, rateError, 429);

  const existing = await readExistingVersion(c, ctx, validation.value.chainId, address);
  if (!existing.ok) return existing.response;
  if (existing.version !== validation.value.expectedVersion) {
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      profileAvatarError(
        "version_conflict",
        "The avatar was updated elsewhere. Refresh and try again."
      ),
      409
    );
  }

  const verifier = ctx.deps.profileAvatarSignatureVerifier;
  if (!verifier) {
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      safeError("provider_unavailable", "Avatar verification is unavailable right now."),
      503
    );
  }

  let verified: boolean;
  try {
    verified = await verifier({
      chainId: validation.value.chainId,
      address,
      message: buildProfileAvatarMessage(validation.value),
      signature: validation.value.signature,
      ...(validation.value.factory && validation.value.factoryData
        ? { factory: validation.value.factory, factoryData: validation.value.factoryData }
        : {}),
    });
  } catch {
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      safeError("provider_unavailable", "Avatar verification is unavailable right now."),
      503
    );
  }
  if (!verified) {
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      profileAvatarError("signature_invalid", "The avatar signature is invalid."),
      401
    );
  }

  try {
    const result = await ctx.profileAvatarStore.compareAndSwap({
      chainId: validation.value.chainId,
      address,
      avatarUri: validation.value.avatarUri,
      expectedVersion: validation.value.expectedVersion,
      updatedAt: new Date(ctx.deps.now?.() ?? Date.now()).toISOString(),
    });
    if (!result.ok) {
      return publicBrowserCorsResponse(
        c,
        ctx.deps,
        profileAvatarError(
          "version_conflict",
          "The avatar was updated elsewhere. Refresh and try again."
        ),
        409
      );
    }
    return publicBrowserCorsResponse(c, ctx.deps, { ok: true, record: result.record });
  } catch {
    return publicBrowserCorsResponse(
      c,
      ctx.deps,
      safeError("provider_unavailable", "Avatar storage is unavailable right now."),
      503
    );
  }
}

function validateTarget(c: Context, ctx: ProfileAvatarRouteContext) {
  const configuredChainId = ctx.deps.profileAvatarChainId;
  const chainId = Number(c.req.param("chainId"));
  const address = normalizeProfileAvatarAddress(c.req.param("address") ?? "");
  if (!Number.isSafeInteger(chainId) || chainId <= 0 || !address) {
    return {
      ok: false as const,
      status: 400 as const,
      error: safeError("invalid_request", "Invalid avatar record."),
    };
  }
  if (configuredChainId === undefined) {
    return {
      ok: false as const,
      status: 503 as const,
      error: safeError("provider_unavailable", "Avatar verification is unavailable right now."),
    };
  }
  if (chainId !== configuredChainId) {
    return {
      ok: false as const,
      status: 400 as const,
      error: profileAvatarError("chain_unsupported", "Unsupported chain."),
    };
  }
  return { ok: true as const, chainId, address };
}

function profileAvatarError(
  errorCode: ProfileAvatarApiError["errorCode"],
  message: string
): ProfileAvatarApiError {
  return { ok: false, errorCode, message };
}

async function readExistingVersion(
  c: Context,
  ctx: ProfileAvatarRouteContext,
  chainId: number,
  address: Parameters<ProfileAvatarStore["get"]>[1]
): Promise<{ ok: true; version: number } | { ok: false; response: Response }> {
  try {
    const existing = await ctx.profileAvatarStore.get(chainId, address);
    return { ok: true, version: existing?.version ?? 0 };
  } catch {
    return {
      ok: false,
      response: publicBrowserCorsResponse(
        c,
        ctx.deps,
        safeError("provider_unavailable", "Avatar storage is unavailable right now."),
        503
      ),
    };
  }
}
