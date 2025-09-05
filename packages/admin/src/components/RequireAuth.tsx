import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";

export function RequireAuth() {
  const { isConnected, address, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" data-testid="loading-spinner"></div>
      </div>
    );
  }

  const isAuthenticated = isConnected && address;
  if (!isAuthenticated) {
    const redirectTo = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />;
  }
  
  return <Outlet />;
}