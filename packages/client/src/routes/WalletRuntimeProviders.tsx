import { AppKitProvider } from "@green-goods/shared/providers/AppKitProvider";
import { AuthGate } from "@green-goods/shared/providers/AuthGate";
import { useAuthState } from "@green-goods/shared/hooks/auth/useAuth";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useAnalyticsIdentity } from "@green-goods/shared/hooks/analytics/useAnalyticsIdentity";
import { useApp } from "@green-goods/shared/providers/App";
import { type ReactNode, useEffect } from "react";

function PwaAnalyticsIdentity() {
  const { locale, isPwaPresentation } = useApp();

  useAnalyticsIdentity({
    app: "client",
    isPwa: isPwaPresentation,
    locale,
  });

  return null;
}

export function PwaStartupReadySignal() {
  const { isReady } = useAuthState();

  useEffect(() => {
    if (!isReady) return;
    const clearBootFallback = (window as Window & { __GG_CLEAR_BOOT_FALLBACK?: () => void })
      .__GG_CLEAR_BOOT_FALLBACK;
    clearBootFallback?.();
  }, [isReady]);

  return null;
}

export default function WalletRuntimeProviders({ children }: { children: ReactNode }) {
  return (
    <AppKitProvider
      projectId={import.meta.env.VITE_WALLETCONNECT_PROJECT_ID}
      metadata={{
        name: "Green Goods",
        description: "Start Bringing Your Impact Onchain",
        url:
          typeof window !== "undefined"
            ? import.meta.env.VITE_APP_URL || window.location.origin
            : "https://www.greengoods.app",
        icons: ["https://greengoods.app/icon.png"],
      }}
      defaultChainId={DEFAULT_CHAIN_ID}
    >
      {/* AuthGate uses DevAuthProvider in dev when ?mockAuth= is present */}
      <AuthGate>
        <PwaStartupReadySignal />
        <PwaAnalyticsIdentity />
        {children}
      </AuthGate>
    </AppKitProvider>
  );
}
