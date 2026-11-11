import { VOUCHER_AWARDS_ROUTE } from "@green-goods/shared/public-contracts";
import type { Hono } from "hono";
import type { ApiRouteContext } from "../http/route-context";
import { readLimitedJsonBody } from "../http/body";
import {
  checkOrigin,
  checkRateLimit,
  publicBrowserCorsPreflight,
  publicBrowserCorsResponse,
} from "../http/public";
import { VoucherAwardError } from "../../services/voucher-awards";
import { VoucherAwardStoreConflict } from "../../services/db/voucher-awards";
import { logger } from "../../services/logger";

export function registerVoucherAwardRoutes(app: Hono, ctx: ApiRouteContext): void {
  app.options(VOUCHER_AWARDS_ROUTE, (c) => publicBrowserCorsPreflight(c, ctx.deps));
  app.post(VOUCHER_AWARDS_ROUTE, async (c) => {
    const denied = checkOrigin(c, ctx.deps);
    if (denied) return publicBrowserCorsResponse(c, ctx.deps, denied, 403);
    const limited = checkRateLimit(c, ctx.deps, "voucher_awards", "awards");
    if (limited) return publicBrowserCorsResponse(c, ctx.deps, limited, 429);
    if (!ctx.deps.voucherAwards)
      return publicBrowserCorsResponse(c, ctx.deps, { ok: false, errorCode: "unavailable" }, 503);
    const body = await readLimitedJsonBody<unknown>(c.req.raw, 24 * 1024);
    if (!body.ok) return publicBrowserCorsResponse(c, ctx.deps, body.error, body.status);
    if (body.value === undefined)
      return publicBrowserCorsResponse(
        c,
        ctx.deps,
        { ok: false, errorCode: "invalid_request" },
        400
      );
    try {
      const response = await ctx.deps.voucherAwards.request(
        body.value,
        c.req.header("origin") ?? ""
      );
      return publicBrowserCorsResponse(c, ctx.deps, response);
    } catch (error) {
      if (error instanceof VoucherAwardError || error instanceof VoucherAwardStoreConflict) {
        const status = error instanceof VoucherAwardError ? error.status : 409;
        return publicBrowserCorsResponse(
          c,
          ctx.deps,
          { ok: false, errorCode: error.code },
          status as 400 | 401 | 403 | 404 | 409
        );
      }
      logger.warn({ operation: "voucher_award_request" }, "Voucher award service unavailable");
      return publicBrowserCorsResponse(c, ctx.deps, { ok: false, errorCode: "unavailable" }, 503);
    }
  });
}
