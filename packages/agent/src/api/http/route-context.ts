import type { MiddlewareHandler } from "hono";
import type { ServerDeps } from "../server";

export interface ApiRouteContext {
  deps: ServerDeps;
  auth: MiddlewareHandler;
}
