import { AppProvider, DEFAULT_CHAIN_ID, initTheme } from "@green-goods/shared";
import { AppKitProvider, AuthProvider } from "@green-goods/shared/providers";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App.tsx";
import { AppErrorBoundary } from "@/components/Errors";

import "@/index.css";
import "@/config";

// Initialize theme system
initTheme();

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
