import {
  PUBLIC_AGENT_ROUTES,
  validatePublicUploadSignRequest,
} from "@green-goods/shared/public-contracts";
import type { Hono } from "hono";
import {
  createPinataSignedUploadUrl,
  DEFAULT_UPLOAD_SIGN_ALLOWED_MIME_TYPES,
  DEFAULT_UPLOAD_SIGN_MAX_FILE_SIZE,
  DEFAULT_UPLOAD_SIGN_TTL_SECONDS,
  normalizeUploadSignerConfig,
  PinataUploadSignerConfigError,
} from "../../services/pinata-upload-signer";
import { loggers } from "../../services/logger";
import { readLimitedJsonBody } from "../http/body";
import type { ApiRouteContext } from "../http/route-context";
import {
  checkOrigin,
  checkRateLimitWithPolicy,
  publicBrowserCorsPreflight,
  publicBrowserCorsResponse,
} from "../http/public";
import { safeError } from "../http/responses";
import { PUBLIC_RATE_LIMIT_POLICIES } from "../public-protection";

const log = loggers.api;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const UPLOAD_SIGN_BODY_LIMIT_BYTES = 8 * 1024;
const MAX_UPLOAD_SIGN_TTL_SECONDS = 10 * 60;
const MAX_UPLOAD_SIGN_SIZE_BYTES = 100 * 1024 * 1024;

export function registerUploadSignRoutes(app: Hono, ctx: ApiRouteContext): void {
  const { deps } = ctx;

  app.options(PUBLIC_AGENT_ROUTES.uploadSign, (c) => {
    return publicBrowserCorsPreflight(c, deps);
  });

  app.post(PUBLIC_AGENT_ROUTES.uploadSign, async (c) => {
    const originError = checkOrigin(c, deps);
    if (originError) return publicBrowserCorsResponse(c, deps, originError, 403);

    const config = getUploadSigningConfig(ctx);
    if (!config.jwt) {
      return publicBrowserCorsResponse(
        c,
        deps,
        safeError("provider_unavailable", "Upload signing is unavailable right now."),
        503
      );
    }

    const bodyResult = await readLimitedJsonBody<unknown>(c.req.raw, UPLOAD_SIGN_BODY_LIMIT_BYTES);
    if (!bodyResult.ok)
      return publicBrowserCorsResponse(c, deps, bodyResult.error, bodyResult.status);

    const validation = validatePublicUploadSignRequest(bodyResult.value, {
      allowedMimeTypes: config.allowedMimeTypes,
      maxFileSize: config.maxFileSize,
      isAddress,
    });
    if (!validation.ok) return publicBrowserCorsResponse(c, deps, validation.error, 400);
    const { request } = validation;

    const rateError = checkRateLimitWithPolicy(
      c,
      deps,
      "upload_sign",
      [request.category ?? "file_upload", request.mimeType].join(":"),
      getUploadSignRateLimitPolicy(ctx)
    );
    if (rateError) return publicBrowserCorsResponse(c, deps, rateError, 429);

    try {
      const signUpload = deps.signPinataUploadUrl ?? createPinataSignedUploadUrl;
      const url = await signUpload(request, {
        jwt: config.jwt,
        uploadsApiBaseUrl: config.uploadsApiBaseUrl,
        ttlSeconds: config.ttlSeconds,
        maxFileSize: config.maxFileSize,
        allowedMimeTypes: config.allowedMimeTypes,
        fetch: config.fetch,
        now: config.now,
      });

      return publicBrowserCorsResponse(c, deps, {
        ok: true,
        url,
        expiresAt: Math.floor(config.now() / 1000) + config.ttlSeconds,
        maxFileSize: config.maxFileSize,
        allowedMimeTypes: config.allowedMimeTypes,
      });
    } catch (error) {
      if (!(error instanceof PinataUploadSignerConfigError)) {
        log.warn({ err: error }, "Pinata upload signing failed");
      }
      return publicBrowserCorsResponse(
        c,
        deps,
        safeError("provider_unavailable", "Upload signing is unavailable right now."),
        503
      );
    }
  });
}

function getUploadSigningConfig(ctx: ApiRouteContext) {
  const { deps } = ctx;
  return normalizeUploadSignerConfig({
    jwt: deps.uploadSigning?.pinataJwt ?? process.env.PINATA_JWT,
    uploadsApiBaseUrl:
      deps.uploadSigning?.pinataUploadsApiBaseUrl ?? process.env.PINATA_UPLOADS_API_URL,
    ttlSeconds: clampPositiveInteger(
      deps.uploadSigning?.ttlSeconds,
      DEFAULT_UPLOAD_SIGN_TTL_SECONDS,
      MAX_UPLOAD_SIGN_TTL_SECONDS
    ),
    maxFileSize: clampPositiveInteger(
      deps.uploadSigning?.maxFileSize,
      DEFAULT_UPLOAD_SIGN_MAX_FILE_SIZE,
      MAX_UPLOAD_SIGN_SIZE_BYTES
    ),
    allowedMimeTypes:
      deps.uploadSigning?.allowedMimeTypes ?? DEFAULT_UPLOAD_SIGN_ALLOWED_MIME_TYPES,
    fetch: deps.uploadSigning?.fetch,
    now: deps.now,
  });
}

function getUploadSignRateLimitPolicy(ctx: ApiRouteContext) {
  const { deps } = ctx;
  return {
    limit:
      positiveInteger(deps.uploadSigning?.rateLimit) ??
      PUBLIC_RATE_LIMIT_POLICIES.upload_sign.limit,
    windowMs:
      positiveInteger(deps.uploadSigning?.rateLimitWindowMs) ??
      PUBLIC_RATE_LIMIT_POLICIES.upload_sign.windowMs,
  };
}

function clampPositiveInteger(value: number | undefined, fallback: number, max: number): number {
  const parsed = positiveInteger(value) ?? fallback;
  return Math.min(parsed, max);
}

function positiveInteger(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && ADDRESS_RE.test(value);
}
