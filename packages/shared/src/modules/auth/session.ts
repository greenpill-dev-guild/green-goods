/**
 * Authentication Session Utilities
 *
 * Browser session storage for passkey and wallet authentication.
 *
 * Storage keys:
 * - AUTH_MODE_STORAGE_KEY: Which auth method is active ("passkey" | "wallet")
 * - USERNAME_STORAGE_KEY: User's display name
 * - CREDENTIAL_STORAGE_KEY: Passkey credential (id + publicKey)
 * - SMART_ACCOUNT_ADDRESS_STORAGE_KEY: Expected passkey smart-account address
 *
 * Credential metadata is stored locally for session restoration. Server selection
 * and legacy-account lookup are owned by config/passkeyServer.ts and the auth
 * workflows; local session storage does not replace the passkey directory.
 * Reference: https://docs.pimlico.io/guides/how-to/signers/passkey
 */

import type { Address, Hex } from "viem";

import type { AuthMode } from "../../types/auth";
import { logger } from "../app/logger";

import { CREDENTIAL_STORAGE_KEY } from "./passkey-credential-storage";

export {
  getPasskeyRequestIds,
  matchesBrowserId,
  setStoredCredential,
  getStoredCredential,
  hasStoredCredential,
  clearStoredCredential,
  type PasskeyCredential,
} from "./passkey-credential-storage";

import {
  ACCOUNT_PROFILE_STORAGE_KEY,
  PROFILE_ACCOUNTS_STORAGE_KEY,
  asHexAddress,
  clearStoredAccountProfiles,
} from "./passkey-profile-storage";

export {
  getStoredAccountProfile,
  setStoredAccountProfile,
  getStoredProfileAddress,
  setStoredProfileAddress,
  getStoredOriginalAccountAddress,
  asHexAddress,
} from "./passkey-profile-storage";

export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// STORAGE KEYS

/** Active auth mode */
export const AUTH_MODE_STORAGE_KEY = "greengoods_auth_mode";

/** Username for display */
export const USERNAME_STORAGE_KEY = "greengoods_username";

/** RP ID used during passkey registration (for cross-device consistency) */
export const RP_ID_STORAGE_KEY = "greengoods_rp_id";

/** Expected smart-account address rebuilt from the active passkey credential */
export const SMART_ACCOUNT_ADDRESS_STORAGE_KEY = "greengoods_smart_account_address";

// AUTH MODE

export type { AuthMode } from "../../types/auth";

/** Get the active auth mode */
export function getAuthMode(storage: SessionStorage = localStorage): AuthMode {
  return storage.getItem(AUTH_MODE_STORAGE_KEY) as AuthMode;
}

/** Set the active auth mode */
export function setAuthMode(
  mode: Exclude<AuthMode, null>,
  storage: SessionStorage = localStorage
): void {
  storage.setItem(AUTH_MODE_STORAGE_KEY, mode);
}

/** Clear the auth mode (on sign out) */
export function clearAuthMode(storage: SessionStorage = localStorage): void {
  storage.removeItem(AUTH_MODE_STORAGE_KEY);
}

// SIGNED-OUT SENTINEL (explicit sign-out durability)

/**
 * Sentinel written by explicit sign-out.
 *
 * Sign-out intentionally keeps the passkey recovery metadata (credential,
 * username, expected address) as the same-device cache, but session restore
 * also rehydrates passkey sessions when no auth mode is stored. Without this
 * sentinel a refresh after explicit sign-out would silently re-authenticate
 * the prior passkey account — defeating sign-out on shared devices.
 *
 * Lifecycle: set by explicit sign-out; cleared only by a successful passkey
 * session creation (not by sign-in intent — a dismissed ceremony must leave
 * the device signed out).
 */
export const SIGNED_OUT_STORAGE_KEY = "greengoods_signed_out";

/** Mark that the user explicitly signed out; suppresses automatic restore. */
export function setSignedOutSentinel(storage: SessionStorage = localStorage): void {
  storage.setItem(SIGNED_OUT_STORAGE_KEY, "true");
}

