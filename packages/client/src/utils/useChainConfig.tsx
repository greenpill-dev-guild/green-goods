import { useWallets } from "@privy-io/react-auth";
import { useMemo } from "react";
import { getEASConfig, getNetworkConfig } from "@/constants";

/**
 * Hook to get the current chain ID from the connected wallet
 * Falls back to Base Sepolia if no wallet is connected
 */
export function useCurrentChain() {
  const { wallets } = useWallets();

  const chainId = useMemo(() => {
    // Get the first connected wallet
    const connectedWallet = wallets.find((wallet) => wallet.chainId);

    if (connectedWallet?.chainId) {
      // Convert hex to decimal if needed
      const chain =
        typeof connectedWallet.chainId === "string" && connectedWallet.chainId.startsWith("0x")
          ? parseInt(connectedWallet.chainId, 16)
          : connectedWallet.chainId;

      return Number(chain);
    }

    // Fallback to environment variable or Base Sepolia
    const envChain = import.meta.env.VITE_CHAIN_ID;
    return envChain ? Number(envChain) : 84532; // Base Sepolia
  }, [wallets]);

  return chainId;
}

/**
 * Hook to get EAS configuration for the current chain
 */
export function useEASConfig() {
  const chainId = useCurrentChain();

  return useMemo(() => {
    return getEASConfig(chainId);
  }, [chainId]);
}

/**
 * Hook to get network configuration for the current chain
 */
export function useNetworkConfig() {
  const chainId = useCurrentChain();

  return useMemo(() => {
    return getNetworkConfig(chainId);
  }, [chainId]);
}

/**
 * Hook to get all chain-related configuration
 */
export function useChainConfig() {
  const chainId = useCurrentChain();
  const easConfig = useEASConfig();
  const networkConfig = useNetworkConfig();

  return useMemo(
    () => ({
      chainId,
      eas: easConfig,
      network: networkConfig,
    }),
    [chainId, easConfig, networkConfig]
  );
}
