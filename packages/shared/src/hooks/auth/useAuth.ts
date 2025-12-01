/**
 * Authentication Hooks
 *
 * Re-exports authentication hooks from providers for convenience.
 * - useClientAuth: For client package (passkey + wallet orchestration)
 * - usePasskeyAuth: For passkey-only auth
 * - useWalletAuth: For admin package (wallet-only auth)
 *
 * @example Client package:
 * ```tsx
 * import { useClientAuth } from '@greengoods/shared/hooks/auth';
 *
 * function MyComponent() {
 *   const { smartAccountAddress, walletAddress, authMode, createPasskey } = useClientAuth();
 *   // ...
 * }
 * ```
 *
 * @example Admin package:
 * ```tsx
 * import { useWalletAuth } from '@greengoods/shared/hooks/auth';
 *
 * function MyComponent() {
 *   const { address, isConnected, connect } = useWalletAuth();
 *   // ...
 * }
 * ```
 */

import type { SmartAccountClient } from "permissionless";
import type { Hex } from "viem";
import { useOptionalClientAuth } from "../../providers/ClientAuth";
import { useOptionalWalletAuth } from "../../providers/WalletAuth";

export { type AuthMode, useClientAuth } from "../../providers/ClientAuth";
export { usePasskeyAuth } from "../../providers/PasskeyAuth";
export { useWalletAuth } from "../../providers/WalletAuth";

/**
 * Unified auth context returned by useAuth
 * Contains common properties from both WalletAuth and ClientAuth
 */
interface UseAuthReturn {
  // Unified auth interface properties
  authMode: "wallet" | "passkey" | null;
  eoaAddress: Hex | undefined;
  smartAccountAddress: Hex | null | undefined;
  smartAccountClient: SmartAccountClient | null | undefined;
  isReady: boolean;
  isAuthenticated: boolean;
  isAuthenticating: boolean;

  // Additional wallet properties (from ClientAuth)
  walletAddress?: Hex | null;
}

/**
 * Default auth state for when no provider is available
 */
const DEFAULT_AUTH: UseAuthReturn = {
  authMode: null,
  eoaAddress: undefined,
  smartAccountAddress: undefined,
  smartAccountClient: undefined,
  isReady: false,
  isAuthenticated: false,
  isAuthenticating: false,
};

/**
 * Universal auth hook that works with both Client and Admin auth providers
 *
 * Returns the active auth context, prioritizing ClientAuth (passkey + wallet)
 * over WalletAuth (wallet only). If neither is available, returns a default
 * unauthenticated state.
 */
export function useAuth(): UseAuthReturn {
  const clientAuth = useOptionalClientAuth();
  const walletAuth = useOptionalWalletAuth();

  // Prioritize client auth (more specific - supports both passkey and wallet)
  if (clientAuth) {
    return {
      authMode: clientAuth.authMode,
      eoaAddress: clientAuth.eoaAddress,
      smartAccountAddress: clientAuth.smartAccountAddress,
      smartAccountClient: clientAuth.smartAccountClient,
      isReady: clientAuth.isReady,
      isAuthenticated: clientAuth.isAuthenticated,
      isAuthenticating: clientAuth.isAuthenticating,
      walletAddress: clientAuth.walletAddress,
    };
  }

  // Fall back to wallet auth (admin package)
  if (walletAuth) {
    return {
      authMode: walletAuth.authMode,
      eoaAddress: walletAuth.eoaAddress,
      smartAccountAddress: undefined,
      smartAccountClient: undefined,
      isReady: walletAuth.isReady,
      isAuthenticated: walletAuth.isAuthenticated,
      isAuthenticating: walletAuth.isAuthenticating,
    };
  }

  // No provider available - return default unauthenticated state
  return DEFAULT_AUTH;
}
