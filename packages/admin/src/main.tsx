import { AppKitProvider, WalletAuthProvider } from "@green-goods/shared/providers";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App.tsx";

import "@/index.css";

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
    defaultChainId={42161}
  >
    <WalletAuthProvider>
      <App />
    </WalletAuthProvider>
  </AppKitProvider>
);

const container = document.getElementById("root");
if (!container) throw new Error("Root container not found");

const root = createRoot(container);
root.render(
  <StrictMode>
    <Root />
  </StrictMode>
);