/** Re-enable automatic session restore (successful sign-in opts back in). */
export function clearSignedOutSentinel(storage: SessionStorage = localStorage): void {
  storage.removeItem(SIGNED_OUT_STORAGE_KEY);
}

/** Whether the user explicitly signed out and has not signed back in. */
export function hasSignedOutSentinel(storage: SessionStorage = localStorage): boolean {
  return storage.getItem(SIGNED_OUT_STORAGE_KEY) === "true";
}

// USERNAME (Pimlico Server)

/** Get stored username for Pimlico passkey server */
export function getStoredUsername(storage: SessionStorage = localStorage): string | null {
  return storage.getItem(USERNAME_STORAGE_KEY);
}

/** Store username for Pimlico passkey server */
export function setStoredUsername(username: string, storage: SessionStorage = localStorage): void {
  storage.setItem(USERNAME_STORAGE_KEY, username);
}

/** Clear stored username */
export function clearStoredUsername(storage: SessionStorage = localStorage): void {
  storage.removeItem(USERNAME_STORAGE_KEY);
}

/** Check if there's a stored username (indicates existing account) */
export function hasStoredUsername(storage: SessionStorage = localStorage): boolean {
  return Boolean(storage.getItem(USERNAME_STORAGE_KEY));
}

// RP ID (for Android passkey compatibility)

/** Store RP ID used during registration */
export function setStoredRpId(rpId: string, storage: SessionStorage = localStorage): void {
  storage.setItem(RP_ID_STORAGE_KEY, rpId);
}

/** Get the RP ID used for the active passkey credential. */
export function getStoredRpId(storage: SessionStorage = localStorage): string | null {
  return storage.getItem(RP_ID_STORAGE_KEY);
}

/** Clear stored RP ID */
export function clearStoredRpId(storage: SessionStorage = localStorage): void {
  storage.removeItem(RP_ID_STORAGE_KEY);
}

// SMART ACCOUNT ADDRESS (account continuity)

/** Store the expected smart-account address for passkey account continuity. */
export function setStoredSmartAccountAddress(
  address: Address,
  storage: SessionStorage = localStorage
): void {
  storage.setItem(SMART_ACCOUNT_ADDRESS_STORAGE_KEY, address);
}

/** Get the expected smart-account address for passkey account continuity. */
export function getStoredSmartAccountAddress(
  storage: SessionStorage = localStorage
): Address | null {
  return storage.getItem(SMART_ACCOUNT_ADDRESS_STORAGE_KEY) as Address | null;
}

/** Clear the expected smart-account address. */
export function clearStoredSmartAccountAddress(storage: SessionStorage = localStorage): void {
  storage.removeItem(SMART_ACCOUNT_ADDRESS_STORAGE_KEY);
}

// EMBEDDED WALLET ADDRESS

/** Storage key for embedded wallet address (for offline identity display) */
export const EMBEDDED_ADDRESS_KEY = "greengoods_embedded_address";

/** Last wallet address used as the primary app identity. */
export const WALLET_ADDRESS_STORAGE_KEY = "greengoods_wallet_address";

const WAGMI_STORE_KEY = "wagmi.store";

function readWagmiWalletAddress(storage: SessionStorage): Hex | null {
  try {
    const persisted = JSON.parse(storage.getItem(WAGMI_STORE_KEY) ?? "null") as {
      state?: {
        current?: unknown;
        connections?: { value?: unknown };
      };
    } | null;
    const entries = persisted?.state?.connections?.value;
    if (!Array.isArray(entries)) return null;
    const current = persisted?.state?.current;
    const connection =
      entries.find((entry) => Array.isArray(entry) && entry[0] === current) ?? entries[0];
    if (!Array.isArray(connection)) return null;
    const accounts = (connection[1] as { accounts?: unknown } | undefined)?.accounts;
    return Array.isArray(accounts) ? asHexAddress(accounts[0]) : null;
  } catch {
    return null;
  }
}

