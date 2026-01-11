import { ToastViewport, useAnalyticsIdentity, useApp, usePageView } from "@green-goods/shared";
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
