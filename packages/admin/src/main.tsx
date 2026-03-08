import {
  AppKitProvider,
  AppProvider,
  AuthProvider,
  DEFAULT_CHAIN_ID,
  ErrorBoundary,
  initGlobalErrorHandlers,
  initTheme,
  queryClient,
  trackErrorBoundary,
} from "@green-goods/shared";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App.tsx";
import { PERSIST_MAX_AGE, persister, shouldDehydrateQuery } from "@/config/persister";

import "@/index.css";
import "@/config";

type ReactRoot = ReturnType<typeof createRoot>;

declare global {
  interface Window {
    __ADMIN_ROOT__?: ReactRoot;
  }
}

// Initialize theme system
const cleanupTheme = initTheme();

// Initialize global error handlers for PostHog exception tracking
// Catches unhandled errors and promise rejections that escape Error Boundaries
initGlobalErrorHandlers();

export const Root = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister,
      maxAge: PERSIST_MAX_AGE,
      dehydrateOptions: { shouldDehydrateQuery },
    }}
  >
    <ErrorBoundary
      context="AdminApp"
      onError={(error, errorInfo) =>
        trackErrorBoundary(error, {
          componentStack: errorInfo.componentStack,
          boundaryName: "AdminApp",
        })
      }
    >
      <AppKitProvider
        projectId={import.meta.env.VITE_WALLETCONNECT_PROJECT_ID}
        metadata={{
          name: "Green Goods Admin",
          description: "Garden management dashboard for Green Goods protocol",
          url: "https://admin.greengoods.app",
          icons: ["https://greengoods.app/icon.png"],
        }}
        defaultChainId={DEFAULT_CHAIN_ID}
      >
        {/* Single AuthProvider handles both passkey and wallet auth */}
        <AuthProvider>
          <AppProvider posthogKey={import.meta.env.VITE_POSTHOG_ADMIN_KEY}>
            <App />
          </AppProvider>
        </AuthProvider>
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
