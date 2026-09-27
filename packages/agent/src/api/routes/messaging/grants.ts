import type { Hono } from "hono";
import * as z from "zod";
import { loadDraft } from "../../../services/reporting/drafts";
import { grantById, type GrantRecord } from "../../../services/reporting/grants-store";
import { approveGrant, proposeGrant, pauseGrant } from "../../../services/reporting/grants";
import { loadReview } from "../../../services/reporting/reviews";
import { currentSession, failure, limited, type MessagingRouteDeps, readBody } from "./http";

const approvalSchema = z.object({
  expectedVersion: z.number().int().min(1),
  policyDigest: z.string().regex(/^0x[0-9a-f]{64}$/),
  enableReference: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

function view(grant: GrantRecord) {
  return {
    ok: true as const,
    grant: {
      grantId: grant.id,
      purpose: grant.purpose,
      state: grant.state,
      version: grant.version,
      policy: grant.policy,
      policyDigest: grant.policyDigest,
      permissionId: grant.permissionId,
      submissionsUsed: grant.submissionsReserved + grant.submissionsConsumed,
    },
  };
}

/**
 * Kernel execution grants, behind the grant session the chat issued. Without configured grant
 * dependencies (delegation disabled) every call answers `unsupported_scope`.
 */
export function registerGrantRoutes(app: Hono, deps: MessagingRouteDeps): void {
  app.post("/messaging/execution-grants", async (c) => {
    const session = currentSession(c, deps, true);
    if (!session) return failure(c, "access_required");
    if (limited(c, deps, "messaging_mutation", session.accessId)) return failure(c, "rate_limited");
    if (!deps.grants || session.request.resourceKind !== "grant" || !session.request.resourceId)
      return failure(c, "unsupported_scope");
    const core = deps.core();
    const resourceId = session.request.resourceId;
    const garden =
      session.request.purpose === "grant_review"
        ? loadReview(core, resourceId)?.content.gardenAddress
        : loadDraft(core, resourceId)?.content.garden?.address;
    if (!garden) return failure(c, "unavailable");
    const result = await proposeGrant({ core, chain: deps.chain, ...deps.grants }, session, garden);
    return result.ok ? c.json(view(result.grant), 201) : failure(c, result.errorCode);
  });

  app.get("/messaging/execution-grants/:id", (c) => {
    const session = currentSession(c, deps, false);
    if (!session) return failure(c, "access_required");
    const grant = grantById(deps.core(), c.req.param("id"));
    return grant && grant.accountBindingId === session.accountBindingId
      ? c.json(view(grant))
      : failure(c, "unavailable");
  });

  app.post("/messaging/execution-grants/:id/approval", async (c) => {
    const session = currentSession(c, deps, true);
    if (!session) return failure(c, "access_required");
    if (!deps.grants) return failure(c, "unsupported_scope");
    const body = await readBody(c, approvalSchema);
    if (!body) return failure(c, "invalid_request");
    const result = approveGrant(deps.core(), session, {
      grantId: c.req.param("id"),
      expectedVersion: body.expectedVersion,
      policyDigest: body.policyDigest,
      enableReference: body.enableReference as `0x${string}`,
    });
    return result.ok ? c.json(view(result.grant)) : failure(c, result.errorCode);
  });

  app.post("/messaging/execution-grants/:id/pause", (c) => {
    const session = currentSession(c, deps, true);
    if (!session) return failure(c, "access_required");
    const core = deps.core();
    const grant = grantById(core, c.req.param("id"));
    if (!grant || grant.accountBindingId !== session.accountBindingId)
      return failure(c, "unavailable");
    pauseGrant(core, grant.id, session.participantId);
    return c.json(view(grantById(core, grant.id) as GrantRecord));
  });
}
