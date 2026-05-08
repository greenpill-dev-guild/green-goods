import { AppProvider, initGlobalErrorHandlers, initTheme } from "@green-goods/shared";
import { registerServiceWorkerFromEnv } from "@green-goods/shared/service-worker";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "@/App.tsx";
import { AppErrorBoundary } from "@/components/Errors";
import { createPwaRoutingConfig, PWA_APP_SCOPE } from "@/config/pwa-routing";

import "@/index.css";
import "@/config";

// Initialize theme system
initTheme();

// Initialize global error handlers for PostHog exception tracking
// This catches unhandled errors and promise rejections that escape Error Boundaries
initGlobalErrorHandlers();

const pwaRouting = createPwaRoutingConfig(import.meta.env.VITE_USE_HASH_ROUTER === "true");
void registerServiceWorkerFromEnv(
  {
    DEV: import.meta.env.MODE !== "production",
    PROD: import.meta.env.MODE === "production",
    VITE_ENABLE_SW_DEV: import.meta.env.VITE_ENABLE_SW_DEV,
    VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION,
  },
  {
    scriptUrl: pwaRouting.serviceWorkerScriptUrl,
    scope: pwaRouting.manifestScope,
    legacyScopes: pwaRouting.manifestScope === PWA_APP_SCOPE ? ["/"] : [],
  }
);

export const Root = () => (
  <HelmetProvider>
    <AppErrorBoundary>
      <AppProvider posthogKey={import.meta.env.VITE_POSTHOG_KEY}>
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
