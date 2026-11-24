import {
  PUBLIC_AGENT_ROUTES,
  type OpenfortRecoveryApiError,
} from "@green-goods/shared/public-contracts";
import type { Context, Hono } from "hono";
import { loggers } from "../../services/logger";
import { OpenfortRecoveryError } from "../../services/openfort-recovery";
import type { ApiRouteContext } from "../http/route-context";
import {
  checkMaterialRateLimit,
  checkOrigin,
  checkRateLimit,
  publicBrowserCorsPreflight,
  publicBrowserCorsResponse,
} from "../http/public";

const log = loggers.api;

function refusal(
  errorCode: OpenfortRecoveryApiError["errorCode"],
  message: string,
  params?: OpenfortRecoveryApiError["params"]
): OpenfortRecoveryApiError {
  return { ok: false, errorCode, message, ...(params ? { params } : {}) };
}

function bearerToken(c: Context): string | null {
  const header = c.req.header("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * Single-use Shield encryption sessions for email accounts. Without a configured
 * recovery service the route answers `provider_unavailable`, so the app can say recovery is off.
 */
export function registerOpenfortRecoveryRoutes(app: Hono, ctx: ApiRouteContext): void {
  const { deps } = ctx;

  app.options(PUBLIC_AGENT_ROUTES.openfortRecoverySession, (c) =>
    publicBrowserCorsPreflight(c, deps)
  );

  app.post(PUBLIC_AGENT_ROUTES.openfortRecoverySession, async (c) => {
    const respond = (body: unknown, status = 200) =>
      publicBrowserCorsResponse(c, deps, body, status);

    const originError = checkOrigin(c, deps);
    if (originError) return respond(originError, 403);

    // Every caller spends its address's quota before Openfort is asked anything.
    const rateError = checkRateLimit(c, deps, "openfort_recovery", "recovery-session");
    if (rateError) return respond(rateError, 429);

    const recovery = deps.openfortRecovery;
    if (!recovery) {
      return respond(
        refusal("provider_unavailable", "Email and phone sign-in is not available right now."),
        503
      );
    }

    const token = bearerToken(c);
    if (!token) return respond(refusal("session_required", "Sign in first."), 401);

    try {
      const { userId } = await recovery.verifySession(token);
      const accountError = checkMaterialRateLimit(deps, "openfort_recovery_account", userId);
      if (accountError) return respond(accountError, 429);
      const session = await recovery.createEncryptionSession();
      return respond({ ok: true, session });
    } catch (error) {
      if (error instanceof OpenfortRecoveryError && error.code === "session_invalid") {
        return respond(refusal("session_invalid", "Sign in again."), 401);
      }
      log.warn(
        {
          reason: error instanceof OpenfortRecoveryError ? error.message : "unexpected",
          status: error instanceof OpenfortRecoveryError ? error.status : undefined,
        },
        "Openfort recovery session unavailable"
      );
      return respond(
        refusal("provider_unavailable", "Recovery is not available right now. Try again."),
        503
      );
    }
  });
}
