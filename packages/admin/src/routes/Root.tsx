import { ToastViewport } from "@green-goods/shared/components/Toast/ToastViewport";
import { useAnalyticsIdentity } from "@green-goods/shared/hooks/analytics/useAnalyticsIdentity";
import { usePageView } from "@green-goods/shared/hooks/analytics/usePageView";
import { useApp } from "@green-goods/shared/providers/App";
import { getAdminWorkspaceForPath } from "@green-goods/shared/utils/navigation/admin-routes";
import { Outlet, useLocation } from "react-router-dom";

/**
 * Root layout component
 *
 * Sets up analytics tracking (identity + pageviews) and toast viewport.
 */
export default function Root() {
  const { locale } = useApp();
  const { pathname } = useLocation();

  // Sync user identity with PostHog
  useAnalyticsIdentity({
    app: "admin",
    isPwa: false, // Admin is not a PWA
    locale,
  });

  // Track SPA pageviews
  usePageView({
    app: "admin",
    trackInitial: true,
  });

  return (
    <>
      <Outlet />
      {/* The toasts sit beside the canvas, outside its [data-tone], so they carry
          the workspace's tone themselves, as a portaled dialog does: their
          actions then draw the cockpit's focus ring (DL-098). */}
      <div data-tone={getAdminWorkspaceForPath(pathname)} className="contents">
        <ToastViewport />
      </div>
    </>
  );
}
