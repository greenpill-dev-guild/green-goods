/**
 * The auth machine's type surface: its context, its events, and the inputs its
 * actors take.
 *
 * Separated from the machine so that reading what the machine *is* does not
 * mean scrolling past a hundred lines of what it is made of. Nothing here
 * refers to the machine, so the dependency runs one way.
 *
 * @module workflows/authMachine.types
 */

import type { SmartAccountClient } from "permissionless";
import type { Hex } from "viem";
import type { P256Credential } from "viem/account-abstraction";
import type { AuthMode } from "../types/auth";

export type WalletConnectionType = "wallet" | "embedded";
type RestorableAuthMode = Extract<AuthMode, WalletConnectionType>;

// ============================================================================
// CONTEXT
// ============================================================================

export interface AuthContext {
  // Passkey session state
  credential: P256Credential | null;
  userName: string | null;
  smartAccountClient: SmartAccountClient | null;
  smartAccountAddress: Hex | null;

  // Wallet session state (when authenticated via wallet)
  walletAddress: Hex | null;

  // Embedded wallet state (AppKit email/social auth)
  embeddedAddress: Hex | null;

  // External wallet state (always tracked, even when not primary auth)
  // This allows us to know a wallet is available for switching
  externalWalletConnected: boolean;
  externalWalletAddress: Hex | null;
  externalWalletConnectionType: WalletConnectionType | null;

  // Persisted intent captured when the actor starts. It selects the restoring
  // state without treating a connector that has not hydrated as signed out.
  restoreAuthMode: RestorableAuthMode | null;

  // Meta
  chainId: number;
  error: Error | null;
  retryCount: number;
}

// ============================================================================
// EVENTS
// ============================================================================

export type AuthEvent =
  // ─────────────────────────────────────────────────────────────────────────
  // User-initiated actions
  // ─────────────────────────────────────────────────────────────────────────
  | { type: "LOGIN_PASSKEY_NEW"; userName: string }
  | { type: "LOGIN_PASSKEY_EXISTING"; userName: string }
  | { type: "LOGIN_WALLET" }
  | { type: "LOGIN_EMBEDDED"; address: Hex } // Login via AppKit embedded wallet (email/social)
  | { type: "SWITCH_TO_WALLET" } // Switch from passkey to wallet (requires external wallet)
  | { type: "SWITCH_TO_PASSKEY"; userName: string } // Switch from wallet to passkey
  | { type: "SIGN_OUT" }
  | { type: "RETRY" }
  | { type: "DISMISS_ERROR" }
  // ─────────────────────────────────────────────────────────────────────────
  // External events (from wagmi - always sent, machine decides what to do)
  // ─────────────────────────────────────────────────────────────────────────
  | { type: "EXTERNAL_WALLET_CONNECTED"; address: Hex; connectionType?: WalletConnectionType }
  | { type: "EXTERNAL_WALLET_DISCONNECTED"; connectionType?: WalletConnectionType }
  | { type: "RESTORE_TIMEOUT" }
  | { type: "MODAL_CLOSED" } // Wallet modal was closed without connecting
  // ─────────────────────────────────────────────────────────────────────────
  // Internal (from services/actors)
  // ─────────────────────────────────────────────────────────────────────────
  | { type: "done.invoke.restoreSession"; output: RestoreSessionResult | null }
  | { type: "error.platform.restoreSession"; error: unknown }
  | { type: "done.invoke.registerPasskey"; output: PasskeySessionResult }
  | { type: "error.platform.registerPasskey"; error: unknown }
  | { type: "done.invoke.authenticatePasskey"; output: PasskeySessionResult }
  | { type: "error.platform.authenticatePasskey"; error: unknown };

// Service result types
export interface PasskeySessionResult {
  credential: P256Credential;
  smartAccountClient: SmartAccountClient;
  smartAccountAddress: Hex;
  userName: string;
}

export interface RestoreSessionResult extends PasskeySessionResult {}

// ============================================================================
// ACTOR INPUT TYPES
// ============================================================================

/** Input for session restore operation */
export interface RestoreSessionInput {
  chainId: number;
}

/** Input for passkey operations (register/authenticate) */
export interface PasskeyOperationInput {
  userName: string | null;
  chainId: number;
}

// ============================================================================
// INPUT TYPE
// ============================================================================

export interface AuthInput {
  chainId: number;
  restoreAuthMode?: RestorableAuthMode | null;
  restoreAddress?: Hex | null;
}
