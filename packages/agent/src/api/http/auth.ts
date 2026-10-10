import type { MiddlewareHandler } from "hono";
import type { ServerDeps } from "../server";

export function requireApiAuth(deps: ServerDeps): MiddlewareHandler {
  return async (c, next) => {
    if (!deps.botApiToken) {
      return c.json({ error: "API authentication not configured" }, 503);
    }
    const auth = c.req.header("authorization");
    if (!auth || auth !== `Bearer ${deps.botApiToken}`) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  };
}
