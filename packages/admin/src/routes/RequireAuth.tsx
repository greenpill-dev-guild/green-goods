import { useWalletAuth as useAuth } from "@green-goods/shared/providers";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { DashboardLayoutSkeleton } from "@/components/Layout/DashboardLayoutSkeleton";

export default function RequireAuth() {
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
