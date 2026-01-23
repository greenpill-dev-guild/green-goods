import { useApp } from "@green-goods/shared/providers";
import { Navigate, useLocation } from "react-router-dom";
import Landing from "@/views/Landing";

/**
 * PlatformRouter handles root path (/) routing based on device type.
 *
 * Flow:
 * - Desktop web: Shows landing page with "open on mobile" messaging
 * - Mobile web (installed or not): Redirects to /home (RequireAuth handles login)
 *
 * Install is no longer a prerequisite—users can use the app in browser.
 * Install nudges appear in-app (banner + profile) for better experience.
 */
export default function PlatformRouter() {
  const { isMobile } = useApp();
  const location = useLocation();

  const redirectTo = new URLSearchParams(location.search).get("redirectTo");

  // Mobile users: go straight to app (RequireAuth handles login if needed)
  if (isMobile) {
    return <Navigate to={redirectTo || "/home"} replace />;
  }

  // Desktop users: show landing page
  return <Landing />;
}
