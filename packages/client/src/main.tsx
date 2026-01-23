import {
  AppProvider,
  DEFAULT_CHAIN_ID,
  initGlobalErrorHandlers,
  initTheme,
  useServiceWorkerUpdate,
} from "@green-goods/shared";
import { updateToasts } from "@green-goods/shared/components";
import { AppKitProvider, AuthProvider } from "@green-goods/shared/providers";
import { StrictMode, useEffect } from "react";
import { HelmetProvider } from "react-helmet-async";
import { createRoot } from "react-dom/client";
import App from "@/App.tsx";
import { AppErrorBoundary } from "@/components/Errors";

import "@/index.css";
import "@/config";

// Initialize theme system
initTheme();

// Initialize global error handlers for PostHog exception tracking
// This catches unhandled errors and promise rejections that escape Error Boundaries
initGlobalErrorHandlers();

// In development, ensure no stale service worker or caches make the app appear to run offline
if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_SW_DEV !== "true") {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      )
      .catch(() => {
        // ignore
      });
  }
  if (typeof caches !== "undefined" && caches?.keys) {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {
        // ignore
      });
  }
}

/**
 * PWA Update Notifier Component
 *
 * Shows a toast notification when a new version of the app is available.
 * Users can choose to update immediately or dismiss and update later.
 *
 * This replaces the old auto-reload behavior to give users control over
 * when the app refreshes, preventing unexpected data loss.
 */
function UpdateNotifier() {
  const { updateAvailable, isUpdating, applyUpdate } = useServiceWorkerUpdate();

  useEffect(() => {
    if (updateAvailable) {
      updateToasts.available(applyUpdate);
    }
    if (isUpdating) {
      updateToasts.updating();
    }
  }, [updateAvailable, isUpdating, applyUpdate]);

  return null;
}

export const Root = () => (
  <HelmetProvider>
    <AppErrorBoundary>
      <AppKitProvider
        projectId={import.meta.env.VITE_WALLETCONNECT_PROJECT_ID}
        metadata={{
          name: "Green Goods",
          description: "Start Bringing Your Impact Onchain",
          url: import.meta.env.VITE_APP_URL || window.location.origin,
          icons: ["https://greengoods.app/icon.png"],
        }}
        defaultChainId={DEFAULT_CHAIN_ID}
      >
        {/* AuthProvider uses XState + Pimlico passkey server */}
        <AuthProvider>
          <AppProvider posthogKey={import.meta.env.VITE_POSTHOG_KEY}>
            <UpdateNotifier />
            <App />
          </AppProvider>
        </AuthProvider>
      </AppKitProvider>
    </AppErrorBoundary>
  </HelmetProvider>
);

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container missing in index.html");
}

const root = createRoot(container);
root.render(
  <StrictMode>
    <Root />
  </StrictMode>
);
