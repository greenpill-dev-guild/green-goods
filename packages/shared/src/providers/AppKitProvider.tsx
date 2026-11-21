import { type Config, createConfig, WagmiProvider } from "wagmi";
import { type AppKitMetadata, createAppKitTransports, ensureAppKit } from "../config/appkit";
import { DEFAULT_CHAIN_ID } from "../config/default-chain";
import { hasMockAuthOverride } from "./DevAuthProvider";

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

  const config =
    import.meta.env.DEV && hasMockAuthOverride() ? mockAuthWagmiConfig(wagmiConfig) : wagmiConfig;
  return <WagmiProvider config={config}>{children}</WagmiProvider>;
}

let mockAuthConfig: Config | null = null;

/**
 * A `?mockAuth=` session borrows a role's address but holds no key, so its wagmi config has
 * no connector and keeps no stored connection: every write, send and signature fails before
 * it can reach a wallet, while reads use the same chains and RPC transports as a real session.
 * AppKit itself still initializes, so its hooks render; a wallet connected through its modal
 * joins AppKit's own config, never this one.
 */
function mockAuthWagmiConfig(real: Config): Config {
  mockAuthConfig ??= createConfig({
    chains: real.chains,
    transports: createAppKitTransports([...real.chains]),
    connectors: [],
    multiInjectedProviderDiscovery: false,
    storage: null,
  });
  return mockAuthConfig;
}

// Re-export AppKit hook
export { useAppKit } from "@reown/appkit/react";
