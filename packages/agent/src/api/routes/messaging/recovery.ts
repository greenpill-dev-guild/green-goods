import type { Context, Hono } from "hono";
import * as z from "zod";
import { challengeForBrowser } from "../../../services/reporting/browser-access";
import { inTransaction } from "../../../services/reporting/database";
import {
  applyRecovery,
  confirmRecoveryChannel,
  type RecoveryStep,
  recoveryState,
} from "../../../services/reporting/recovery";
import {
  CSRF_HEADER,
  failure,
  hasExactOrigin,
  limited,
  type MessagingRouteDeps,
  preauthToken,
  readBody,
} from "./http";

/**
 * Recovery ceremony endpoints, addressed by the browser's own challenge. They need that
 * browser's pre-authentication cookie (and CSRF for mutations); a forwarded recovery link in
 * another browser has neither, so it can observe or change nothing.
 */
export function registerRecoveryRoutes(app: Hono, deps: MessagingRouteDeps): void {
  const respond = (c: Context, step: RecoveryStep) =>
    step.ok ? c.json(step) : failure(c, step.errorCode);

  app.get("/messaging/recovery/:challengeId", (c) => {
    const token = preauthToken(c);
    const challenge = token
      ? challengeForBrowser(deps.core(), c.req.param("challengeId"), token)
      : null;
    return challenge
      ? respond(c, recoveryState(deps.core(), challenge))
      : failure(c, "access_required");
  });

  app.post("/messaging/recovery/:challengeId/channel", async (c) => {
    if (!hasExactOrigin(c, deps)) return failure(c, "forbidden");
    if (limited(c, deps, "messaging_proof")) return failure(c, "rate_limited");
    const token = preauthToken(c);
    const core = deps.core();
    const challenge = token
      ? challengeForBrowser(
          core,
          c.req.param("challengeId"),
          token,
          c.req.header(CSRF_HEADER) ?? ""
        )
      : null;
    if (!challenge) return failure(c, "access_required");
    const body = await readBody(c, z.object({ code: z.string().regex(/^\d{6}$/) }));
    if (!body) return failure(c, "invalid_request");
    return respond(
      c,
      inTransaction(core.db, () => confirmRecoveryChannel(core, challenge, body.code))
    );
  });

  app.post("/messaging/recovery/:challengeId/confirm", (c) => {
    if (!hasExactOrigin(c, deps)) return failure(c, "forbidden");
    if (limited(c, deps, "messaging_mutation")) return failure(c, "rate_limited");
    const token = preauthToken(c);
    const core = deps.core();
    const challenge = token
      ? challengeForBrowser(
          core,
          c.req.param("challengeId"),
          token,
          c.req.header(CSRF_HEADER) ?? ""
        )
      : null;
    if (!challenge) return failure(c, "access_required");
    return respond(
      c,
      inTransaction(core.db, () => applyRecovery(core, challenge))
    );
  });
}
