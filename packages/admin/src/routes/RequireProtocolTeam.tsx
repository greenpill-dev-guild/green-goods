import { useRole } from "@green-goods/shared/hooks/gardener/useRole";
import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import RouteUnauthorized from "@/routes/RouteUnauthorized";

/**
 * The protocol's own workspaces. Being allowed to create gardens does not open them. Anyone else
 * sees Unauthorized in place: a redirect from here loses to the cockpit's garden sync, which
 * rewrites this route's address as the page arrives.
 */
export default function RequireProtocolTeam({ loadingFallback }: { loadingFallback: ReactNode }) {
  const { isProtocolTeam, loading } = useRole();

  if (loading) return loadingFallback;
  return isProtocolTeam ? <Outlet /> : <RouteUnauthorized />;
}
