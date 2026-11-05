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

export const LEGACY_PASSKEY_PROFILE = "kernel-0.3.1-legacy" as const;
export const KERNEL_033_PASSKEY_PROFILE = "kernel-0.3.3" as const;
/** Older clients must not interpret a 0.3.3 credential with their fixed 0.3.1 recipe. */
export const PASSKEY_ACCOUNT_PROFILE_VERSION = 1;
export type PasskeyDirectoryAccountProfile =
  | typeof LEGACY_PASSKEY_PROFILE
  | typeof KERNEL_033_PASSKEY_PROFILE;

/** Defaults apply only at creation; an account's recorded recipe never follows its current site. */
export function getDefaultPasskeyRegistrationProfile(
  hostname: string
): PasskeyDirectoryAccountProfile {
  return ["beta.greengoods.app", "beta.admin.greengoods.app"].includes(hostname.toLowerCase())
    ? KERNEL_033_PASSKEY_PROFILE
    : LEGACY_PASSKEY_PROFILE;
}

export function parsePasskeyDirectoryAccountProfile(
  value: unknown
): PasskeyDirectoryAccountProfile {
  if (value === undefined || value === LEGACY_PASSKEY_PROFILE) return LEGACY_PASSKEY_PROFILE;
  if (value === KERNEL_033_PASSKEY_PROFILE) return value;
  throw new Error("Unknown passkey account profile");
}

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
  /** Missing on older directory records, which always used Kernel 0.3.1. */
  accountProfile?: PasskeyDirectoryAccountProfile;
  /**
   * The ID the account was made with. Kernel hashes this exact string into the account address,
   * so it is never re-encoded: base64url for a directory sign-up, possibly hex for an adopted
   * hosted account.
   */
  id: string;
  /**
   * The browser's credential ID, base64url without padding. It names the bytes the ceremony
   * asks for; without it, both readings of `id` are tried.
   */
  signingId?: string;
  /** Uncompressed P-256 public key as hex, with the 0x04 point prefix. */
  publicKey: `0x${string}`;
  /** The domain the passkey was created under. A browser offers it only for this domain. */
  rpId: string;
};
