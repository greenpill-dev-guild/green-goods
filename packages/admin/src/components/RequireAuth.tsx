import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { DashboardLayoutSkeleton } from "@/components/Layout/DashboardLayoutSkeleton";

export function RequireAuth() {
  const { isConnected, address, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return <DashboardLayoutSkeleton />;
  }

  const isAuthenticated = isConnected && address;
  if (!isAuthenticated) {
    const redirectTo = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />;
  }

  return <Outlet />;
}
