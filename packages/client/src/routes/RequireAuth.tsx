import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/auth/useAuth";

export default function RequireAuth() {
  const { smartAccountAddress, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) return null; // Router fallback will render global loader

  if (!smartAccountAddress) {
    const redirectTo = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />;
  }

  return <Outlet />;
}
