import type { Address, Hex } from "viem";
import type { SessionStorage } from "./session";
import { getStoredCredential, type PasskeyCredential } from "./passkey-credential-storage";
import {
  assertPasskeyAccountProfile,
  getPilotCredentialId,
  LEGACY_PASSKEY_PROFILE,
  PILOT_PASSKEY_PROFILE,
  type PasskeyAccountProfileId,
} from "./account-profile";

/** Narrow a stored value to a hex address; anything else reads as absent. */
export function asHexAddress(value: unknown): Hex | null {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as Hex) : null;
}

export const ACCOUNT_PROFILE_STORAGE_KEY = "greengoods_passkey_account_profile";
export const PROFILE_ACCOUNTS_STORAGE_KEY = "greengoods_passkey_profile_accounts";

export function getStoredAccountProfile(
  storage: SessionStorage = localStorage
): PasskeyAccountProfileId {
  const value = storage.getItem(ACCOUNT_PROFILE_STORAGE_KEY);
  if (value === null) return LEGACY_PASSKEY_PROFILE;
  assertPasskeyAccountProfile(value);
  return value;
}

export function setStoredAccountProfile(
  profile: PasskeyAccountProfileId,
  storage: SessionStorage = localStorage
): void {
  assertPasskeyAccountProfile(profile);
  storage.setItem(ACCOUNT_PROFILE_STORAGE_KEY, profile);
}

type ProfileAccount = {
  profile: PasskeyAccountProfileId;
  credentialId: string;
  publicKey: Hex;
  address: Address;
  rpId: string;
  userName: string;
};

function profileAccountKey(
  profile: PasskeyAccountProfileId,
  credential: PasskeyCredential
): string {
  assertPasskeyAccountProfile(profile);
  const id = profile === PILOT_PASSKEY_PROFILE ? getPilotCredentialId(credential) : credential.id;
  return `${profile}:${credential.publicKey.toLowerCase()}:${id}`;
}

function readProfileAccounts(storage: SessionStorage): Record<string, ProfileAccount> {
  const stored = storage.getItem(PROFILE_ACCOUNTS_STORAGE_KEY);
  if (stored === null) return {};
  const parsed: unknown = JSON.parse(stored);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid saved passkey account profiles");
  }
  return parsed as Record<string, ProfileAccount>;
}

export function getStoredProfileAddress(
  profile: PasskeyAccountProfileId,
  credential: PasskeyCredential,
  storage: SessionStorage = localStorage
): Hex | null {
  const key = profileAccountKey(profile, credential);
  const record = readProfileAccounts(storage)[key];
  if (record === undefined) return null;
  if (
    record.profile !== profile ||
    !asHexAddress(record.address) ||
    typeof record.publicKey !== "string" ||
    record.publicKey.toLowerCase() !== credential.publicKey.toLowerCase() ||
    profileAccountKey(profile, {
      ...credential,
      id: record.credentialId,
      signingId: profile === PILOT_PASSKEY_PROFILE ? record.credentialId : credential.signingId,
    }) !== key
  ) {
    throw new Error("Invalid saved passkey account profile");
  }
  return asHexAddress(record.address);
}

/** An explicit sign-in can reopen the archived identity without rewriting the pilot profile. */
export function getStoredOriginalAccountAddress(
  storage: SessionStorage = localStorage
): Hex | null {
  if (getStoredAccountProfile(storage) !== PILOT_PASSKEY_PROFILE) return null;
  const credential = getStoredCredential(storage);
  return credential ? getStoredProfileAddress(LEGACY_PASSKEY_PROFILE, credential, storage) : null;
}

/** Keep prior identities as public recovery metadata; no balances, roles or history are moved. */
export function setStoredProfileAddress(
  profile: PasskeyAccountProfileId,
  credential: PasskeyCredential,
  address: Address,
  rpId: string,
  userName: string,
  storage: SessionStorage = localStorage
): void {
  if (!asHexAddress(address)) throw new Error("Invalid passkey account address");
  const records = readProfileAccounts(storage);
  records[profileAccountKey(profile, credential)] = {
    profile,
    credentialId:
      profile === PILOT_PASSKEY_PROFILE ? getPilotCredentialId(credential) : credential.id,
    publicKey: credential.publicKey,
    address,
    rpId,
    userName,
  };
  storage.setItem(PROFILE_ACCOUNTS_STORAGE_KEY, JSON.stringify(records));
}

export function clearStoredAccountProfiles(storage: SessionStorage = localStorage): void {
  storage.removeItem(ACCOUNT_PROFILE_STORAGE_KEY);
  storage.removeItem(PROFILE_ACCOUNTS_STORAGE_KEY);
}
