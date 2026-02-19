import { useAuth } from "@green-goods/shared";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { DashboardLayoutSkeleton } from "@/components/Layout/DashboardLayoutSkeleton";

export default function RequireAuth() {
  const { isAuthenticated, eoaAddress, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return <DashboardLayoutSkeleton />;
  }

  // Admin requires a wallet connection (eoaAddress) -- passkey-only users
  // are redirected to login since admin operations need direct chain access.
  if (!isAuthenticated || !eoaAddress) {
    const redirectTo = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />;
  }

  return <Outlet />;
}
