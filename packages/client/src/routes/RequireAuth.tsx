import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useUser } from "@/providers/user";

export default function RequireAuth() {
  const { ready, authenticated } = useUser();
  const location = useLocation();

  if (!ready) return null; // Router fallback will render global loader

  if (!authenticated) {
    const redirectTo = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />;
  }
  return <Outlet />;
}
