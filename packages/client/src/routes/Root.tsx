import { ToastViewport, useAnalyticsIdentity, useApp, usePageView } from "@green-goods/shared";
import { Outlet } from "react-router-dom";

/**
 * Root layout component
 *
 * Sets up analytics tracking (identity + pageviews) and toast viewport.
 */
export default function Root() {
  const { locale, isInstalled } = useApp();

  // Sync user identity with PostHog
  useAnalyticsIdentity({
    app: "client",
    isPwa: isInstalled,
    locale,
  });

  // Track SPA pageviews
  usePageView({
    app: "client",
    trackInitial: true,
  });

  return (
    <div className="overflow-x-hidden w-full h-full">
      <Outlet />
      <ToastViewport />
    </div>
  );
}
