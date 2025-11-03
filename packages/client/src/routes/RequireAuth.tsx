import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@green-goods/shared/hooks";

export default function RequireAuth() {
  const { isReady, isAuthenticated } = useAuth();
  const location = useLocation();

  // Wait for auth provider to finish initialization
  if (!isReady) return null;

  // Check if user has valid credentials (either passkey or wallet)
  if (!isAuthenticated) {
    const redirectTo = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />;
  }

  return <Outlet />;
}
