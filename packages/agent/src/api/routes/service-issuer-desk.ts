import {
  SERVICE_ISSUER_DESK_ROUTE,
  encodeServiceIssuerDesk,
} from "@green-goods/shared/modules/commitment-pooling/service-issuer-desk-protocol";
import type { Hono } from "hono";
import type { ApiRouteContext } from "../http/route-context";
import { readLimitedJsonBody } from "../http/body";
import {
  checkOrigin,
  checkRateLimit,
  publicBrowserCorsPreflight,
  publicBrowserCorsResponse,
} from "../http/public";
import { ServiceIssuerDeskError } from "../../services/service-issuer-desk";
import { ServiceIssuerDeskConflict } from "../../services/db/service-issuer-desk";
import { logger } from "../../services/logger";

export function registerServiceIssuerDeskRoutes(app: Hono, ctx: ApiRouteContext): void {
  app.options(SERVICE_ISSUER_DESK_ROUTE, (c) => publicBrowserCorsPreflight(c, ctx.deps));
  app.post(SERVICE_ISSUER_DESK_ROUTE, async (c) => {
    const denied = checkOrigin(c, ctx.deps);
    if (denied) return publicBrowserCorsResponse(c, ctx.deps, denied, 403);
    const limited = checkRateLimit(c, ctx.deps, "service_issuer_desk", "desk");
    if (limited) return publicBrowserCorsResponse(c, ctx.deps, limited, 429);
    if (!ctx.deps.serviceIssuerDesk)
      return publicBrowserCorsResponse(c, ctx.deps, { ok: false, errorCode: "unavailable" }, 503);
    const body = await readLimitedJsonBody<unknown>(c.req.raw, 64 * 1024);
    if (!body.ok) return publicBrowserCorsResponse(c, ctx.deps, body.error, body.status);
    if (body.value === undefined)
      return publicBrowserCorsResponse(
        c,
        ctx.deps,
        { ok: false, errorCode: "invalid_request" },
        400
      );
    try {
      const response = await ctx.deps.serviceIssuerDesk.request(
        body.value,
        c.req.header("origin") ?? ""
      );
      return publicBrowserCorsResponse(c, ctx.deps, {
        ok: true,
        payload: encodeServiceIssuerDesk(response),
      });
    } catch (error) {
      if (error instanceof ServiceIssuerDeskError || error instanceof ServiceIssuerDeskConflict) {
        const status = error instanceof ServiceIssuerDeskError ? error.status : 409;
        return publicBrowserCorsResponse(
          c,
          ctx.deps,
          { ok: false, errorCode: error.code },
          status as 400 | 401 | 403 | 404 | 409
        );
      }
      logger.warn({ operation: "service_issuer_desk" }, "Service issuer desk unavailable");
      return publicBrowserCorsResponse(c, ctx.deps, { ok: false, errorCode: "unavailable" }, 503);
    }
  });
}
