/**
 * Wagmi Configuration
 *
 * Configures wallet connections for operators and admins.
 * Supports MetaMask, WalletConnect, Coinbase Wallet, and browser injected wallets.
 */

import { createConfig, http } from "wagmi";
import { arbitrum, baseSepolia, celo } from "wagmi/chains";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";
import type { Chain } from "viem/chains";

// WalletConnect Project ID from environment
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";

// Supported chains
const chains = [arbitrum, baseSepolia, celo] as [Chain, ...Chain[]];

// Create wagmi config
export const wagmiConfig = createConfig({
  chains,
  connectors: [
    // Injected wallets (MetaMask, Brave, etc.)
    injected({ target: "metaMask" }),

    // WalletConnect
    ...(projectId
      ? [
          walletConnect({
            projectId,
            metadata: {
              name: "Green Goods",
              description: "Regenerative farming verification platform",
              url: "https://greengoods.app",
              icons: ["https://greengoods.app/icon.png"],
            },
            showQrModal: true,
          }),
        ]
      : []),

    // Coinbase Wallet
    coinbaseWallet({
      appName: "Green Goods",
      appLogoUrl: "https://greengoods.app/icon.png",
    }),
  ],
  transports: {
    [arbitrum.id]: http(),
    [baseSepolia.id]: http(),
    [celo.id]: http(),
  },
});

// Export chain config for easy access
export { chains };
export type WagmiChain = (typeof chains)[number];
