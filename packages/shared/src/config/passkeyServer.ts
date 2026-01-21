/**
 * Client-Only Passkey Utilities
 *
 * Simple WebAuthn credential creation without server-side storage.
 * Credentials are stored in localStorage for session persistence.
 *
 * Reference: https://docs.pimlico.io/docs/how-tos/signers/passkey
 */

import { createWebAuthnCredential, type P256Credential } from "viem/account-abstraction";
import { setStoredCredential, setStoredRpId } from "../modules/auth/session";

// ============================================================================
// RP ID CONFIGURATION
// ============================================================================

/**
 * Fixed RP ID for passkey operations.
 *
 * CRITICAL FOR ANDROID: The RP ID MUST be identical between registration and
 * authentication. Android's Credential Manager is very strict about this.
 *
 * Using the apex domain (greengoods.app) allows passkeys to work on:
 * - greengoods.app
 * - www.greengoods.app
 * - Any subdomain of greengoods.app
 */
export const PASSKEY_RP_ID = "greengoods.app";
export const PASSKEY_RP_NAME = "Green Goods";

/**
 * Get the RP ID for passkey operations.
 * Uses hardcoded production domain for consistency.
 * Falls back to hostname only in development when on localhost.
 */
export function getPasskeyRpId(): string {
  // Allow override via env var for development/staging
  const envRpId = import.meta.env.VITE_PASSKEY_RP_ID;
  if (envRpId) {
    return envRpId;
  }

  // In development on localhost, use hostname to allow local testing
  // Note: Passkeys created on localhost won't work in production
  if (import.meta.env.DEV && window.location.hostname === "localhost") {
    console.warn(
      "[Passkey] Using localhost as RP ID. Passkeys created here will NOT work in production."
    );
    return "localhost";
  }

  // Default to production domain
  return PASSKEY_RP_ID;
}

// ============================================================================
// CLIENT-ONLY CREDENTIAL CREATION
// ============================================================================

/**
 * Create a passkey credential (client-only, no server).
 *
 * This is a simplified approach that:
 * 1. Creates WebAuthn credential via browser API
 * 2. Stores credential in localStorage
 * 3. Stores RP ID for consistency on future authentications
 *
 * @param userName - Display name for the credential
 * @returns P256Credential for smart account creation
 */
export async function createPasskey(userName: string): Promise<P256Credential> {
  const rpId = getPasskeyRpId();

  console.debug(
    "[Passkey] Creating credential - RP ID:",
    rpId,
    "| Origin:",
    window.location.origin
  );

  // Create WebAuthn credential using viem's helper
  const credential = await createWebAuthnCredential({
    name: userName,
    rp: {
      id: rpId,
      name: PASSKEY_RP_NAME,
    },
  });

  // Store credential in localStorage for session persistence
  setStoredCredential(credential);

  // Store RP ID for future authentications
  setStoredRpId(rpId);

  console.debug("[Passkey] Credential created - ID:", credential.id.substring(0, 16) + "...");

  return credential;
}

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

/**
 * Check if passkeys are available on this device/browser.
 * Uses the Web Authentication API availability check.
 */
export async function isPasskeyAvailable(): Promise<boolean> {
  try {
    // Check if WebAuthn is supported
    if (!window.PublicKeyCredential) {
      return false;
    }

    // Check if platform authenticator (biometric/device) is available
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }

    // Fallback: assume available if WebAuthn exists
    return true;
  } catch {
    return false;
  }
}
