import { WagmiProvider } from "wagmi";
import { type AppKitMetadata, ensureAppKit } from "../config/appkit";
import { DEFAULT_CHAIN_ID } from "../config/default-chain";

interface AppKitProviderProps {
  children: React.ReactNode;
  projectId: string;
  metadata: AppKitMetadata;
  defaultChainId?: number;
  fontFamily?: string;
}

export function AppKitProvider({
  children,
  projectId,
  metadata,
  defaultChainId = DEFAULT_CHAIN_ID,
  fontFamily,
}: AppKitProviderProps) {
  // Ensure the shared singleton is configured before rendering WagmiProvider.
  // wagmiConfig is non-null here — AppKitProvider only renders in the browser.
  const { wagmiConfig } = ensureAppKit({
    projectId,
    metadata,
    defaultChainId,
    fontFamily,
  });

  if (!wagmiConfig) {
    throw new Error("AppKitProvider requires a browser environment (wagmiConfig is null in SSR)");
  }

  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>;
}

// Re-export AppKit hook
export { useAppKit } from "@reown/appkit/react";
