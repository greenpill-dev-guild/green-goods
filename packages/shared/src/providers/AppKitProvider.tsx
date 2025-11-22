/**
 * Shared AppKit Provider
 *
 * Provides wallet connection UI with configurable branding.
 * Used by both client and admin packages with their own metadata.
 */

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import type { Chain } from "viem/chains";
import { WagmiProvider } from "wagmi";
import { getChain, SUPPORTED_CHAINS } from "../config/chains";

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
  defaultChainId = 84532,
}: AppKitProviderProps) {
  const networks = useMemo(() => {
    const chains = Object.values(SUPPORTED_CHAINS);
    // TypeScript requires at least one chain in the tuple type
    if (chains.length === 0) {
      throw new Error("SUPPORTED_CHAINS must have at least one chain");
    }
    return chains as unknown as [Chain, ...Chain[]];
  }, []);

  const wagmiAdapter = useMemo(
    () =>
      new WagmiAdapter({
        networks,
        projectId: projectId || "",
      }),
    [networks, projectId]
  );

  const isInitializedRef = useRef(false);

  // Initialize AppKit once
  useEffect(() => {
    if (!projectId) {
      console.warn(
        "AppKit: Project ID is missing. Set VITE_REOWN_PROJECT_ID or VITE_WALLETCONNECT_PROJECT_ID in .env"
      );
      return;
    }

    if (isInitializedRef.current) {
      return;
    }

    createAppKit({
      adapters: [wagmiAdapter],
      networks,
      projectId,
      metadata,
      enableCoinbase: true,
      enableEmbedded: true,
      enableInjected: true,
      enableNetworkSwitch: false,
      includeWalletIds: [
        "163d2cf19babf05eb8962e9748f9ebe613ed52ebf9c8107c9a0f104bfcf161b3",
        "18388be9ac2d02726dbac9777c96efaac06d744b2f6d580fccdd4127a6d01fd1",
        "1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369",
        "fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa",
        "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
        "8a0ee50d1f22f6651afcae7eb4253e52a3310b90af5daef78a8c4929a9bb99d4",
        "19177a98252e07ddfc9af2083ba8e07ef627cb6103467ffebb3f8f4205fd7927",
      ],
      defaultNetwork: getChain(defaultChainId),
      features: {
        analytics: false, // Use PostHog instead
      },
      themeMode: "light",
      themeVariables: {
        "--w3m-accent": "#367D42", // Green Goods primary green
        "--w3m-border-radius-master": "12px",
      },
    });
    isInitializedRef.current = true;
  }, [defaultChainId, metadata, networks, projectId, wagmiAdapter]);

  if (!projectId) {
    return (
      <div style={{ padding: "20px", color: "red" }}>
        Error: AppKit Project ID is missing. Set VITE_REOWN_PROJECT_ID or
        VITE_WALLETCONNECT_PROJECT_ID in your .env file.
      </div>
    );
  }

  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

// Re-export AppKit hook
export { useAppKit } from "@reown/appkit/react";
