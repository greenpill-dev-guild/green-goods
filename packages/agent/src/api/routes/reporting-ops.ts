import type { Hono } from "hono";
import * as z from "zod";
import { CONTROL_NAMES, type ControlName, setControl } from "../../services/reporting/controls";
import { replayFailedJob } from "../../services/reporting/jobs";
import { operatorSnapshot } from "../../services/reporting/ops";
import type { ReportingCore } from "../../services/reporting/runtime";
import { requireApiAuth } from "../http/auth";
import type { ServerDeps } from "../http/server.types";

const ControlChange = z.object({
  enabled: z.boolean(),
  reason: z.string().trim().min(3).max(200),
});

/**
 * Operator controls for agent reporting, behind the Agent's API bearer token: queue health,
 * the operating switches (`CONTROL_NAMES`), and replay of a failed job. Pausing never revokes bytes already
 * signed or broadcast; reconciliation keeps running under every switch.
 */
export function registerReportingOpsRoutes(
  app: Hono,
  deps: Pick<ServerDeps, "botApiToken">,
  core: () => ReportingCore
): void {
  app.use("/reporting/ops/*", requireApiAuth(deps as ServerDeps));
  app.use("/reporting/ops/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });

  app.get("/reporting/ops/health", (c) => c.json(operatorSnapshot(core())));

  app.post("/reporting/ops/controls/:name", async (c) => {
    const name = c.req.param("name");
    if (!(CONTROL_NAMES as readonly string[]).includes(name))
      return c.json({ error: "unknown_control" }, 404);
    const body = ControlChange.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    const state = setControl(core(), name as ControlName, body.data.enabled, {
      actor: "operator-api",
      reason: body.data.reason,
    });
    return c.json({ name, ...state });
  });

  app.post("/reporting/ops/jobs/:id/replay", (c) =>
    replayFailedJob(core(), c.req.param("id"))
      ? c.json({ ok: true })
      : c.json({ error: "not_failed" }, 409)
  );
}
