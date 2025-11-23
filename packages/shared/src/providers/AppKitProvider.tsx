import { WagmiProvider } from "wagmi";
import { ensureAppKit } from "../config/appkit";
import { DEFAULT_CHAIN_ID } from "../config/blockchain";

interface AppKitProviderProps {
  children: React.ReactNode;
  projectId: string;
  metadata: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
  defaultChainId?: number;
}

export function AppKitProvider({
  children,
  projectId,
  metadata,
  defaultChainId = DEFAULT_CHAIN_ID,
}: AppKitProviderProps) {
  // Ensure the shared singleton is configured before rendering WagmiProvider
  const { wagmiConfig } = ensureAppKit({
    projectId,
    metadata,
    defaultChainId,
  });

  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>;
}

// Re-export AppKit hook
export { useAppKit } from "@reown/appkit/react";
