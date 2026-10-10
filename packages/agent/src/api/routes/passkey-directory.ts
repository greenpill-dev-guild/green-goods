import { normalizePasskeyName, PUBLIC_AGENT_ROUTES } from "@green-goods/shared/public-contracts";
import type { Context, Hono } from "hono";
import { loggers } from "../../services/logger";
import {
  type PasskeyDirectory,
  PasskeyDirectoryError,
  type PasskeyDirectoryErrorCode,
} from "../../services/passkey-directory";
import { readLimitedJsonBody } from "../http/body";
import {
  checkOrigin,
  checkRateLimit,
  publicBrowserCorsPreflight,
  publicBrowserCorsResponse,
} from "../http/public";
import type { ApiRouteContext } from "../http/route-context";
import type { PublicRouteClass } from "../public-protection";

const log = loggers.api;

const RPC_BODY_LIMIT_BYTES = 16 * 1024;

const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;
/**
 * A refusal the caller should not repeat. viem retries `-32603` and rate-limit codes on its
 * own, which would only ask the same question again.
 */
const REFUSED = -32000;

const ERROR_CODES: Record<PasskeyDirectoryErrorCode, number> = {
  invalid_name: INVALID_PARAMS,
  name_taken: REFUSED,
  origin_not_allowed: REFUSED,
  registration_expired: REFUSED,
  verification_failed: REFUSED,
  // Worth another try: the hosted name list may answer next time.
  unavailable: INTERNAL_ERROR,
};

export type PasskeyDirectoryRouteContext = ApiRouteContext & {
  passkeyDirectory: PasskeyDirectory;
};

type RpcId = string | number | null;
type RpcCall = { id: RpcId; method: string; params: unknown[] };

type RpcMethod = {
  rateLimit: Extract<PublicRouteClass, "passkey_registration" | "passkey_lookup">;
  /** The name the call concerns, so one name cannot be hammered from one address. */
  name(params: unknown[]): unknown;
  run(directory: PasskeyDirectory, params: unknown[], origin: string): Promise<unknown>;
};

/** The calls of the permissionless passkey-server client that the directory answers. */
const METHODS: Record<string, RpcMethod> = {
  pks_startRegistration: {
    rateLimit: "passkey_registration",
    name: (params) => userNameOf(params[0]),
    run: (directory, params, origin) =>
      directory.startRegistration({ userName: userNameOf(params[0]), origin }),
  },
  pks_verifyRegistration: {
    rateLimit: "passkey_registration",
    name: (params) => userNameOf(params[1]),
    run: (directory, params, origin) =>
      directory.verifyRegistration({
        response: params[0],
        userName: userNameOf(params[1]),
        origin,
      }),
  },
  pks_getCredentials: {
    rateLimit: "passkey_lookup",
    name: (params) => userNameOf(params[0]),
    run: (directory, params) => directory.getCredentials({ userName: userNameOf(params[0]) }),
  },
};

export function registerPasskeyDirectoryRoutes(app: Hono, ctx: PasskeyDirectoryRouteContext): void {
  app.options(PUBLIC_AGENT_ROUTES.passkeyDirectory, (c) => publicBrowserCorsPreflight(c, ctx.deps));
  app.post(PUBLIC_AGENT_ROUTES.passkeyDirectory, (c) => handleRpc(c, ctx));
}

async function handleRpc(c: Context, ctx: PasskeyDirectoryRouteContext) {
  const originError = checkOrigin(c, ctx.deps);
  if (originError) return publicBrowserCorsResponse(c, ctx.deps, originError, 403);
  // An allowed origin is always present; the directory still decides which domain it may use.
  const origin = c.req.header("origin") ?? "";

  const body = await readLimitedJsonBody<unknown>(c.req.raw, RPC_BODY_LIMIT_BYTES);
  if (!body.ok) return publicBrowserCorsResponse(c, ctx.deps, body.error, body.status);

  const call = readRpcCall(body.value);
  if (!call) return rpcError(c, ctx, null, INVALID_REQUEST, "Invalid request.");

  const method = METHODS[call.method];
  if (!method) return rpcError(c, ctx, call.id, METHOD_NOT_FOUND, "Method not found.");

  const name = method.name(call.params);
  const rateError = checkRateLimit(
    c,
    ctx.deps,
    method.rateLimit,
    typeof name === "string" ? normalizePasskeyName(name) : ""
  );
  if (rateError) return rpcError(c, ctx, call.id, REFUSED, rateError.message);

  try {
    const result = await method.run(ctx.passkeyDirectory, call.params, origin);
    return publicBrowserCorsResponse(c, ctx.deps, { jsonrpc: "2.0", id: call.id, result });
  } catch (err) {
    if (err instanceof PasskeyDirectoryError) {
      return rpcError(c, ctx, call.id, ERROR_CODES[err.code], err.message);
    }
    log.error({ err, method: call.method }, "Passkey directory call failed");
    return rpcError(c, ctx, call.id, INTERNAL_ERROR, "Passkey service is unavailable right now.");
  }
}

function rpcError(
  c: Context,
  ctx: PasskeyDirectoryRouteContext,
  id: RpcId,
  code: number,
  message: string
) {
  // JSON-RPC reports failures in the body: the client reads the message, not the HTTP status.
  return publicBrowserCorsResponse(c, ctx.deps, { jsonrpc: "2.0", id, error: { code, message } });
}

function readRpcCall(value: unknown): RpcCall | undefined {
  if (!isRecord(value) || value.jsonrpc !== "2.0" || typeof value.method !== "string") {
    return undefined;
  }
  const id = value.id;
  if (id !== undefined && id !== null && typeof id !== "string" && typeof id !== "number") {
    return undefined;
  }
  const params = value.params === undefined ? [] : value.params;
  if (!Array.isArray(params)) return undefined;
  return { id: id ?? null, method: value.method, params };
}

function userNameOf(context: unknown): unknown {
  return isRecord(context) ? context.userName : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
