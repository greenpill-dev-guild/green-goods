import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/App.tsx";
// import { getDefaultChain } from "@/config";
import { AppProvider } from "@/providers/app";
import { UserProvider } from "@/providers/user";

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
  <AppProvider>
    <UserProvider>
      <App />
    </UserProvider>
  </AppProvider>
);

const container = document.getElementById("root");

if (container) {
  createRoot(container).render(
    <StrictMode>
      <Root />
    </StrictMode>
  );
}
