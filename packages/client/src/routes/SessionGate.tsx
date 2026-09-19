import { useAuthState } from "@green-goods/shared/hooks/auth/useAuth";
import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { clearChunkReloadAttempt } from "@/components/Errors/errorClassification";
import { APP_ROUTES } from "@/config/pwaRouting";

export default function SessionGate() {
  const { isReady, isAuthenticated } = useAuthState();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) clearChunkReloadAttempt();
  }, [isAuthenticated]);

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