/** Store the primary wallet identity for offline read access. */
export function setStoredWalletAddress(
  address: Address,
  storage: SessionStorage = localStorage
): void {
  storage.setItem(WALLET_ADDRESS_STORAGE_KEY, address);
}

/**
 * Read the primary wallet identity without contacting its connector. Older
 * installs migrate the same address from Wagmi's persisted connection record.
 */
export function getStoredWalletAddress(storage: SessionStorage = localStorage): Hex | null {
  const stored = asHexAddress(storage.getItem(WALLET_ADDRESS_STORAGE_KEY));
  if (stored) return stored;
  const migrated = readWagmiWalletAddress(storage);
  if (migrated) storage.setItem(WALLET_ADDRESS_STORAGE_KEY, migrated);
  return migrated;
}

/** Clear the cached primary wallet identity on an explicit session boundary. */
export function clearStoredWalletAddress(storage: SessionStorage = localStorage): void {
  storage.removeItem(WALLET_ADDRESS_STORAGE_KEY);
}

/**
 * The last account signed in on this device, in lower case. It outlives
 * sign-out on purpose, so the next account can be told apart from it
 * (`useIdentityChangeReset`).
 */
const LAST_ACCOUNT_STORAGE_KEY = "greengoods_last_account";

export function getLastAccount(storage: SessionStorage = localStorage): Hex | null {
  return asHexAddress(storage.getItem(LAST_ACCOUNT_STORAGE_KEY));
}

export function setLastAccount(address: Hex, storage: SessionStorage = localStorage): void {
  storage.setItem(LAST_ACCOUNT_STORAGE_KEY, address.toLowerCase());
}

/** Store embedded wallet address in localStorage */
export function setEmbeddedAddress(address: Address, storage: SessionStorage = localStorage): void {
  storage.setItem(EMBEDDED_ADDRESS_KEY, address);
}

/** Get stored embedded wallet address */
export function getEmbeddedAddress(storage: SessionStorage = localStorage): Address | null {
  return storage.getItem(EMBEDDED_ADDRESS_KEY) as Address | null;
}

/** Clear stored embedded wallet address */
export function clearEmbeddedAddress(storage: SessionStorage = localStorage): void {
  storage.removeItem(EMBEDDED_ADDRESS_KEY);
}

/**
 * Clear only the active auth session while preserving passkey recovery metadata.
 *
 * This is used for explicit logout-style boundaries where the app should not
 * silently restore a session, but the same-device credential cache should still
 * support the next user-initiated passkey login.
 */
export function clearActiveSessionAuth(storage: SessionStorage = localStorage): void {
  clearAuthMode(storage);
  clearEmbeddedAddress(storage);
  clearStoredWalletAddress(storage);
  setSignedOutSentinel(storage);
}

// SIGN OUT

/**
 * Clear all auth storage including credential, username, and RP ID.
 *
 * WARNING: This removes the credential permanently.
 * For regular logout, use clearAuthMode() instead to keep the credential.
 * Only use this for complete account deletion.
 */
export function clearAllAuth(storage: SessionStorage = localStorage): void {
  clearStoredAccountProfiles(storage);
  storage.removeItem(AUTH_MODE_STORAGE_KEY);
  storage.removeItem(USERNAME_STORAGE_KEY);
  storage.removeItem(CREDENTIAL_STORAGE_KEY);
  storage.removeItem(RP_ID_STORAGE_KEY);
  storage.removeItem(SMART_ACCOUNT_ADDRESS_STORAGE_KEY);
  storage.removeItem(EMBEDDED_ADDRESS_KEY);
  storage.removeItem(WALLET_ADDRESS_STORAGE_KEY);
  storage.removeItem(SIGNED_OUT_STORAGE_KEY);
}

// DEBUG UTILITIES

