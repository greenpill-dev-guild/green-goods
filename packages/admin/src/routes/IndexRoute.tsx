/**
 * IndexRoute — home ("/") entrypoint for the admin app.
 *
 * The `/` route is a terminal-state entrypoint. It shares the same access
 * classifier and renderer as direct canvas routes, but its ready state redirects
 * into the canonical hub workbench.
 *
 * 1. Spinner — auth or eligible-gardens still loading
 * 2. Redirect to /hub — authenticated AND at least one eligible garden
 * 3. No-garden-access shell — authenticated but zero eligible gardens
 * 4. Wallet-required shell — authMode is "embedded" (admin requires a real wallet)
 * 5. Connect prompt — unauthenticated
 */

import { adminRoutes, useAdminAccessState } from "@green-goods/shared";
import { Navigate } from "react-router-dom";
import { AdminAccessStateRenderer } from "@/components/Layout/AdminAccessStateRenderer";

export default function IndexRoute() {
  const accessState = useAdminAccessState();

  return (
    <AdminAccessStateRenderer
      state={accessState}
      ready={<Navigate to={adminRoutes.hub()} replace />}
    />
  );
}
