import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";

import App from "@/App.tsx";
import { DEFAULT_CHAIN_ID } from "@/config/blockchain";
import { wagmiConfig } from "@/config/appkit"; // Import from appkit.ts (single source of truth)
import { AuthProvider } from "@/providers/auth";
import { AppProvider } from "@/providers/app";

// Initialize AppKit for wallet connection UI
import "@/config/appkit";

import "@/index.css";

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
  <WagmiProvider config={wagmiConfig}>
    <AuthProvider chainId={DEFAULT_CHAIN_ID}>
      <AppProvider>
        <App />
      </AppProvider>
    </AuthProvider>
  </WagmiProvider>
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
