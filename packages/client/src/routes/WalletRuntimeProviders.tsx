import { AppKitProvider } from "@green-goods/shared/providers/AppKitProvider";
import { AuthGate } from "@green-goods/shared/providers/AuthGate";
import { useAuthState, useWalletReconnectPrompt } from "@green-goods/shared/hooks/auth/useAuth";
import { APP_DESCRIPTION } from "@green-goods/shared/config/app";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useAnalyticsIdentity } from "@green-goods/shared/hooks/analytics/useAnalyticsIdentity";
import { useApp } from "@green-goods/shared/providers/App";
import { type ReactNode, useEffect } from "react";
import { createPwaRoutingConfig } from "@/config/pwaRouting";

function PwaAnalyticsIdentity() {
  const { locale, isPwaPresentation } = useApp();

  useAnalyticsIdentity({
    app: "client",
    isPwa: isPwaPresentation,
    locale,
  });

  return null;
}

/** Asks a wallet account to reconnect when its wallet has not answered (PRD-1499). */
function WalletReconnectPrompt() {
  useWalletReconnectPrompt();
  return null;
}

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

  return (
    <AppKitProvider
      projectId={import.meta.env.VITE_WALLETCONNECT_PROJECT_ID}
      metadata={{
        name: "Green Goods",
        description: APP_DESCRIPTION,
        url:
          typeof window !== "undefined"
            ? import.meta.env.VITE_APP_URL || window.location.origin
            : "https://www.greengoods.app",
        // Wallets fill a square or round frame with this icon (Rabby's prompts crop to fill), so
        // it is the padded square app icon: the wide mark (icon.png) lost both outer arcs there.
        icons: ["https://www.greengoods.app/icon-512.png"],
        // Rabby Android reads native when moving its task to the background fails.
        ...(walletReturnUrl
          ? { redirect: { native: walletReturnUrl, universal: walletReturnUrl } }
          : {}),
      }}
      defaultChainId={DEFAULT_CHAIN_ID}
      fontFamily={'"Inter", system-ui, sans-serif'}
    >
      {/* AuthGate uses DevAuthProvider in dev when ?mockAuth= is present */}
      <AuthGate>
        <PwaStartupReadySignal />
        <WalletReconnectPrompt />
        {analyticsIdentity ? <PwaAnalyticsIdentity /> : null}
        {children}
      </AuthGate>
    </AppKitProvider>
  );
}
