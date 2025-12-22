/**
 * Authentication Hooks
 *
 * Provides unified authentication interface that works with:
 * - AuthProvider (XState-based with Pimlico passkey server)
 * - WalletAuthProvider (wallet only, admin package)
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
import { useOptionalWalletAuth } from "../../providers/WalletAuth";

// Export unified auth hook and context
export { type AuthContextType, useAuthContext } from "../../providers/Auth";
export { useWalletAuth } from "../../providers/WalletAuth";

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

  // Addresses (primary auth method)
  eoaAddress: Hex | undefined;
  smartAccountAddress: Hex | null | undefined;
  walletAddress?: Hex | null;

  // External wallet state (always tracked, even in passkey mode)
  externalWalletConnected: boolean;
  externalWalletAddress: Hex | null;

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
  switchToWallet?: () => void;
  switchToPasskey?: (userName?: string) => void;
  dismissError?: () => void;
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
  externalWalletConnected: false,
  externalWalletAddress: null,
};

/**
 * Universal auth hook that works with all auth providers
 *
 * Priority order:
 * 1. AuthProvider (XState-based with Pimlico passkey server)
 * 2. WalletAuthProvider (wallet only, admin package)
 *
 * If no provider is found, returns a default unauthenticated state.
 */
export function useAuth(): UseAuthReturn {
  // Try unified auth provider first (XState-based)
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
      externalWalletConnected: unifiedAuth.externalWalletConnected,
      externalWalletAddress: unifiedAuth.externalWalletAddress,
      smartAccountClient: unifiedAuth.smartAccountClient,
      credential: unifiedAuth.credential,
      userName: unifiedAuth.userName,
      hasStoredCredential: unifiedAuth.hasStoredCredential,
      createAccount: unifiedAuth.createAccount,
      loginWithPasskey: unifiedAuth.loginWithPasskey,
      loginWithWallet: unifiedAuth.loginWithWallet,
      signOut: unifiedAuth.signOut,
      switchToWallet: unifiedAuth.switchToWallet,
      switchToPasskey: unifiedAuth.switchToPasskey,
      dismissError: unifiedAuth.dismissError,
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
      externalWalletConnected: walletAuth.isAuthenticated, // Wallet is always "external" in wallet-only mode
      externalWalletAddress: walletAuth.eoaAddress ?? null,
      loginWithWallet: walletAuth.connect,
    };
  }

  // No provider available - return default unauthenticated state
  return DEFAULT_AUTH;
}

// ============================================================================
// LEGACY EXPORTS (kept for backwards compatibility)
// ============================================================================

export type { AuthMode } from "../../modules/auth/session";
