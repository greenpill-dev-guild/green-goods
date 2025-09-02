import { usePrivy } from "@privy-io/react-auth";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useUser } from "@/providers/user";

export function RequireAuth() {
  const { authenticated } = usePrivy();
  const { ready, address } = useUser();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isAuthenticated = authenticated && address;
  if (!isAuthenticated) {
    const redirectTo = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />;
  }
  
  return <Outlet />;
}