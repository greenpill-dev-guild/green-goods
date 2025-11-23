import { DEFAULT_CHAIN_ID, initTheme } from "@green-goods/shared";
import { AppKitProvider, WalletAuthProvider } from "@green-goods/shared/providers";
import { AppProvider } from "@green-goods/shared/providers/app";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App.tsx";

import "@/index.css";
import "@/config/pinata";

type ReactRoot = ReturnType<typeof createRoot>;

declare global {
  interface Window {
    __ADMIN_ROOT__?: ReactRoot;
  }
}

// Initialize theme system
const cleanupTheme = initTheme();

export const Root = () => (
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
    <WalletAuthProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </WalletAuthProvider>
  </AppKitProvider>
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
