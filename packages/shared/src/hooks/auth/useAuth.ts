/**
 * Authentication Hooks
 *
 * Provides unified authentication interface using AuthProvider.
 * Supports both passkey and wallet authentication modes.
 *
 * @example
 * ```tsx
 * import { useAuth } from '@green-goods/shared/hooks';
 *
 * function MyComponent() {
 *   const { authMode, eoaAddress, smartAccountAddress, isAuthenticated, signOut } = useAuth();
 *
 *   if (authMode === 'wallet') {
 *     // Wallet user - use eoaAddress
 *   } else if (authMode === 'passkey') {
 *     // Passkey user - use smartAccountAddress
 *   }
 * }
 * ```
 */

import type { SmartAccountClient } from "permissionless";
import type { Hex } from "viem";
import { useAuthContext } from "../../providers/Auth";

// Export auth context hook and type
export { type AuthContextType, useAuthContext } from "../../providers/Auth";

/**
 * Unified auth context returned by useAuth
 * Contains common properties from AuthProvider
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

  // Actions
  createAccount?: (userName: string) => Promise<unknown>;
  loginWithPasskey?: (userName?: string) => Promise<unknown>;
  loginWithWallet?: () => void;
  signOut?: () => Promise<void>;
  switchToWallet?: () => void;
  switchToPasskey?: (userName?: string) => void;
  dismissError?: () => void;
}

/**
 * Universal auth hook
 *
 * Requires AuthProvider to be present in the component tree.
 * Works with both passkey and wallet authentication modes.
 */
export function useAuth(): UseAuthReturn {
  const auth = useAuthContext();

  return {
    // Core state
    authMode: auth.authMode,
    isReady: auth.isReady,
    isAuthenticated: auth.isAuthenticated,
    isAuthenticating: auth.isAuthenticating,
    error: auth.error,

    // Addresses
    eoaAddress: auth.eoaAddress,
    smartAccountAddress: auth.smartAccountAddress,
    walletAddress: auth.walletAddress,

    // External wallet state
    externalWalletConnected: auth.externalWalletConnected,
    externalWalletAddress: auth.externalWalletAddress,

    // Smart account
    smartAccountClient: auth.smartAccountClient,
    credential: auth.credential,
    userName: auth.userName,
    hasStoredCredential: auth.hasStoredCredential,

    // Actions
    createAccount: auth.createAccount,
    loginWithPasskey: auth.loginWithPasskey,
    loginWithWallet: auth.loginWithWallet,
    signOut: auth.signOut,
    switchToWallet: auth.switchToWallet,
    switchToPasskey: auth.switchToPasskey,
    dismissError: auth.dismissError,
  };
}

// ============================================================================
// LEGACY EXPORTS (kept for backwards compatibility)
// ============================================================================

export type { AuthMode } from "../../modules/auth/session";
