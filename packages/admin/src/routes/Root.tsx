import { ToastViewport } from "@green-goods/shared/components/Toast/ToastViewport";
import { useAnalyticsIdentity } from "@green-goods/shared/hooks/analytics/useAnalyticsIdentity";
import { usePageView } from "@green-goods/shared/hooks/analytics/usePageView";
import { useApp } from "@green-goods/shared/providers/App";
import { Outlet } from "react-router-dom";

/**
 * Root layout component
 *
 * Sets up analytics tracking (identity + pageviews) and toast viewport.
 */
export default function Root() {
  const { locale } = useApp();

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
      <ToastViewport />
    </>
  );
}
