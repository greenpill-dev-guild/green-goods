/**
 * Unified Authentication Types
 *
 * Provides a common interface for authentication across different providers
 * (WalletAuthProvider, PasskeyAuthProvider, ClientAuthProvider).
 */

import type { SmartAccountClient } from "permissionless";
import type { Hex } from "viem";
import type { P256Credential } from "viem/account-abstraction";

/**
 * Authentication mode type
 * - 'wallet': Traditional EOA wallet authentication (admin package)
 * - 'passkey': WebAuthn passkey with smart account (client package)
 * - null: Not authenticated
 */
export type AuthMode = "wallet" | "passkey" | null;

/**
 * Base authentication context properties
 * All auth providers should include these core fields
 */
export interface BaseAuthContext {
  /** Whether the auth provider has finished initializing */
  isReady: boolean;
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Whether an authentication action is in progress */
  isAuthenticating?: boolean;
  /** Current authentication mode */
  authMode: AuthMode;
}

/**
 * Wallet-specific authentication context
 * Used by WalletAuthProvider (admin package)
 */
export interface WalletAuthContext extends BaseAuthContext {
  authMode: "wallet" | null;
  /** EOA wallet address */
  eoaAddress: Hex | undefined;
  /** Smart account address (undefined for wallet-only auth) */
  smartAccountAddress?: undefined;
  /** Smart account client (undefined for wallet-only auth) */
  smartAccountClient?: undefined;
}

/**
 * Passkey-specific authentication context
 * Used by PasskeyAuthProvider
 */
export interface PasskeyAuthContext extends BaseAuthContext {
  authMode: "passkey" | null;
  /** EOA wallet address (optional, from connected wallet) */
  eoaAddress?: Hex | undefined;
  /** Smart account address (primary identifier for passkey users) */
  smartAccountAddress: Hex | null;
  /** Smart account client for transaction signing */
  smartAccountClient: SmartAccountClient | null;
  /** WebAuthn credential */
  credential: P256Credential | null;
}

/**
 * Client authentication context (combined passkey + wallet)
 * Used by ClientAuthProvider (client package)
 */
export interface ClientAuthContext extends BaseAuthContext {
  authMode: AuthMode;
  /** EOA wallet address (when in wallet mode or as fallback) */
  eoaAddress?: Hex | undefined;
  /** Smart account address (when in passkey mode) */
  smartAccountAddress: Hex | null;
  /** Smart account client (when in passkey mode) */
  smartAccountClient: SmartAccountClient | null;
  /** WebAuthn credential (when in passkey mode) */
  credential?: P256Credential | null;
  /** Wallet address (when in wallet mode) */
  walletAddress?: Hex | null;
}

/**
 * Unified authentication context
 * Union type that represents any possible auth context
 */
export type UnifiedAuthContext = WalletAuthContext | PasskeyAuthContext | ClientAuthContext;

/**
 * Type guard to check if context is wallet-only auth
 */
export function isWalletAuth(auth: UnifiedAuthContext): auth is WalletAuthContext {
  return auth.authMode === "wallet" && !("smartAccountClient" in auth && auth.smartAccountClient);
}

/**
 * Type guard to check if context is passkey auth
 */
export function isPasskeyAuth(auth: UnifiedAuthContext): auth is PasskeyAuthContext {
  return (
    auth.authMode === "passkey" && "smartAccountClient" in auth && auth.smartAccountClient !== null
  );
}

/**
 * Type guard to check if context has smart account capabilities
 */
export function hasSmartAccount(
  auth: UnifiedAuthContext
): auth is PasskeyAuthContext | ClientAuthContext {
  return "smartAccountClient" in auth && auth.smartAccountClient !== null;
}
