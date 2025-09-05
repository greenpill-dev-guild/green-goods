import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from 'wagmi'
import { QueryClientProvider } from '@tanstack/react-query'

import App from "@/App.tsx";
import { AuthProvider } from "@/providers/AuthProvider";
import { wagmiConfig, queryClient } from "@/config";

import "@/index.css";

// Initialize theme on app start
function initializeTheme() {
  const themeMode = localStorage.getItem("themeMode") || 'system';
  let shouldBeDark = false;

  if (themeMode === 'dark') {
    shouldBeDark = true;
  } else if (themeMode === 'light') {
    shouldBeDark = false;
  } else {
    // System mode
    shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  if (shouldBeDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

initializeTheme();

export const Root = () => (
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

const container = document.getElementById("root");
if (!container) throw new Error("Root container not found");

const root = createRoot(container);
root.render(
  <StrictMode>
    <Root />
  </StrictMode>
);