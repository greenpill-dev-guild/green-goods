import type { Hono } from "hono";
import { registerAccessRoutes } from "./access";
import { type MessagingRouteDeps, privateResponses } from "./http";
import { registerGrantRoutes } from "./grants";
import { registerOperationRoutes } from "./operations";
import { registerRecoveryRoutes } from "./recovery";

export type { MessagingRouteDeps } from "./http";

/** Browser ceremony API. Provider webhooks stay under their own adapter routes. */
export function registerMessagingRoutes(app: Hono, deps: MessagingRouteDeps): void {
  app.use("/messaging/*", privateResponses);
  registerAccessRoutes(app, deps);
  registerOperationRoutes(app, deps);
  registerRecoveryRoutes(app, deps);
  registerGrantRoutes(app, deps);
}
