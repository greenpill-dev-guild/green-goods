import { AppKitProvider } from "@green-goods/shared/providers/AppKitProvider";
import { AuthGate } from "@green-goods/shared/providers/AuthGate";
import { useAuthState } from "@green-goods/shared/hooks/auth/useAuth";
import { APP_DESCRIPTION } from "@green-goods/shared/config/app";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useApp } from "@green-goods/shared/providers/App";
import { type ReactNode, useEffect } from "react";
import { createPwaRoutingConfig } from "@/config/pwaRouting";
import { WalletRuntimeEffects } from "./WalletRuntimeEffects";

export function PwaStartupReadySignal() {
  // Ready includes a remembered wallet account whose wallet is still being
  // asked, so the launch screen does not wait on that wallet.
  const { isReady } = useAuthState();

  useEffect(() => {
    if (!isReady) return;
    const clearBootFallback = (window as Window & { __GG_CLEAR_BOOT_FALLBACK?: () => void })
      .__GG_CLEAR_BOOT_FALLBACK;
    clearBootFallback?.();
  }, [isReady]);

  return null;
}

export default function WalletRuntimeProviders({
  children,
  analyticsIdentity = true,
}: {
  children: ReactNode;
  /** Off where a page must not tie the connected account to analytics, such as chat ceremonies. */
  analyticsIdentity?: boolean;
}) {
  const { isStandalone, platform } = useApp();
  const walletReturnUrl =
    isStandalone && platform === "android" && typeof window !== "undefined"
      ? new URL(
          createPwaRoutingConfig(import.meta.env.VITE_USE_HASH_ROUTER === "true").startUrl,
          window.location.href
        ).href
      : undefined;

  const metadata = {
    name: "Green Goods",
    description: APP_DESCRIPTION,
    url:
      typeof window !== "undefined"
        ? import.meta.env.VITE_APP_URL || window.location.origin
        : "https://www.greengoods.app",
    // Wallet prompts crop the mark to a square.
    icons: ["https://www.greengoods.app/icon-512.png"],
    ...(walletReturnUrl
      ? { redirect: { native: walletReturnUrl, universal: walletReturnUrl } }
      : {}),
  };
  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
  return (
    <AppKitProvider
      projectId={projectId}
      metadata={metadata}
      defaultChainId={DEFAULT_CHAIN_ID}
      fontFamily={'"Inter", system-ui, sans-serif'}
    >
      <AuthGate>
        <PwaStartupReadySignal />
        <WalletRuntimeEffects analyticsIdentity={analyticsIdentity} />
        {children}
      </AuthGate>
    </AppKitProvider>
  );
}
