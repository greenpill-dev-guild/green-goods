/**
 * Reown AppKit Configuration
 *
 * Provides wallet connection UI with Green Goods branding.
 * Used as fallback for operators/admins who prefer traditional wallet login.
 *
 * This is the SINGLE source of truth for Wagmi configuration.
 * The WagmiAdapter generates the wagmiConfig that should be used throughout the app.
 *
 * @module config/appkit
 * @see https://reown.com/appkit for documentation
 */

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import type { Chain } from "viem/chains";
import { DEFAULT_CHAIN_ID } from "./blockchain";
import { getChain, SUPPORTED_CHAINS } from "./chains";

type AppKitMetadata = {
  name: string;
  description: string;
  url: string;
  icons: string[];
};

type AppKitInitOptions = {
  projectId?: string;
  metadata?: AppKitMetadata;
  defaultChainId?: number;
};

/**
 * Canonical app URL for wallet connect metadata.
 * Production: always use www.greengoods.app (consistent across IPFS gateways, in-app browsers)
 * Dev/preview: use actual origin for local testing
 */
function getCanonicalAppUrl(): string {
  if (typeof window === "undefined") return "https://www.greengoods.app";

  // Production domains: always canonical
  if (window.location.hostname.endsWith("greengoods.app")) {
    return "https://www.greengoods.app";
  }

  // Dev/preview: use actual origin
  return window.location.origin;
}

const defaultMetadata: AppKitMetadata = {
  name: "Green Goods",
  description: "Start Bringing Your Impact Onchain",
  url: getCanonicalAppUrl(),
  icons: ["https://www.greengoods.app/icon.png"],
};

const defaultProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

let appKitInstance: ReturnType<typeof createAppKit> | null = null;
let wagmiAdapterInstance: WagmiAdapter | null = null;

/**
 * Initialize (or return) the singleton AppKit + Wagmi config.
 * Accepts optional overrides but will not re-initialize once created.
 */
export function ensureAppKit(options?: AppKitInitOptions) {
  // Skip initialization in Node.js/Server environment
  if (typeof window === "undefined") {
    return {
      appKit: null as any,
      wagmiConfig: null as any,
    };
  }

  if (appKitInstance && wagmiAdapterInstance) {
    return {
      appKit: appKitInstance,
      wagmiConfig: wagmiAdapterInstance.wagmiConfig,
    };
  }

  const projectId = options?.projectId ?? defaultProjectId ?? "";

  if (!projectId) {
    console.warn("[AppKit] VITE_WALLETCONNECT_PROJECT_ID not set. Wallet login will not work.");
  }

  const metadata = options?.metadata ?? defaultMetadata;
  const chains = Object.values(SUPPORTED_CHAINS);

  if (chains.length === 0) {
    throw new Error("SUPPORTED_CHAINS must have at least one chain");
  }

  // Type assertion needed due to viem version mismatch between main dependency
  // and @reown/appkit-common's bundled viem. Runtime compatible.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const networks = chains as any;

  wagmiAdapterInstance = new WagmiAdapter({
    networks,
    projectId,
  });

  appKitInstance = createAppKit({
    adapters: [wagmiAdapterInstance],
    networks,
    projectId,
    metadata,
    enableNetworkSwitch: false,
    defaultNetwork: getChain(options?.defaultChainId ?? DEFAULT_CHAIN_ID) as any,
    features: {
      analytics: false, // Disable AppKit analytics (we use PostHog)
    },
    themeMode: "light",
    themeVariables: {
      "--w3m-accent": "#367D42", // Green Goods primary green
      "--w3m-border-radius-master": "12px",
    },
  });

  return {
    appKit: appKitInstance,
    wagmiConfig: wagmiAdapterInstance.wagmiConfig,
  };
}

// Eagerly initialize using defaults so consumers can import directly.
export const { appKit, wagmiConfig } = ensureAppKit();
