import { AppProvider, initGlobalErrorHandlers, initTheme } from "@green-goods/shared";
import { initBrowserSentry } from "@green-goods/shared/sentry";
import { registerServiceWorkerFromEnv } from "@green-goods/shared/service-worker";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "@/App.tsx";
import { AppErrorBoundary } from "@/components/Errors";
import { createPwaRoutingConfig, PWA_APP_SCOPE } from "@/config/pwa-routing";
import { registerPublicWebMcpTools } from "@/modules/webmcp/public-tools";

import "@/index.css";
import "@/config";

// Initialize theme system
initTheme();

initBrowserSentry({
  dsn: import.meta.env.VITE_SENTRY_CLIENT_DSN,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION
    ? `green-goods-client@${import.meta.env.VITE_APP_VERSION}`
    : undefined,
  surface: "client",
  debug: import.meta.env.VITE_SENTRY_DEBUG === "true",
});

// Initialize global error handlers for PostHog/Sentry exception tracking
// This catches unhandled errors and promise rejections that escape Error Boundaries
initGlobalErrorHandlers();
registerPublicWebMcpTools();

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
