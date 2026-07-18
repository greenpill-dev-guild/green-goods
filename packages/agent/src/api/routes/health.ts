import type { Hono } from "hono";
import type { ApiRouteContext } from "../http/route-context";

export function registerHealthRoutes(app: Hono, ctx: ApiRouteContext): void {
  const { deps } = ctx;

  app.get("/health", (c) =>
    c.json({
      status: "ok",
      timestamp: Date.now(),
      uptime: process.uptime(),
      services: {
        ai: deps.isAIReady() ? "ready" : "loading",
      },
    })
  );

  app.get("/ready", (c) => {
    if (!deps.isAIReady()) {
      return c.json(
        {
          status: "not_ready",
          message: "AI model is still loading",
        },
        503
      );
    }
    return c.json({ status: "ready", timestamp: Date.now() });
  });
}
