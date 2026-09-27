import {
  attemptRequestSchema,
  operationCreateRequestSchema,
  outcomeRequestSchema,
} from "@green-goods/shared/modules/agent-reporting";
import type { Hono } from "hono";
import { currentConfirmation } from "../../../services/reporting/confirmations";
import { inTransaction } from "../../../services/reporting/database";
import { recordOwnerOutcome, reserveOwnerAttempt } from "../../../services/reporting/execution";
import { operationById, operationForSubject } from "../../../services/reporting/operations";
import { retryPreparation } from "../../../services/reporting/preparation";
import {
  draftView,
  operationView,
  reviewView,
  sessionOwnsOperation,
} from "../../../services/reporting/views";
import { currentSession, failure, limited, type MessagingRouteDeps, readBody } from "./http";

/**
 * Draft, media and operation endpoints. Every route resolves the caller's session first and
 * serves only that session's resource; foreign IDs return `unavailable`, never another scope.
 */
export function registerOperationRoutes(app: Hono, deps: MessagingRouteDeps): void {
  app.get("/messaging/drafts/:id", (c) => {
    const session = currentSession(c, deps, false);
    if (!session) return failure(c, "access_required");
    if (limited(c, deps, "messaging_read", session.accessId)) return failure(c, "rate_limited");
    if (
      session.request.resourceKind !== "draft" ||
      session.request.resourceId !== c.req.param("id")
    ) {
      return failure(c, "unavailable");
    }
    const view = draftView(deps.core(), c.req.param("id"));
    return view ? c.json(view) : failure(c, "unavailable");
  });

  app.get("/messaging/reviews/:id", (c) => {
    const session = currentSession(c, deps, false);
    if (!session) return failure(c, "access_required");
    if (limited(c, deps, "messaging_read", session.accessId)) return failure(c, "rate_limited");
    if (
      session.request.resourceKind !== "review" ||
      session.request.resourceId !== c.req.param("id")
    ) {
      return failure(c, "unavailable");
    }
    const view = reviewView(deps.core(), c.req.param("id"));
    return view ? c.json(view) : failure(c, "unavailable");
  });

  app.get("/messaging/media/:id", async (c) => {
    const session = currentSession(c, deps, false);
    if (!session) return failure(c, "access_required");
    const core = deps.core();
    const row = core.db
      .query(
        "SELECT draft_id, sanitized_object_ciphertext, sanitized_mime FROM media_assets WHERE id = $id AND deleted_at IS NULL"
      )
      .get({ id: c.req.param("id") }) as {
      draft_id: string | null;
      sanitized_object_ciphertext: string | null;
      sanitized_mime: string | null;
    } | null;
    if (
      !row?.sanitized_object_ciphertext ||
      !row.sanitized_mime ||
      row.draft_id !== session.request.resourceId ||
      session.request.resourceKind !== "draft"
    ) {
      return failure(c, "unavailable");
    }
    const key = core.keyring.open(
      row.sanitized_object_ciphertext,
      `media_assets.sanitized:${c.req.param("id")}`
    );
    const bytes = await deps.media.get(key, `sanitized:${c.req.param("id")}`);
    return new Response(new Uint8Array(bytes), {
      headers: { "content-type": row.sanitized_mime, "content-disposition": "inline" },
    });
  });

  // Operations are created by the Agent after confirmation; the browser only ever gets back the
  // one logical operation for its confirmed revision.
  app.post("/messaging/operations", async (c) => {
    const session = currentSession(c, deps, true);
    if (!session) return failure(c, "access_required");
    const body = await readBody(c, operationCreateRequestSchema);
    if (!body) return failure(c, "invalid_request");
    const core = deps.core();
    if (session.request.resourceKind !== "draft" || session.request.resourceId !== body.resourceId)
      return failure(c, "unavailable");
    const confirmation = currentConfirmation(core, { draftId: body.resourceId });
    const operation = operationForSubject(core, { draftId: body.resourceId });
    if (
      !confirmation ||
      confirmation.revision !== body.expectedRevision ||
      confirmation.summaryDigest !== body.summaryDigest
    ) {
      return failure(c, "stale_revision");
    }
    if (
      !operation ||
      operation.state === "cancelled" ||
      operation.authorAccountId !== session.accountBindingId
    ) {
      return failure(c, "outcome_unknown");
    }
    return c.json({ ok: true, operation: operationView(core, operation) });
  });

  app.get("/messaging/operations/:id", (c) => {
    const session = currentSession(c, deps, false);
    if (!session) return failure(c, "access_required");
    const core = deps.core();
    const operation = operationById(core, c.req.param("id"));
    if (!operation || !sessionOwnsOperation(session, operation)) return failure(c, "unavailable");
    return c.json({ ok: true, operation: operationView(core, operation) });
  });

  app.post("/messaging/operations/:id/attempts", async (c) => {
    const session = currentSession(c, deps, true);
    if (!session) return failure(c, "access_required");
    if (limited(c, deps, "messaging_mutation", session.accessId)) return failure(c, "rate_limited");
    const body = await readBody(c, attemptRequestSchema);
    if (!body) return failure(c, "invalid_request");
    const result = await reserveOwnerAttempt(deps.core(), deps.chain, {
      operationId: c.req.param("id"),
      session,
      expectedAttemptVersion: body.expectedAttemptVersion,
      payloadDigest: body.payloadDigest,
    });
    if (!result.ok) return failure(c, result.errorCode);
    return c.json({
      ok: true,
      attemptId: result.attemptId,
      attemptNumber: result.attemptNumber,
      permitVersion: result.permitVersion,
      payloadDigest: body.payloadDigest,
    });
  });

  // Durable typed outcomes: the same key and payload replays the first answer after a lost
  // response; a different payload under that key conflicts.
  app.post("/messaging/operations/:id/outcome", async (c) => {
    const session = currentSession(c, deps, true);
    if (!session) return failure(c, "access_required");
    const body = await readBody(c, outcomeRequestSchema);
    if (!body) return failure(c, "invalid_request");
    const result = recordOwnerOutcome(deps.core(), {
      operationId: c.req.param("id"),
      session,
      attemptId: body.attemptId,
      idempotencyKey: body.idempotencyKey,
      payloadDigest: body.payloadDigest,
      outcome: body.outcome,
    });
    return result.ok ? c.json(result.response) : failure(c, result.errorCode);
  });

  // An owner may explicitly retry a failed preparation for their confirmed revision.
  app.post("/messaging/operations/:id/prepare", (c) => {
    const session = currentSession(c, deps, true);
    if (!session) return failure(c, "access_required");
    const core = deps.core();
    const operation = operationById(core, c.req.param("id"));
    if (!operation?.draftId || operation.draftId !== session.request.resourceId)
      return failure(c, "unavailable");
    inTransaction(core.db, () => retryPreparation(core, operation.draftId as string));
    return c.json({
      ok: true,
      operation: operationView(core, operationById(core, operation.id) ?? operation),
    });
  });
}
