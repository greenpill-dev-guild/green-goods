/**
 * Authentication Session Utilities
 *
 * Minimal session management for Pimlico passkey server integration.
 *
 * Storage keys:
 * - AUTH_MODE_STORAGE_KEY: Which auth method is active ("passkey" | "wallet")
 * - USERNAME_STORAGE_KEY: Pimlico passkey server username (for session restore)
 *
 * Note: Passkey credentials are stored on Pimlico's server, not localStorage.
 * Only the username is stored locally to know which credentials to fetch.
 */

// ============================================================================
// STORAGE KEYS
// ============================================================================

/** Active auth mode */
export const AUTH_MODE_STORAGE_KEY = "greengoods_auth_mode";

/** Username for Pimlico passkey server (only thing stored locally for passkey auth) */
export const USERNAME_STORAGE_KEY = "greengoods_username";

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
 * Clear all auth storage including username and RP ID.
 *
 * WARNING: This removes the username permanently.
 * For regular logout, use clearAuthMode() instead to keep the username.
 * Only use this for complete account deletion.
 */
export function clearAllAuth(): void {
  localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
  localStorage.removeItem(USERNAME_STORAGE_KEY);
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
// LEGACY EXPORTS (kept for backward compatibility during migration)
// ============================================================================

/** @deprecated Legacy key - credentials now stored on Pimlico server */
export const PASSKEY_STORAGE_KEY = "greengoods_passkey_credential";

/** @deprecated Use hasStoredUsername instead */
export function hasStoredPasskey(): boolean {
  // Check for username (new flow) OR old credential (migration)
  return Boolean(
    localStorage.getItem(USERNAME_STORAGE_KEY) || localStorage.getItem(PASSKEY_STORAGE_KEY)
  );
}

/** @deprecated Clear legacy credential if present */
export function clearStoredPasskey(): void {
  localStorage.removeItem(PASSKEY_STORAGE_KEY);
}
