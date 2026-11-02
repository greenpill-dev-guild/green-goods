import { useRole } from "@green-goods/shared/hooks/gardener/useRole";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";

/** The protocol's own workspaces. Being allowed to create gardens does not open them. */
export default function RequireProtocolTeam({ loadingFallback }: { loadingFallback: ReactNode }) {
  const { isProtocolTeam, loading } = useRole();

  if (loading) return loadingFallback;
  return isProtocolTeam ? <Outlet /> : <Navigate to={adminRoutes.hub()} replace />;
}
