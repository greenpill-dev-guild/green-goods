/**
 * Client-Only Passkey Utilities
 *
 * Simple WebAuthn credential creation without server-side storage.
 * Credentials are stored in localStorage for session persistence.
 *
 * Reference: https://docs.pimlico.io/docs/how-tos/signers/passkey
 */

import { createPasskeyServerClient as createPermissionlessPasskeyServerClient } from "permissionless/clients/passkeyServer";
import { http } from "viem";
import { createWebAuthnCredential, type P256Credential } from "viem/account-abstraction";
import { logger } from "../modules/app/logger";
import { setStoredCredential, setStoredRpId } from "../modules/auth/session";
import { getPimlicoBundlerUrl } from "./pimlico";

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

type PasskeyServerEnv = {
  DEV?: boolean;
  PROD?: boolean;
  VITE_PASSKEY_SERVER_ENABLED?: string;
  VITE_PASSKEY_RP_ID?: string;
};

export function isPasskeyServerEnabled(env: PasskeyServerEnv = import.meta.env): boolean {
  return env.VITE_PASSKEY_SERVER_ENABLED === "true";
}

export type PasskeyRecoveryContext = {
  username: string;
};

export function normalizePasskeyAccountIdentifier(identifier: string): string {
  return identifier.trim().replace(/^@+/, "").toLowerCase();
}

export function buildPasskeyRecoveryContext(identifier: string): PasskeyRecoveryContext {
  const username = normalizePasskeyAccountIdentifier(identifier);
  if (username.length < 3) {
    throw new Error("Username is required for passkey recovery");
  }
  return { username };
}

export function createPasskeyServerClient(chainId: number) {
  return createPermissionlessPasskeyServerClient({
    transport: http(getPimlicoBundlerUrl(chainId)),
  });
}

export type PasskeyCeremonyBlockReason =
  | "no_browser_context"
  | "non_https_origin"
  | "preview_or_localhost_production"
  | "rp_origin_mismatch";

export type PasskeyCeremonyContextStatus =
  | {
      supported: true;
      rpId: string;
      origin: string;
    }
  | {
      supported: false;
      reason: PasskeyCeremonyBlockReason;
      rpId: string;
      origin: string;
    };

type PasskeyCeremonyContextOptions = {
  env?: PasskeyServerEnv;
  location?: Pick<Location, "hostname" | "origin" | "protocol">;
};

export function classifyPasskeyCeremonyContext(
  options: PasskeyCeremonyContextOptions = {}
): PasskeyCeremonyContextStatus {
  const env = options.env ?? import.meta.env;
  const location =
    options.location ?? (typeof window !== "undefined" ? window.location : undefined);
  const rpId = getPasskeyRpId(env, location);

  if (!location) {
    return {
      supported: false,
      reason: "no_browser_context",
      rpId,
      origin: "",
    };
  }

  const hostname = location.hostname;
  const origin = location.origin;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isHttps = location.protocol === "https:" || (Boolean(env.DEV) && isLocalhost);

  if (!isHttps) {
    return {
      supported: false,
      reason: "non_https_origin",
      rpId,
      origin,
    };
  }

  if (Boolean(env.PROD) && (isLocalhost || hostname.endsWith(".vercel.app"))) {
    return {
      supported: false,
      reason: "preview_or_localhost_production",
      rpId,
      origin,
    };
  }

  const matchesRpId = hostname === rpId || (!isLocalhost && hostname.endsWith(`.${rpId}`));
  if (!matchesRpId) {
    return {
      supported: false,
      reason: "rp_origin_mismatch",
      rpId,
      origin,
    };
  }

  return {
    supported: true,
    rpId,
    origin,
  };
}

/**
 * Get the RP ID for passkey operations.
 * Uses hardcoded production domain for consistency.
 * Falls back to hostname only in development when on localhost.
 */
export function getPasskeyRpId(
  env: PasskeyServerEnv = import.meta.env,
  location?: Pick<Location, "hostname">
): string {
  // Allow override via env var for development/staging
  const envRpId = env.VITE_PASSKEY_RP_ID?.trim().toLowerCase();
  if (envRpId) {
    return envRpId;
  }

  const hostname =
    location?.hostname ?? (typeof window !== "undefined" ? window.location.hostname : undefined);

  // In development on localhost, use hostname to allow local testing
  // Note: Passkeys created on localhost won't work in production
  if (env.DEV && (hostname === "localhost" || hostname === "127.0.0.1")) {
    logger.warn(
      "[Passkey] Using local development host as RP ID. Passkeys created here will NOT work in production.",
      { hostname }
    );
    return hostname;
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

  logger.debug("[Passkey] Creating credential", { rpId, origin: window.location.origin });

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

  logger.debug("[Passkey] Credential created", { id: credential.id.substring(0, 16) });

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
