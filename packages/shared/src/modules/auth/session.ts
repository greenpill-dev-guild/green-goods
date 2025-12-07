/**
 * Authentication Session Utilities
 *
 * Minimal session management with just 2 storage keys:
 * - PASSKEY_STORAGE_KEY: WebAuthn credential for passkey auth
 * - AUTH_MODE_STORAGE_KEY: Which auth method is active ("passkey" | "wallet")
 */

// ============================================================================
// STORAGE KEYS
// ============================================================================

/** Passkey credential storage */
export const PASSKEY_STORAGE_KEY = "greengoods_passkey_credential";

/** Active auth mode */
export const AUTH_MODE_STORAGE_KEY = "greengoods_auth_mode";

// ============================================================================
// AUTH MODE
// ============================================================================

export type AuthMode = "passkey" | "wallet" | null;

/** Get the active auth mode */
export function getAuthMode(): AuthMode {
  return localStorage.getItem(AUTH_MODE_STORAGE_KEY) as AuthMode;
}

/** Set the active auth mode */
export function setAuthMode(mode: "passkey" | "wallet"): void {
  localStorage.setItem(AUTH_MODE_STORAGE_KEY, mode);
}

/** Clear the auth mode (on sign out) */
export function clearAuthMode(): void {
  localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
}

// ============================================================================
// PASSKEY
// ============================================================================

/** Check if there's a stored passkey credential */
export function hasStoredPasskey(): boolean {
  return !!localStorage.getItem(PASSKEY_STORAGE_KEY);
}

/** Clear the stored passkey credential */
export function clearStoredPasskey(): void {
  localStorage.removeItem(PASSKEY_STORAGE_KEY);
}

// ============================================================================
// SIGN OUT
// ============================================================================

/**
 * Clear all auth storage including passkey credential.
 *
 * WARNING: This removes the passkey credential permanently.
 * For regular logout, use clearAuthMode() instead to keep the credential.
 * Only use this for complete account/passkey deletion.
 */
export function clearAllAuth(): void {
  localStorage.removeItem(PASSKEY_STORAGE_KEY);
  localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
}

// ============================================================================
// LEGACY EXPORTS (for backward compatibility during migration)
// ============================================================================

/** @deprecated Use getAuthMode */
export const getSavedAuthMode = getAuthMode;

/** @deprecated Use setAuthMode */
export const saveAuthMode = setAuthMode;

/** @deprecated Use hasStoredPasskey */
export const hasStoredPasskeyCredential = hasStoredPasskey;

/** @deprecated Use clearAllAuth */
export const clearAllAuthStorage = clearAllAuth;

/** @deprecated No longer used */
export const PASSKEY_SIGNED_OUT_KEY = "greengoods_passkey_signed_out";
export const SESSION_MARKER_KEY = "greengoods_session_active";
export const SIGNED_OUT_KEY = "greengoods_signed_out";

/** @deprecated No longer used - passkey handles its own state */
export function wasPasskeySignedOut(): boolean {
  return false;
}
export function setPasskeySignedOut(): void {}
export function clearPasskeySignedOut(): void {}

/** @deprecated No longer used */
export function isFreshAppStart(): boolean {
  return false;
}
export function setWalletConnectIntent(): void {}
export function consumeWalletConnectIntent(): boolean {
  return true;
}
export function clearWalletConnectIntent(): void {}
export function markSessionActive(): void {}
export function checkAndHandleFreshStart(): boolean {
  return false;
}
export function setSignedOut(): void {}
export function clearSignedOut(): void {}
export function wasExplicitlySignedOut(): boolean {
  return false;
}
