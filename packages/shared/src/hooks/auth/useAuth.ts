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
import type { P256Credential } from "viem/account-abstraction";
import { type AuthMode } from "../../modules/auth/session";
import { useAuthContext } from "../../providers/Auth";

// Export auth context hook and type
export { type AuthContextType, useAuthContext } from "../../providers/Auth";

/**
 * Unified auth context returned by useAuth.
 *
 * This interface mirrors {@link AuthContextType} from the Auth provider.
 * All fields match the provider's context type to prevent consumer confusion.
 * Legacy aliases are omitted — use the primary action names instead.
 */
interface UseAuthReturn {
  // Core state
  authMode: AuthMode;
  isReady: boolean;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  error: Error | null;

  // Passkey state
  credential: P256Credential | null;
  smartAccountAddress: Hex | null;
  smartAccountClient: SmartAccountClient | null;
  userName: string | null;
  hasStoredCredential: boolean;

  // Wallet state (when wallet is the primary auth)
  walletAddress: Hex | null;
  eoaAddress: Hex | undefined;

  // Embedded wallet state (AppKit email/social)
  embeddedAddress: Hex | null;

  // External wallet state (always tracked, even in passkey mode)
  externalWalletConnected: boolean;
  externalWalletAddress: Hex | null;

  // Actions - Primary flow
  createAccount: (userName: string) => Promise<void>;
  loginWithPasskey: (userName?: string) => Promise<void>;
  loginWithWallet: () => void;
  loginWithEmbedded: () => void;
  signOut: () => Promise<void>;

  // Actions - Switching auth methods
  switchToWallet: () => void;
  switchToPasskey: (userName?: string) => void;

  // Actions - Additional
  retry: () => void;
  dismissError: () => void;
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

    // Passkey state
    credential: auth.credential,
    smartAccountAddress: auth.smartAccountAddress,
    smartAccountClient: auth.smartAccountClient,
    userName: auth.userName,
    hasStoredCredential: auth.hasStoredCredential,

    // Wallet state (when wallet is PRIMARY auth)
    walletAddress: auth.walletAddress,
    eoaAddress: auth.eoaAddress,

    // Embedded wallet state
    embeddedAddress: auth.embeddedAddress,

    // External wallet state
    externalWalletConnected: auth.externalWalletConnected,
    externalWalletAddress: auth.externalWalletAddress,

    // Actions - Primary flow
    createAccount: auth.createAccount,
    loginWithPasskey: auth.loginWithPasskey,
    loginWithWallet: auth.loginWithWallet,
    loginWithEmbedded: auth.loginWithEmbedded,
    signOut: auth.signOut,

    // Actions - Switching
    switchToWallet: auth.switchToWallet,
    switchToPasskey: auth.switchToPasskey,

    // Actions - Additional
    retry: auth.retry,
    dismissError: auth.dismissError,
  };
}

// ============================================================================
// LEGACY EXPORTS (kept for backwards compatibility)
// ============================================================================

export type { AuthMode } from "../../modules/auth/session";
