import { useApp } from "@green-goods/shared/providers/app";
import { Navigate, useLocation } from "react-router-dom";
import Landing from "@/views/Landing";

/**
 * PlatformRouter handles root path (/) routing based on device type and install state.
 *
 * Flow:
 * - Desktop web: Shows landing page with "open on mobile" messaging
 * - Mobile web (not installed): Shows landing page with install button
 * - Mobile app (installed): Redirects to /home (RequireAuth guard handles login check)
 *
 * Authentication checking is delegated to RequireAuth guard for simplicity.
 */
export default function PlatformRouter() {
  const { isMobile, isStandalone } = useApp();
  const location = useLocation();

  const redirectTo = new URLSearchParams(location.search).get("redirectTo");

  // Mobile users with installed app: redirect to /home
  // The RequireAuth guard will handle authentication checks and login redirect if needed
  if (isMobile && isStandalone) {
    return <Navigate to={redirectTo || "/home"} replace />;
  }

  // Desktop users and mobile users without app: show landing page
  return <Landing />;
}
