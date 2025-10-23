import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config";
import { AppKitProvider, WalletAuthProvider } from "@green-goods/shared/providers";
import { AppProvider } from "@green-goods/shared/providers/app";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App.tsx";

import "@/index.css";

type ReactRoot = ReturnType<typeof createRoot>;

declare global {
  interface Window {
    __ADMIN_ROOT__?: ReactRoot;
  }
}

// Initialize theme on app start
function initializeTheme() {
  const themeMode = localStorage.getItem("themeMode") || "system";
  let shouldBeDark = false;

  if (themeMode === "dark") {
    shouldBeDark = true;
  } else if (themeMode === "light") {
    shouldBeDark = false;
  } else {
    // System mode
    shouldBeDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  if (shouldBeDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

initializeTheme();

export const Root = () => (
  <AppKitProvider
    projectId={
      import.meta.env.VITE_REOWN_PROJECT_ID || import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
    }
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
    root.unmount();
    delete window.__ADMIN_ROOT__;
  });
}
