import { useApp } from "@green-goods/shared";
import { Navigate, useLocation } from "react-router-dom";

/**
 * PlatformRouter handles root path (/) routing based on display mode.
 *
 * Flow:
 * - Installed PWA (any device): Redirects to /home (auth'd dashboard)
 * - Browser (any device): Redirects to /gardens (public garden gallery)
 *
 * This replaces the old isMobile check with isInstalled (display-mode detection).
 * Browser users (desktop or mobile) see the public platform.
 * Installed PWA users go to the authenticated app experience.
 */
export default function PlatformRouter() {
  const { isInstalled } = useApp();
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get("redirectTo");

  // Installed PWA → auth'd dashboard
  if (isInstalled) {
    return <Navigate to={redirectTo || "/home"} replace />;
  }

  // Browser (any device) → public garden gallery
  return <Navigate to="/gardens" replace />;
}
