/**
 * Shared Authentication Session Utilities
 *
 * Provides session management functions for both passkey and wallet auth providers.
 * These utilities handle fresh app start detection, sign-out state, and session markers.
 */

/** Session marker to detect reinstalls - sessionStorage clears when app is fully closed */
export const SESSION_MARKER_KEY = "greengoods_active_session";

/** Key to track explicit sign-out - blocks auto-reconnection until explicit login */
export const SIGNED_OUT_KEY = "greengoods_signed_out";

/** Auth mode persistence key */
export const AUTH_MODE_STORAGE_KEY = "greengoods_auth_mode";

/** Passkey credential storage key */
export const PASSKEY_STORAGE_KEY = "greengoods_passkey_credential";

/** Passkey signed out key */
export const PASSKEY_SIGNED_OUT_KEY = "greengoods_passkey_signed_out";

/**
 * Check if this is a fresh app start (after reinstall or cold launch).
 *
 * sessionStorage is cleared when:
 * - PWA is fully closed and reopened
 * - PWA is uninstalled and reinstalled
 * - Browser tab/window is closed
 *
 * @returns true if this is a fresh app start (no active session)
 */
export function isFreshAppStart(): boolean {
  const hasActiveSession = sessionStorage.getItem(SESSION_MARKER_KEY) === "true";
  return !hasActiveSession;
}

/**
 * Mark the current session as active.
 * Should be called once on app initialization.
 */
export function markSessionActive(): void {
  sessionStorage.setItem(SESSION_MARKER_KEY, "true");
}

/**
 * Check if this is a fresh app start and handle accordingly.
 * If detected, clears the auth mode and returns true.
 *
 * @param savedAuthMode - The saved auth mode from localStorage
 * @returns true if this is a fresh start that required clearing auth state
 */
export function checkAndHandleFreshStart(savedAuthMode: string | null): boolean {
  const hasActiveSession = sessionStorage.getItem(SESSION_MARKER_KEY) === "true";

  if (hasActiveSession) {
    return false;
  }

  // Mark session as active for future checks
  markSessionActive();

  // If there was a saved auth mode but no active session, this is a reinstall
  if (savedAuthMode) {
    console.log("[Auth] Detected fresh app start - clearing saved auth state");
    localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
    return true;
  }

  return false;
}

/**
 * Check if user explicitly signed out.
 * This blocks wallet auto-reconnection until they explicitly log in again.
 */
export function wasExplicitlySignedOut(): boolean {
  return sessionStorage.getItem(SIGNED_OUT_KEY) === "true";
}

/**
 * Mark that user explicitly signed out - blocks auto-reconnection.
 */
export function setSignedOut(): void {
  sessionStorage.setItem(SIGNED_OUT_KEY, "true");
}

/**
 * Clear signed-out flag - called on explicit login action.
 */
export function clearSignedOut(): void {
  sessionStorage.removeItem(SIGNED_OUT_KEY);
}

/**
 * Get the saved auth mode from localStorage.
 */
export function getSavedAuthMode(): "passkey" | "wallet" | null {
  return localStorage.getItem(AUTH_MODE_STORAGE_KEY) as "passkey" | "wallet" | null;
}

/**
 * Save the auth mode to localStorage.
 */
export function saveAuthMode(mode: "passkey" | "wallet"): void {
  localStorage.setItem(AUTH_MODE_STORAGE_KEY, mode);
}

/**
 * Clear the saved auth mode.
 */
export function clearAuthMode(): void {
  localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
}

/**
 * Check if there's a stored passkey credential.
 */
export function hasStoredPasskeyCredential(): boolean {
  return !!localStorage.getItem(PASSKEY_STORAGE_KEY);
}

/**
 * Check if passkey was explicitly signed out.
 */
export function wasPasskeySignedOut(): boolean {
  return localStorage.getItem(PASSKEY_SIGNED_OUT_KEY) === "true";
}

/**
 * Mark passkey as signed out.
 */
export function setPasskeySignedOut(): void {
  localStorage.setItem(PASSKEY_SIGNED_OUT_KEY, "true");
}

/**
 * Clear passkey signed out state.
 */
export function clearPasskeySignedOut(): void {
  localStorage.removeItem(PASSKEY_SIGNED_OUT_KEY);
}

/**
 * Clear all auth-related storage.
 * Use with caution - this will log out the user completely.
 */
export function clearAllAuthStorage(): void {
  localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
  localStorage.removeItem(PASSKEY_STORAGE_KEY);
  localStorage.removeItem(PASSKEY_SIGNED_OUT_KEY);
  sessionStorage.removeItem(SIGNED_OUT_KEY);
  // Don't clear SESSION_MARKER_KEY as that would trigger fresh start detection
}
