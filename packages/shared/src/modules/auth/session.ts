/**
 * Authentication Session Utilities
 *
 * Minimal session management with 3 storage keys:
 * - PASSKEY_STORAGE_KEY: WebAuthn credential for passkey auth
 * - AUTH_MODE_STORAGE_KEY: Which auth method is active ("passkey" | "wallet")
 * - USERNAME_STORAGE_KEY: Pimlico passkey server username (for session restore)
 */

// ============================================================================
// STORAGE KEYS
// ============================================================================

/** Passkey credential storage (legacy - will be replaced by Pimlico server) */
export const PASSKEY_STORAGE_KEY = "greengoods_passkey_credential";

/** Active auth mode */
export const AUTH_MODE_STORAGE_KEY = "greengoods_auth_mode";

/** Username for Pimlico passkey server (only thing stored locally after migration) */
export const USERNAME_STORAGE_KEY = "greengoods_username";

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
// USERNAME (Pimlico Server)
// ============================================================================

/** Get stored username for Pimlico passkey server */
export function getStoredUsername(): string | null {
  return localStorage.getItem(USERNAME_STORAGE_KEY);
}

/** Store username for Pimlico passkey server */
export function setStoredUsername(username: string): void {
  localStorage.setItem(USERNAME_STORAGE_KEY, username);
}

/** Clear stored username */
export function clearStoredUsername(): void {
  localStorage.removeItem(USERNAME_STORAGE_KEY);
}

// ============================================================================
// PASSKEY (Legacy - will be removed after Pimlico migration)
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
 * Clear all auth storage including passkey credential and username.
 *
 * WARNING: This removes the passkey credential permanently.
 * For regular logout, use clearAuthMode() instead to keep the credential.
 * Only use this for complete account/passkey deletion.
 */
export function clearAllAuth(): void {
  localStorage.removeItem(PASSKEY_STORAGE_KEY);
  localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
  localStorage.removeItem(USERNAME_STORAGE_KEY);
}

// ============================================================================
// LEGACY EXPORTS (kept for backward compatibility during migration)
// ============================================================================

/** @deprecated Use getAuthMode instead */
export const getSavedAuthMode = getAuthMode;

/** @deprecated Use setAuthMode instead */
export const saveAuthMode = setAuthMode;

/** @deprecated Use hasStoredPasskey instead */
export const hasStoredPasskeyCredential = hasStoredPasskey;

/** @deprecated Use clearAllAuth instead */
export const clearAllAuthStorage = clearAllAuth;
