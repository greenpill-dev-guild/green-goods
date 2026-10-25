import type { P256Credential } from "viem/account-abstraction";
import { logger } from "../app/logger";
import type { SessionStorage } from "./session";

/** Canonical credential record; profile and active-session state remain separate. */
export const CREDENTIAL_STORAGE_KEY = "greengoods_credential";

// CREDENTIAL STORAGE (Client-Only)

/**
 * Serializable credential data for localStorage storage.
 * Only stores the fields needed to reconstruct the smart account.
 */
export type PasskeyCredential = P256Credential & {
  /** Browser credential ID, always base64url. `id` remains the Kernel identity input. */
  signingId?: string;
};

interface StoredCredential {
  version: 3;
  id: string;
  publicKey: `0x${string}`;
  signingId: string | null;
}

/** Unknown legacy IDs may be hex or base64url; offer both without changing account identity. */
export function getPasskeyRequestIds(
  credential: Pick<PasskeyCredential, "id" | "signingId">
): ArrayBuffer[] {
  const id = credential.signingId ?? credential.id;
  const base64 = id.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const ids: ArrayBuffer[] = [decoded.buffer];
  const hex = id.replace(/^0x/, "");
  if (!credential.signingId && hex.length > 0 && hex.length % 2 === 0 && /^[\da-f]+$/i.test(hex)) {
    ids.unshift(Uint8Array.from(hex.match(/.{2}/g)!, (byte) => parseInt(byte, 16)).buffer);
  }
  return ids;
}

/**
 * Whether a stored credential is the one the browser just used. Stored IDs come in more than one
 * encoding, so the comparison is made on the bytes each of them stands for.
 */
export function matchesBrowserId(
  credential: Pick<PasskeyCredential, "id" | "signingId">,
  browserId: string
): boolean {
  try {
    const browserBytes = new Uint8Array(
      getPasskeyRequestIds({ id: browserId, signingId: browserId })[0]
    );
    return getPasskeyRequestIds(credential).some((id) => {
      const bytes = new Uint8Array(id);
      return (
        bytes.length === browserBytes.length &&
        bytes.every((byte, index) => byte === browserBytes[index])
      );
    });
  } catch {
    return false;
  }
}

/**
 * Store passkey credential in localStorage.
 * Keeps account identity separate from the browser ID used for signing.
 */
export function setStoredCredential(
  credential: PasskeyCredential,
  storage: SessionStorage = localStorage
): void {
  const storedData: StoredCredential = {
    version: 3,
    id: credential.id,
    publicKey: credential.publicKey,
    signingId: credential.signingId ?? credential.raw?.id ?? null,
  };
  storage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(storedData));
}

/**
 * Get stored credential from localStorage.
 * Returns a P256Credential-compatible object (without raw).
 */
export function getStoredCredential(
  storage: SessionStorage = localStorage
): PasskeyCredential | null {
  const stored = storage.getItem(CREDENTIAL_STORAGE_KEY);
  if (!stored) return null;

  try {
    const data = JSON.parse(stored) as {
      version?: unknown;
      idEncoding?: unknown;
      id?: unknown;
      publicKey?: unknown;
      signingId?: unknown;
    } | null;
    if (!data || typeof data.id !== "string" || !data.id || typeof data.publicKey !== "string") {
      throw new Error("Stored passkey credential is incomplete");
    }

    if (data.version === 2 && data.idEncoding !== "base64url") return null;
    if (data.version !== undefined && data.version !== 2 && data.version !== 3) return null;
    if (
      data.version === 3 &&
      data.signingId !== null &&
      (typeof data.signingId !== "string" || !data.signingId)
    )
      return null;

    const credential: PasskeyCredential = {
      id: data.id,
      publicKey: data.publicKey as `0x${string}`,
      raw: undefined as unknown as PublicKeyCredential,
      ...(data.version === 2
        ? { signingId: data.id }
        : data.version === 3 && typeof data.signingId === "string"
          ? { signingId: data.signingId }
          : {}),
    };
    if (data.version !== 3) setStoredCredential(credential, storage);
    return credential;
  } catch {
    logger.warn("[Session] Failed to parse stored credential, clearing...");
    storage.removeItem(CREDENTIAL_STORAGE_KEY);
    return null;
  }
}

/**
 * Check if there's a stored credential.
 */
export function hasStoredCredential(storage: SessionStorage = localStorage): boolean {
  return storage.getItem(CREDENTIAL_STORAGE_KEY) !== null;
}

/**
 * Clear stored credential.
 */
export function clearStoredCredential(storage: SessionStorage = localStorage): void {
  storage.removeItem(CREDENTIAL_STORAGE_KEY);
}
