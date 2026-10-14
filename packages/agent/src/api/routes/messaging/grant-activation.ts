import {
  attemptRequestSchema,
  grantActivationRequestSchema,
  grantActivationSignatureRequestSchema,
  outcomeRequestSchema,
} from "@green-goods/shared/modules/agent-reporting";
import type { Hono } from "hono";
import {
  activationView,
  recordGrantActivationOutcome,
  reserveGrantActivation,
  startGrantActivation,
} from "../../../services/reporting/grant-activation";
import { signGrantActivation } from "../../../services/reporting/grant-activation-signature";
import { currentSession, failure, limited, readBody, type MessagingRouteDeps } from "./http";

/** Owner consent stays in the browser; the Agent accepts only a signature-free restricted operation. */
export function registerGrantActivationRoutes(app: Hono, deps: MessagingRouteDeps) {
  const path = "/messaging/execution-grants/:id/activation";
  app.get(path, (c) => {
    const session = currentSession(c, deps, false);
    if (!session) return failure(c, "access_required");
    if (limited(c, deps, "messaging_read", session.accessId)) return failure(c, "rate_limited");
    if (!deps.activation || !deps.grants) return failure(c, "unsupported_scope");
    const resource = activationView(deps.core(), session, c.req.param("id"));
    return resource ? c.json({ ok: true as const, resource }) : failure(c, "unavailable");
  });
  app.post(path, async (c) => {
    const session = currentSession(c, deps, true);
    if (!session) return failure(c, "access_required");
    if (limited(c, deps, "messaging_mutation", session.accessId)) return failure(c, "rate_limited");
    if (!deps.activation || !deps.grants) return failure(c, "unsupported_scope");
    const body = await readBody(c, grantActivationRequestSchema);
    if (!body) return failure(c, "invalid_request");
    const result = await startGrantActivation(
      { core: deps.core(), chain: deps.chain, ...deps.grants, ...deps.activation },
      session,
      c.req.param("id"),
      body
    );
    return result.ok ? c.json(result) : failure(c, result.errorCode);
  });
  app.post(`${path}/attempts`, async (c) => {
    const session = currentSession(c, deps, true);
    if (!session) return failure(c, "access_required");
    if (limited(c, deps, "messaging_mutation", session.accessId)) return failure(c, "rate_limited");
    if (!deps.activation || !deps.grants) return failure(c, "unsupported_scope");
    const body = await readBody(c, attemptRequestSchema);
    if (!body) return failure(c, "invalid_request");
    const result = await reserveGrantActivation(
      { core: deps.core(), chain: deps.chain, ...deps.grants, ...deps.activation },
      session,
      c.req.param("id"),
      body
    );
    return result.ok
      ? c.json({ ...result, payloadDigest: body.payloadDigest }, 201)
      : failure(c, result.errorCode);
  });
  app.post(`${path}/signature`, async (c) => {
    const session = currentSession(c, deps, true);
    if (!session) return failure(c, "access_required");
    if (limited(c, deps, "messaging_mutation", session.accessId)) return failure(c, "rate_limited");
    if (!deps.activation || !deps.grants) return failure(c, "unsupported_scope");
    const body = await readBody(c, grantActivationSignatureRequestSchema);
    if (!body) return failure(c, "invalid_request");
    const result = await signGrantActivation(
      { core: deps.core(), chain: deps.chain, ...deps.grants, ...deps.activation },
      session,
      c.req.param("id"),
      body
    );
    return result.ok ? c.json(result) : failure(c, result.errorCode);
  });
  app.post(`${path}/outcome`, async (c) => {
    const session = currentSession(c, deps, true);
    if (!session) return failure(c, "access_required");
    if (limited(c, deps, "messaging_mutation", session.accessId)) return failure(c, "rate_limited");
    if (!deps.activation || !deps.grants) return failure(c, "unsupported_scope");
    const body = await readBody(c, outcomeRequestSchema);
    if (!body) return failure(c, "invalid_request");
    const result = recordGrantActivationOutcome(deps.core(), session, c.req.param("id"), body);
    return result.ok ? c.json(result.response) : failure(c, result.errorCode);
  });
}
