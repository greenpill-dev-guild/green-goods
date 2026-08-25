import { ErrorBoundary } from "@green-goods/shared/components/ErrorBoundary/ErrorBoundary";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import {
  createQueryPersister,
  createShouldDehydrateQuery,
  PERSIST_MAX_AGE,
} from "@green-goods/shared/config/query-persistence";
import { queryClient } from "@green-goods/shared/config/react-query";
import { initGlobalErrorHandlers } from "@green-goods/shared/modules/app/error-events";
import { initializeIpfsFromEnv } from "@green-goods/shared/modules/data/ipfs/client";
import { AppProvider } from "@green-goods/shared/providers/App";
import { AppKitProvider } from "@green-goods/shared/providers/AppKitProvider";
import { AuthGate } from "@green-goods/shared/providers/AuthGate";
import { initTheme } from "@green-goods/shared/utils/styles/theme";
import { initBrowserSentry } from "@green-goods/shared/sentry";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App.tsx";

import "@/index.css";

type ReactRoot = ReturnType<typeof createRoot>;

const persister = createQueryPersister({ dbName: "gg-admin-react-query" });
const shouldDehydrateQuery = createShouldDehydrateQuery({
  excludedGroups: ["queue", "role"],
});

declare global {
  interface Window {
    __ADMIN_ROOT__?: ReactRoot;
  }
}

const adminAppUrl =
  import.meta.env.VITE_ADMIN_APP_URL ||
  (typeof window !== "undefined" ? window.location.origin : "https://admin.greengoods.app");

// Initialize theme system
const cleanupTheme = initTheme();

initBrowserSentry({
  dsn: import.meta.env.VITE_SENTRY_ADMIN_DSN,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION
    ? `green-goods-admin@${import.meta.env.VITE_APP_VERSION}`
    : undefined,
  surface: "admin",
  debug: import.meta.env.VITE_SENTRY_DEBUG === "true",
});

// Initialize global error handlers for PostHog/Sentry exception tracking
// Catches unhandled errors and promise rejections that escape Error Boundaries
initGlobalErrorHandlers();

void initializeIpfsFromEnv(import.meta.env);

export const Root = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister,
      maxAge: PERSIST_MAX_AGE,
      dehydrateOptions: { shouldDehydrateQuery },
    }}
  >
    <ErrorBoundary context="AdminApp">
      <AppKitProvider
        projectId={import.meta.env.VITE_WALLETCONNECT_PROJECT_ID}
        metadata={{
          name: "Green Goods Admin",
          description: "Garden management canvas for the Green Goods protocol",
          url: adminAppUrl,
          icons: ["https://greengoods.app/icon.png"],
        }}
        defaultChainId={DEFAULT_CHAIN_ID}
      >
        {/* AuthGate: uses DevAuthProvider when ?mockAuth= param is present in dev, else real AuthProvider */}
        <AuthGate>
          <AppProvider
            posthogKey={import.meta.env.VITE_POSTHOG_ADMIN_KEY}
            allowPosthogKeyFallback={false}
          >
            <App />
          </AppProvider>
        </AuthGate>
      </AppKitProvider>
    </ErrorBoundary>
  </PersistQueryClientProvider>
);

const container = document.getElementById("root");
if (!container) throw new Error("Root container not found");

const root = window.__ADMIN_ROOT__ ?? createRoot(container);
window.__ADMIN_ROOT__ = root;

root.render(
  <StrictMode>
    <Root />
  </StrictMode>
);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupTheme?.();
    root.unmount();
    delete window.__ADMIN_ROOT__;
  });
}
