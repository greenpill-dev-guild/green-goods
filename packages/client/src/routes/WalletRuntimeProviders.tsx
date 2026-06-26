import {
  AppKitProvider,
  AuthGate,
  DEFAULT_CHAIN_ID,
  useAnalyticsIdentity,
  useApp,
} from "@green-goods/shared";
import type { ReactNode } from "react";

function PwaAnalyticsIdentity() {
  const { locale, isPwaPresentation } = useApp();

  useAnalyticsIdentity({
    app: "client",
    isPwa: isPwaPresentation,
    locale,
  });

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
        <PwaAnalyticsIdentity />
        {children}
      </AuthGate>
    </AppKitProvider>
  );
}
