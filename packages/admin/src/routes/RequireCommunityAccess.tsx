import { useEffectiveToolbarPermissions } from "@green-goods/shared/hooks/roles/useEffectiveToolbarPermissions";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";

export default function RequireCommunityAccess({
  loadingFallback,
}: {
  loadingFallback: ReactNode;
}) {
  const { showCommunity, isLoading } = useEffectiveToolbarPermissions();

  if (isLoading) return loadingFallback;
  return showCommunity ? <Outlet /> : <Navigate to={adminRoutes.hub()} replace />;
}
