import { useApp } from "@green-goods/shared/providers/app";
import { useAuth } from "@green-goods/shared/hooks";
import { Navigate, useLocation } from "react-router-dom";
import Landing from "@/views/Landing";

/**
 * PlatformRouter handles root path (/) routing with optimal performance.
 *
 * Flow:
 * - Desktop web: Shows landing page with "open on mobile" messaging
 * - Mobile web (not installed): Shows landing page with install button
 * - Mobile app (installed, not authenticated): Direct redirect to /login
 * - Mobile app (installed, authenticated): Direct redirect to /home
 *
 * This approach eliminates double redirects by checking auth state upfront.
 */
export default function PlatformRouter() {
  const { isMobile, isInstalled } = useApp();
  const { isReady, isAuthenticated } = useAuth();
  const location = useLocation();

  const redirectTo = new URLSearchParams(location.search).get("redirectTo");

  // Mobile users with installed app
  if (isMobile && isInstalled) {
    // Wait for auth to initialize before deciding where to send them
    if (!isReady) {
      // Show minimal loading while auth initializes
      return (
        <div
          className="min-h-screen flex items-center justify-center bg-white"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-green-200 border-t-green-600" />
            <span className="sr-only">Loading Green Goods</span>
          </div>
        </div>
      );
    }

    // Authenticated users → go to home
    if (isAuthenticated) {
      return <Navigate to={redirectTo || "/home"} replace />;
    }

    // Unauthenticated users → go to login (with redirect back to intended destination)
    const target = redirectTo ? `/login?redirectTo=${redirectTo}` : "/login?redirectTo=%2Fhome";
    return <Navigate to={target} replace />;
  }

  // Desktop users and mobile users without app: show landing page
  return <Landing />;
}
