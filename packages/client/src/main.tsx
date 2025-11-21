import { initTheme } from "@green-goods/shared";
import { AppKitProvider, PasskeyAuthProvider } from "@green-goods/shared/providers";
import { AppProvider } from "@green-goods/shared/providers/app";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App.tsx";
import { AppErrorBoundary } from "@/components/UI/ErrorBoundary/AppErrorBoundary";

import "@/index.css";
import "@/pinata";

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
      projectId={
        import.meta.env.VITE_REOWN_PROJECT_ID || import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
      }
      metadata={{
        name: "Green Goods",
        description: "Start Bringing Biodiversity Onchain",
        url: import.meta.env.VITE_APP_URL || window.location.origin,
        icons: ["https://greengoods.app/icon.png"],
      }}
      defaultChainId={84532}
    >
      <PasskeyAuthProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </PasskeyAuthProvider>
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
