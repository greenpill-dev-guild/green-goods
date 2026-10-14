/**
 * Wire contract for the Green Goods passkey directory: the JSON-RPC endpoint on the agent that
 * issues every passkey under one domain, so an account works on every Green Goods site.
 *
 * It answers the registration and lookup calls of the permissionless passkey-server client
 * (`pks_startRegistration`, `pks_verifyRegistration`, `pks_getCredentials`).
 */

/**
 * The one domain Green Goods passkeys belong to. A browser lets every site under it use the
 * same passkey, which is what makes an account portable between them.
 */
export const PASSKEY_RP_ID = "greengoods.app";
/** The name a device shows beside the passkey. */
export const PASSKEY_RP_NAME = "Green Goods";

export const PASSKEY_NAME_MIN_LENGTH = 3;
export const PASSKEY_NAME_MAX_LENGTH = 64;

/**
 * The form in which an account name is stored and compared: trimmed, without a leading "@",
 * lower case. The app and the directory both apply it, so one name cannot be held twice under
 * different spellings.
 */
export function normalizePasskeyName(identifier: string): string {
  return identifier.trim().replace(/^@+/, "").toLowerCase();
}

/** Whether a normalized name can be registered in the directory. */
export function isRegistrablePasskeyName(name: string): boolean {
  if (name.length < PASSKEY_NAME_MIN_LENGTH || name.length > PASSKEY_NAME_MAX_LENGTH) return false;
  // Control characters never belong in a name a person has to type again on another device.
  for (const character of name) {
    const code = character.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

export type PasskeyDirectoryCredential = {
  /** Credential ID as the browser reports it, base64url without padding. */
  id: string;
  /** Uncompressed P-256 public key as hex, with the 0x04 point prefix. */
  publicKey: `0x${string}`;
  /** The domain the passkey was created under. A browser offers it only for this domain. */
  rpId: string;
};
