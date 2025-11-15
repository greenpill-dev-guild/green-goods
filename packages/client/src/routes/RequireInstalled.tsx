import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useApp } from "@green-goods/shared/providers/app";

export default function RequireInstalled() {
  const { isMobile, isInstalled } = useApp();
  const isDownloaded = (isMobile && isInstalled) || import.meta.env.VITE_DESKTOP_DEV === "true";
  const location = useLocation();

  if (!isDownloaded) {
    const redirectTo = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/landing?redirectTo=${redirectTo}`} replace />;
  }
  return <Outlet />;
}
