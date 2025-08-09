import { Navigate, Outlet, useLocation } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import { useUser } from "@/providers/user";

export default function RequireAuth() {
  const { authenticated } = usePrivy();
  const { ready, smartAccountAddress } = useUser();
  const location = useLocation();

  if (!ready) return null; // Router fallback will render global loader

  const isAuthenticated = authenticated && smartAccountAddress;
  if (!isAuthenticated) {
    const redirectTo = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />;
  }
  return <Outlet />;
}
