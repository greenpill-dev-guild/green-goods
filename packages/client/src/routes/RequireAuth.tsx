import { useAuth } from "@green-goods/shared/hooks";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function RequireAuth() {
  const { isReady, isAuthenticated } = useAuth();
  const location = useLocation();

  // Wait for auth provider to finish initialization
  // Show minimal loading state to prevent flash of login screen
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-green-200 border-t-green-600" />
      </div>
    );
  }

  // Check if user has valid credentials (either passkey or wallet)
  if (!isAuthenticated) {
    const redirectTo = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />;
  }

  return <Outlet />;
}
