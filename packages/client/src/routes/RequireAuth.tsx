import { useAuthState } from "@green-goods/shared/hooks/auth/useAuth";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { APP_ROUTES } from "@/config/pwaRouting";

export default function RequireAuth() {
  const { isReady, isAuthenticated } = useAuthState();
  const location = useLocation();

  // Static HTML owns the cold-start scene. During a transient reconnect, keep
  // the already-authorized route mounted instead of replacing it with a loader.
  if (!isReady) {
    return isAuthenticated ? <Outlet /> : null;
  }

  // Check if user has valid credentials (either passkey or wallet)
  if (!isAuthenticated) {
    const redirectTo = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`${APP_ROUTES.login}?redirectTo=${redirectTo}`} replace />;
  }

  return <Outlet />;
}
