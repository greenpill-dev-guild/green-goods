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
		[networks, projectId],
	);

	const isInitializedRef = useRef(false);

	// Initialize AppKit once
	useEffect(() => {
		if (!projectId) {
			console.error(
				"AppKit: Project ID is missing. Set VITE_REOWN_PROJECT_ID or VITE_WALLETCONNECT_PROJECT_ID in .env",
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
