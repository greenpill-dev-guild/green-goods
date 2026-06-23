import { ToastViewport, usePageView } from "@green-goods/shared";
import { useLayoutEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { scrubReceiptTokenFragmentFromLocation } from "./receipt-token";
import { getClientToastViewportVariant } from "./toast-variant";

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
