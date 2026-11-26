import { APP_DESCRIPTION } from "@green-goods/shared/config/app";
import { OpenfortWalletProvider } from "@green-goods/shared/providers/OpenfortWalletProvider";
import type { ReactNode } from "react";
import { WalletRuntimeEffects } from "@/routes/WalletRuntimeEffects";

export default function PublicWalletRuntimeProviders({
  children,
  analyticsIdentity = true,
}: {
  children: ReactNode;
  /** Chat ceremonies do not tie the connected account to analytics. */
  analyticsIdentity?: boolean;
}) {
  return (
    <OpenfortWalletProvider
      projectId={import.meta.env.VITE_WALLETCONNECT_PROJECT_ID}
      metadata={{
        name: "Green Goods",
        description: APP_DESCRIPTION,
        url: import.meta.env.VITE_APP_URL || window.location.origin,
        icons: ["https://www.greengoods.app/icon-512.png"],
      }}
    >
      <WalletRuntimeEffects analyticsIdentity={analyticsIdentity} />
      {children}
    </OpenfortWalletProvider>
  );
}
