/**
 * Authentication Hooks
 *
 * Provides unified authentication interface that works with:
 * - New XState-based AuthProvider (preferred)
 * - Legacy ClientAuth provider (passkey + wallet)
 * - Legacy WalletAuth provider (wallet only)
 *
 * @example Client package:
 * ```tsx
 * import { useAuth } from '@greengoods/shared/hooks/auth';
 *
 * function MyComponent() {
 *   const { smartAccountAddress, walletAddress, authMode, createAccount } = useAuth();
 *   // ...
 * }
 * ```
 *
 * @example Admin package:
 * ```tsx
 * import { useAuth } from '@greengoods/shared/hooks/auth';
 *
 * function MyComponent() {
 *   const { eoaAddress, isAuthenticated, loginWithWallet } = useAuth();
 *   // ...
 * }
 * ```
 */

import type { SmartAccountClient } from "permissionless";
import type { Hex } from "viem";
import { useOptionalAuthContext } from "../../providers/Auth";
import { useOptionalClientAuth } from "../../providers/ClientAuth";
import { useOptionalWalletAuth } from "../../providers/WalletAuth";

// Re-export legacy hooks for backwards compatibility
export { type AuthMode, useClientAuth } from "../../providers/ClientAuth";
export { usePasskeyAuth } from "../../providers/PasskeyAuth";
export { useWalletAuth } from "../../providers/WalletAuth";

// Export new unified auth hook and context
export { useAuthContext, type AuthContextType } from "../../providers/Auth";

/**
 * Unified auth context returned by useAuth
 * Contains common properties from all auth providers
 */
interface UseAuthReturn {
  // Core state
  authMode: "wallet" | "passkey" | null;
  isReady: boolean;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  error?: Error | null;

  // Addresses
  eoaAddress: Hex | undefined;
  smartAccountAddress: Hex | null | undefined;
  walletAddress?: Hex | null;

  // Smart account (passkey mode)
  smartAccountClient: SmartAccountClient | null | undefined;
  credential?: unknown;
  userName?: string | null;
  hasStoredCredential?: boolean;

  // Actions (return types are flexible to support both void and PasskeySession)
  createAccount?: (userName?: string) => Promise<unknown>;
  loginWithPasskey?: (userName?: string) => Promise<unknown>;
  loginWithWallet?: () => void;
  signOut?: () => Promise<void>;
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
 * Universal auth hook that works with all auth providers
 *
 * Priority order:
 * 1. New XState-based AuthProvider (preferred)
 * 2. Legacy ClientAuth (passkey + wallet orchestration)
 * 3. Legacy WalletAuth (wallet only, admin package)
 *
 * If no provider is found, returns a default unauthenticated state.
 */
export function useAuth(): UseAuthReturn {
  // Try new unified auth provider first (XState-based)
  const unifiedAuth = useOptionalAuthContext();
  if (unifiedAuth) {
    return {
      authMode: unifiedAuth.authMode,
      isReady: unifiedAuth.isReady,
      isAuthenticated: unifiedAuth.isAuthenticated,
      isAuthenticating: unifiedAuth.isAuthenticating,
      error: unifiedAuth.error,
      eoaAddress: unifiedAuth.eoaAddress,
      smartAccountAddress: unifiedAuth.smartAccountAddress,
      walletAddress: unifiedAuth.walletAddress,
      smartAccountClient: unifiedAuth.smartAccountClient,
      credential: unifiedAuth.credential,
      userName: unifiedAuth.userName,
      hasStoredCredential: unifiedAuth.hasStoredCredential,
      createAccount: unifiedAuth.createAccount,
      loginWithPasskey: unifiedAuth.loginWithPasskey,
      loginWithWallet: unifiedAuth.loginWithWallet,
      signOut: unifiedAuth.signOut,
    };
  }

  // Fall back to legacy client auth (passkey + wallet)
  const clientAuth = useOptionalClientAuth();
  if (clientAuth) {
    return {
      authMode: clientAuth.authMode,
      isReady: clientAuth.isReady,
      isAuthenticated: clientAuth.isAuthenticated,
      isAuthenticating: clientAuth.isAuthenticating,
      error: clientAuth.error,
      eoaAddress: clientAuth.eoaAddress,
      smartAccountAddress: clientAuth.smartAccountAddress,
      walletAddress: clientAuth.walletAddress,
      smartAccountClient: clientAuth.smartAccountClient,
      credential: clientAuth.credential,
      hasStoredCredential: clientAuth.hasStoredCredential,
      createAccount: clientAuth.createAccount,
      loginWithPasskey: clientAuth.loginWithPasskey,
      loginWithWallet: clientAuth.loginWithWallet,
      signOut: clientAuth.signOut,
    };
  }

  // Fall back to wallet auth (admin package)
  const walletAuth = useOptionalWalletAuth();
  if (walletAuth) {
    return {
      authMode: walletAuth.authMode,
      isReady: walletAuth.isReady,
      isAuthenticated: walletAuth.isAuthenticated,
      isAuthenticating: walletAuth.isAuthenticating,
      eoaAddress: walletAuth.eoaAddress,
      smartAccountAddress: undefined,
      smartAccountClient: undefined,
      loginWithWallet: walletAuth.connect,
    };
  }

  // No provider available - return default unauthenticated state
  return DEFAULT_AUTH;
}
