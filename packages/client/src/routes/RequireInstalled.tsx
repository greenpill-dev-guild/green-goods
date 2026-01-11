import { useApp } from "@green-goods/shared/providers";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function RequireInstalled() {
  const { isMobile, isStandalone } = useApp();
  const isDownloaded = (isMobile && isStandalone) || import.meta.env.VITE_DESKTOP_DEV === "true";
  const location = useLocation();

  if (!isDownloaded) {
    const redirectTo = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/landing?redirectTo=${redirectTo}`} replace />;
  }
  return <Outlet />;
}
