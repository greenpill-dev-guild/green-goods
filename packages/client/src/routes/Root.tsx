import { ToastViewport } from "@green-goods/shared/components/Toast/ToastViewport";
import { usePageView } from "@green-goods/shared/hooks/analytics/usePageView";
import { useLayoutEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { scrubReceiptTokenFragmentFromLocation } from "./receiptToken";
import { getClientToastViewportVariant } from "./toastVariant";

function useReceiptTokenFragmentScrub() {
  useLayoutEffect(() => {
    scrubReceiptTokenFragmentFromLocation();
  }, []);
}

/**
 * Root layout component
 *
 * Sets up analytics tracking (identity + pageviews) and toast viewport.
 */
export default function Root() {
  useReceiptTokenFragmentScrub();
  const location = useLocation();
  const toastVariant = getClientToastViewportVariant(location.pathname);

  // Track SPA pageviews
  usePageView({
    app: "client",
    trackInitial: true,
  });

  return (
    <div id="client-scroll-root" className="overflow-x-hidden w-full h-full">
      <Outlet />
      <ToastViewport
        variant={toastVariant}
        toastOptions={{ style: { borderRadius: "var(--radius-md)" } }}
      />
    </div>
  );
}
