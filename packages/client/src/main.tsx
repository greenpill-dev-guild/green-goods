import {
  AppProvider,
  DEFAULT_CHAIN_ID,
  initGlobalErrorHandlers,
  initTheme,
} from "@green-goods/shared";
import { AppKitProvider, AuthProvider } from "@green-goods/shared/providers";
import { StrictMode } from "react";
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
 * PWA Auto-Update System
 *
 * On mobile PWAs, a new deploy downloads the service worker in the background,
 * but the running app keeps using old JS + cached data until a reload.
 * This causes "weird behavior" after updates.
 *
 * Solution:
 * 1. Check for SW updates when the app comes back to foreground (visibility/focus)
 * 2. Auto-reload once the new SW takes control (controllerchange)
 */
function initPwaAutoUpdate() {
  const enableDevServiceWorker = import.meta.env.VITE_ENABLE_SW_DEV === "true";
  if (!(import.meta.env.PROD || enableDevServiceWorker)) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  let hasController = navigator.serviceWorker.controller !== null;
  let reloading = false;

  const checkForUpdates = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    } catch {
      // Silently ignore update check failures (offline, etc.)
    }
  };

  // When a new SW takes control, reload once so the new JS/assets actually run
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // First install (no previous controller): don't reload
    if (!hasController) {
      hasController = true;
      return;
    }
    // Prevent reload loops
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  // iOS/Android: update checks on foreground/resume
  void checkForUpdates();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkForUpdates();
  });
  window.addEventListener("focus", () => void checkForUpdates());
}

initPwaAutoUpdate();

export const Root = () => (
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
          <App />
        </AppProvider>
      </AuthProvider>
    </AppKitProvider>
  </AppErrorBoundary>
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
