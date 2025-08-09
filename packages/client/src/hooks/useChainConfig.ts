import { useMemo } from "react";
import { DEFAULT_CHAIN_ID, getEASConfig, getNetworkConfig } from "@/config";

/**
 * Hook to get the current chain ID from the connected wallet
 * Falls back to Base Sepolia if no wallet is connected
 */
export function useCurrentChain() {
  return useMemo(() => DEFAULT_CHAIN_ID, []);
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
