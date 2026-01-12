/**
 * Chain Configuration Hooks and Functions
 *
 * Provides access to chain-specific configuration. These are pure functions
 * that don't use React state/effects, wrapped in hook-named exports for
 * consistency with the hook-based architecture.
 *
 * @module hooks/blockchain/useChainConfig
 */

import { DEFAULT_CHAIN_ID, getEASConfig, getNetworkConfig } from "../../config/blockchain";

// ============================================================================
// Pure Functions (preferred for non-React contexts)
// ============================================================================

/**
 * Get the current chain ID (constant value from build configuration)
 *
 * @returns The chain ID from VITE_CHAIN_ID environment variable
 *
 * @example
 * ```typescript
 * // In non-React context
 * import { getCurrentChain } from '@green-goods/shared';
 * const chainId = getCurrentChain();
 * ```
 */
export function getCurrentChain(): number {
  return DEFAULT_CHAIN_ID;
}

/**
 * Get EAS configuration for a specific chain
 *
 * @param chainId - The chain ID to get configuration for
 * @returns EAS configuration including schema UIDs and resolver addresses
 *
 * @example
 * ```typescript
 * // In non-React context
 * import { getCurrentChain, getEASConfigForChain } from '@green-goods/shared';
 * const eas = getEASConfigForChain(getCurrentChain());
 * ```
 */
export function getEASConfigForChain(chainId: number) {
  return getEASConfig(chainId);
}

/**
 * Get network configuration for a specific chain
 *
 * @param chainId - The chain ID to get configuration for
 * @returns Network configuration including RPC URLs and block explorer
 *
 * @example
 * ```typescript
 * // In non-React context
 * import { getCurrentChain, getNetworkConfigForChain } from '@green-goods/shared';
 * const network = getNetworkConfigForChain(getCurrentChain());
 * ```
 */
export function getNetworkConfigForChain(chainId: number) {
  return getNetworkConfig(chainId);
}

// ============================================================================
// Hook Wrappers (for React component consistency)
// ============================================================================

/**
 * Hook to get the current chain ID from build configuration.
 * Falls back to Base Sepolia if not configured.
 *
 * Note: This is a pure function wrapper - no React state is used.
 * Prefer `getCurrentChain()` in non-component contexts.
 *
 * @returns The current chain ID
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const chainId = useCurrentChain();
 *   // ...
 * }
 * ```
 */
export function useCurrentChain(): number {
  return getCurrentChain();
}

/**
 * Hook to get EAS configuration for the current chain.
 *
 * Note: This is a pure function wrapper - no React state is used.
 * Prefer `getEASConfigForChain(chainId)` in non-component contexts.
 *
 * @returns EAS configuration for the current chain
 */
export function useEASConfig() {
  return getEASConfigForChain(getCurrentChain());
}

/**
 * Hook to get network configuration for the current chain.
 *
 * Note: This is a pure function wrapper - no React state is used.
 * Prefer `getNetworkConfigForChain(chainId)` in non-component contexts.
 *
 * @returns Network configuration for the current chain
 */
export function useNetworkConfig() {
  return getNetworkConfigForChain(getCurrentChain());
}

/**
 * Hook to get all chain-related configuration.
 *
 * Note: This is a pure function wrapper - no React state is used.
 *
 * @returns Object containing chainId, eas, and network configuration
 */
export function useChainConfig() {
  const chainId = getCurrentChain();
  return {
    chainId,
    eas: getEASConfigForChain(chainId),
    network: getNetworkConfigForChain(chainId),
  };
}
