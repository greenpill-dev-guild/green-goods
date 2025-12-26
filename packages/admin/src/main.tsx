import { DEFAULT_CHAIN_ID, initTheme, queryClient } from "@green-goods/shared";
import { greenGoodsIndexer } from "@green-goods/shared/modules";
import { AppKitProvider, AuthProvider } from "@green-goods/shared/providers";
import { AppProvider } from "@green-goods/shared/providers/App";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider as UrqlProvider } from "urql";
import App from "@/App.tsx";

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

export const Root = () => (
  <QueryClientProvider client={queryClient}>
    <UrqlProvider value={greenGoodsIndexer}>
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
    </UrqlProvider>
  </QueryClientProvider>
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
