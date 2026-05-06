import {
  AppProvider,
  initGlobalErrorHandlers,
  initTheme,
  updateToasts,
  useServiceWorkerUpdate,
} from "@green-goods/shared";
import { registerServiceWorkerFromEnv } from "@green-goods/shared/service-worker";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "@/App.tsx";
import { AppErrorBoundary } from "@/components/Errors";

import "@/index.css";
import "@/config";

// Initialize theme system
initTheme();

// Initialize global error handlers for PostHog exception tracking
// This catches unhandled errors and promise rejections that escape Error Boundaries
initGlobalErrorHandlers();
void registerServiceWorkerFromEnv({
  DEV: import.meta.env.MODE !== "production",
  PROD: import.meta.env.MODE === "production",
  VITE_ENABLE_SW_DEV: import.meta.env.VITE_ENABLE_SW_DEV,
  VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION,
});

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
      <AppProvider posthogKey={import.meta.env.VITE_POSTHOG_KEY}>
        <UpdateNotifier />
        <App />
      </AppProvider>
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
