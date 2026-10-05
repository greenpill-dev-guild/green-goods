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
import {
  normalizePasskeyName,
  PASSKEY_RP_ID,
  PASSKEY_RP_NAME,
} from "../public-contracts/passkey-directory";
import { getPimlicoBundlerUrl } from "./pimlico";

// ============================================================================
// RP ID CONFIGURATION
// ============================================================================

/**
 * The domain (RP ID) a passkey is created under decides where it can be used: a browser offers
 * it only for that exact domain, on that domain's own pages and its subdomains. Every later
 * sign-in and signature must name the same domain; Android's Credential Manager is strict
 * about it.
 *
 * `PASSKEY_RP_ID` is the domain every Green Goods site shares. The app chooses it only where it
 * runs the ceremony itself. When a passkey server issues the options, that server names the
 * domain: the Green Goods passkey directory issues the shared domain to every site, while the
 * hosted Pimlico server issues each site its own hostname.
 */
export { PASSKEY_RP_ID, PASSKEY_RP_NAME };

type PasskeyServerEnv = {
  DEV?: boolean;
  PROD?: boolean;
  VITE_PASSKEY_SERVER_ENABLED?: string;
  VITE_PASSKEY_RP_ID?: string;
  VITE_PASSKEY_DIRECTORY_URL?: string;
};

/**
 * The keys this file reads, each by name. Vite pastes the whole env object into the bundle
 * wherever `import.meta.env` is read whole, and inlines one value where a key is named.
 */
function readPasskeyServerEnv(): PasskeyServerEnv {
  return {
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
    VITE_PASSKEY_SERVER_ENABLED: import.meta.env.VITE_PASSKEY_SERVER_ENABLED,
    VITE_PASSKEY_RP_ID: import.meta.env.VITE_PASSKEY_RP_ID,
    VITE_PASSKEY_DIRECTORY_URL: import.meta.env.VITE_PASSKEY_DIRECTORY_URL,
  };
}

export function isPasskeyServerEnabled(env: PasskeyServerEnv = readPasskeyServerEnv()): boolean {
  const configured = env.VITE_PASSKEY_SERVER_ENABLED?.trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;

  return Boolean(env.PROD);
}

export type PasskeyRecoveryContext = {
  userName: string;
};

export function normalizePasskeyAccountIdentifier(identifier: string): string {
  return normalizePasskeyName(identifier);
}

export function buildPasskeyRecoveryContext(identifier: string): PasskeyRecoveryContext {
  const userName = normalizePasskeyAccountIdentifier(identifier);
  if (userName.length < 3) {
    throw new Error("Username is required for passkey recovery");
  }
  return { userName };
}

/** The hosted Pimlico passkey server. It holds the accounts made before the directory. */
export function createPasskeyServerClient(chainId: number) {
  return createPermissionlessPasskeyServerClient({
    transport: http(getPimlicoBundlerUrl(chainId)),
  });
}

/**
 * The Green Goods passkey directory, or nothing while this build still signs people up on the
 * hosted server. `VITE_PASSKEY_DIRECTORY_URL` switches a build to it. The directory speaks the
 * same protocol as the hosted server, so the same client reads both.
 */
export function createPasskeyDirectoryClient(env: PasskeyServerEnv = readPasskeyServerEnv()) {
  const url = env.VITE_PASSKEY_DIRECTORY_URL?.trim();
  return url ? createPermissionlessPasskeyServerClient({ transport: http(url) }) : null;
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
  const env = options.env ?? readPasskeyServerEnv();
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
  env: PasskeyServerEnv = readPasskeyServerEnv(),
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
