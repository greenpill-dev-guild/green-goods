/**
 * Authentication Session Utilities
 *
 * Client-only session management for passkey authentication.
 *
 * Storage keys:
 * - AUTH_MODE_STORAGE_KEY: Which auth method is active ("passkey" | "wallet")
 * - USERNAME_STORAGE_KEY: User's display name
 * - CREDENTIAL_STORAGE_KEY: Passkey credential (id + publicKey)
 *
 * Note: This is a simplified client-only approach following Pimlico's documentation.
 * Credentials are stored in localStorage - no server-side storage needed.
 * Reference: https://docs.pimlico.io/docs/how-tos/signers/passkey
 */

import type { P256Credential } from "viem/account-abstraction";

// ============================================================================
// STORAGE KEYS
// ============================================================================

/** Active auth mode */
export const AUTH_MODE_STORAGE_KEY = "greengoods_auth_mode";

/** Username for display */
export const USERNAME_STORAGE_KEY = "greengoods_username";

/** Passkey credential (id + publicKey as JSON) */
export const CREDENTIAL_STORAGE_KEY = "greengoods_credential";

/** RP ID used during passkey registration (for cross-device consistency) */
export const RP_ID_STORAGE_KEY = "greengoods_rp_id";

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

/** Check if there's a stored username (indicates existing account) */
export function hasStoredUsername(): boolean {
  return Boolean(localStorage.getItem(USERNAME_STORAGE_KEY));
}

// ============================================================================
// RP ID (for Android passkey compatibility)
// ============================================================================

/**
 * Get stored RP ID from localStorage.
 *
 * NOTE: The primary RP ID source is now `getPasskeyRpId()` from passkeyServer.ts
 * which uses a hardcoded production domain (greengoods.app).
 * This function is kept for backward compatibility and debugging.
 *
 * @deprecated Use `getPasskeyRpId()` from passkeyServer.ts instead
 */
export function getStoredRpId(): string {
  // Check stored value from previous registration
  const storedRpId = localStorage.getItem(RP_ID_STORAGE_KEY);
  if (storedRpId) {
    return storedRpId;
  }

  // Fall back to current hostname
  return window.location.hostname;
}

/** Store RP ID used during registration */
export function setStoredRpId(rpId: string): void {
  localStorage.setItem(RP_ID_STORAGE_KEY, rpId);
}

/** Clear stored RP ID */
export function clearStoredRpId(): void {
  localStorage.removeItem(RP_ID_STORAGE_KEY);
}

// ============================================================================
// SIGN OUT
// ============================================================================

/**
 * Clear all auth storage including credential, username, and RP ID.
 *
 * WARNING: This removes the credential permanently.
 * For regular logout, use clearAuthMode() instead to keep the credential.
 * Only use this for complete account deletion.
 */
export function clearAllAuth(): void {
  localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
  localStorage.removeItem(USERNAME_STORAGE_KEY);
  localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
  localStorage.removeItem(RP_ID_STORAGE_KEY);
}

// ============================================================================
// DEBUG UTILITIES
// ============================================================================

/**
 * Debug function to check passkey configuration.
 * Call this from browser console to diagnose Android passkey issues:
 *   window.__debugPasskey() (in dev mode)
 */
export function debugPasskeyConfig(): void {
  const envRpId = import.meta.env.VITE_PASSKEY_RP_ID;
  const storedRpId = localStorage.getItem(RP_ID_STORAGE_KEY);
  const storedUsername = localStorage.getItem(USERNAME_STORAGE_KEY);
  const hostname = window.location.hostname;
  const origin = window.location.origin;

  // Import the hardcoded value for display
  const hardcodedRpId = "greengoods.app";

  console.group("[Passkey Debug] Configuration");
  console.log("Hardcoded RP ID:", hardcodedRpId);
  console.log("Environment VITE_PASSKEY_RP_ID:", envRpId || "(not set, will use hardcoded)");
  console.log("Stored RP ID (localStorage):", storedRpId || "(not set)");
  console.log("Current hostname:", hostname);
  console.log("Current origin:", origin);
  console.log("Stored username:", storedUsername || "(not set)");
  console.log("---");

  // Determine effective RP ID (matching logic in getPasskeyRpId)
  let effectiveRpId = hardcodedRpId;
  if (envRpId) {
    effectiveRpId = envRpId;
  } else if (import.meta.env.DEV && hostname === "localhost") {
    effectiveRpId = "localhost";
  }

  console.log("Effective RP ID for auth:", effectiveRpId);

  if (storedRpId && storedRpId !== effectiveRpId) {
    console.warn(
      "⚠️ WARNING: Stored RP ID differs from effective RP ID!",
      "\n  Stored:",
      storedRpId,
      "\n  Effective:",
      effectiveRpId,
      "\n  This may cause Android passkey issues."
    );
  }
  console.groupEnd();
}

// Expose debug function globally in development
if (import.meta.env.DEV) {
  (window as { __debugPasskey?: typeof debugPasskeyConfig }).__debugPasskey = debugPasskeyConfig;
}

// ============================================================================
// CREDENTIAL STORAGE (Client-Only)
// ============================================================================

/**
 * Serializable credential data for localStorage storage.
 * Only stores the fields needed to reconstruct the smart account.
 */
interface StoredCredential {
  id: string;
  publicKey: `0x${string}`;
}

/**
 * Store passkey credential in localStorage.
 * Only stores id and publicKey (raw cannot be serialized).
 */
export function setStoredCredential(credential: P256Credential): void {
  const storedData: StoredCredential = {
    id: credential.id,
    publicKey: credential.publicKey,
  };
  localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(storedData));
}

/**
 * Get stored credential from localStorage.
 * Returns a P256Credential-compatible object (without raw).
 */
export function getStoredCredential(): P256Credential | null {
  const stored = localStorage.getItem(CREDENTIAL_STORAGE_KEY);
  if (!stored) return null;

  try {
    const data = JSON.parse(stored) as StoredCredential;
    // Return as P256Credential (raw is undefined, which is fine for smart account creation)
    return {
      id: data.id,
      publicKey: data.publicKey,
      raw: undefined as unknown as PublicKeyCredential,
    };
  } catch {
    console.warn("[Session] Failed to parse stored credential, clearing...");
    localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
    return null;
  }
}

/**
 * Check if there's a stored credential.
 */
export function hasStoredCredential(): boolean {
  return localStorage.getItem(CREDENTIAL_STORAGE_KEY) !== null;
}

/**
 * Clear stored credential.
 */
export function clearStoredCredential(): void {
  localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
}

// ============================================================================
// LEGACY EXPORTS (kept for backward compatibility)
// ============================================================================

/** @deprecated Use CREDENTIAL_STORAGE_KEY instead */
export const PASSKEY_STORAGE_KEY = "greengoods_passkey_credential";

/** @deprecated Use hasStoredCredential instead */
export function hasStoredPasskey(): boolean {
  return hasStoredCredential() || hasStoredUsername();
}

/** @deprecated Use clearStoredCredential instead */
export function clearStoredPasskey(): void {
  clearStoredCredential();
}