function isPasskeyDebugEnabled(): boolean {
  return Boolean(import.meta.env.DEV) || import.meta.env.VITE_DEBUG_MODE === "true";
}

/**
 * Debug function to check passkey configuration.
 * Call this from browser console to diagnose Android passkey issues:
 *   window.__debugPasskey() (in dev mode)
 */
function debugPasskeyConfig(): void {
  if (!isPasskeyDebugEnabled()) return;

  const envRpId = import.meta.env.VITE_PASSKEY_RP_ID;
  const storedRpId = localStorage.getItem(RP_ID_STORAGE_KEY);
  const storedUsername = localStorage.getItem(USERNAME_STORAGE_KEY);
  const storedSmartAccountAddress = localStorage.getItem(SMART_ACCOUNT_ADDRESS_STORAGE_KEY);
  const hostname = window.location.hostname;
  const origin = window.location.origin;

  // Import the hardcoded value for display
  const hardcodedRpId = "greengoods.app";

  // Determine effective RP ID (matching logic in getPasskeyRpId)
  let effectiveRpId = hardcodedRpId;
  if (envRpId) {
    effectiveRpId = envRpId;
  } else if (import.meta.env.DEV && hostname === "localhost") {
    effectiveRpId = "localhost";
  }

  logger.debug("[Passkey Debug] Configuration", {
    hardcodedRpId,
    envRpId: envRpId || "(not set, will use hardcoded)",
    storedRpId: storedRpId || "(not set)",
    hostname,
    origin,
    storedUsername: storedUsername || "(not set)",
    storedSmartAccountAddress: storedSmartAccountAddress ? "(set)" : "(not set)",
    effectiveRpId,
  });

  if (storedRpId && storedRpId !== effectiveRpId) {
    logger.warn("[Passkey Debug] Stored RP ID differs from effective RP ID", {
      storedRpId,
      effectiveRpId,
      hint: "This may cause Android passkey issues.",
    });
  }
}

// Expose debug function globally in development
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as { __debugPasskey?: typeof debugPasskeyConfig }).__debugPasskey = debugPasskeyConfig;
}

/**
 * Only an absence of all session metadata permits a host to defer auth startup.
 * Presence includes malformed/legacy records and explicit sign-out metadata:
 * the normal auth runtime owns their interpretation, migration and recovery.
 * This probe never parses or writes storage, and treats blocked storage as unknown.
 */
export function hasSessionRestoreEvidence(storage?: Pick<SessionStorage, "getItem">): boolean {
  try {
    const readableStorage = storage ?? window.localStorage;
    return [
      AUTH_MODE_STORAGE_KEY,
      CREDENTIAL_STORAGE_KEY,
      USERNAME_STORAGE_KEY,
      RP_ID_STORAGE_KEY,
      SMART_ACCOUNT_ADDRESS_STORAGE_KEY,
      ACCOUNT_PROFILE_STORAGE_KEY,
      PROFILE_ACCOUNTS_STORAGE_KEY,
      EMBEDDED_ADDRESS_KEY,
      WALLET_ADDRESS_STORAGE_KEY,
      LAST_ACCOUNT_STORAGE_KEY,
      WAGMI_STORE_KEY,
      SIGNED_OUT_STORAGE_KEY,
    ].some((key) => readableStorage.getItem(key) !== null);
  } catch {
    return true;
  }
}

/**
 * The storage a local sign-out clears.
 *
 * Auth mode and the addresses a restore would read back go. Passkey recovery
 * metadata stays: the username, credential and expected address are the
 * same-device fallback that powers one-tap re-login. The signed-out sentinel
 * makes it durable, suppressing automatic passkey restore until the next
 * successful passkey sign-in, so a dismissed ceremony stays signed out.
 */
export function clearSessionForSignOut(storage: SessionStorage = localStorage): void {
  clearAuthMode(storage);
  clearEmbeddedAddress(storage);
  clearStoredWalletAddress(storage);
  setSignedOutSentinel(storage);
}
