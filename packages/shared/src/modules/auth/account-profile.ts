import type { Address } from "../../types/domain";
import type { PasskeyCredential } from "./session";

export const LEGACY_PASSKEY_PROFILE = "kernel-0.3.1-legacy" as const;
export const PILOT_PASSKEY_PROFILE = "kernel-0.3.3-pilot" as const;
export type PasskeyAccountProfileId = typeof LEGACY_PASSKEY_PROFILE | typeof PILOT_PASSKEY_PROFILE;

/** Deployment identity is independent of credential serialization and browser session state. */
export function assertPasskeyAccountProfile(
  value: unknown
): asserts value is PasskeyAccountProfileId {
  if (value !== LEGACY_PASSKEY_PROFILE && value !== PILOT_PASSKEY_PROFILE) {
    throw new Error("Unknown passkey account profile");
  }
}

export function getPasskeyAccountRecipe(profile: PasskeyAccountProfileId, chainId: number) {
  assertPasskeyAccountProfile(profile);
  if (profile === PILOT_PASSKEY_PROFILE) {
    if (![42161, 42220, 100].includes(chainId)) {
      throw new Error(`Pilot passkey accounts are unavailable on chain ${chainId}`);
    }
    return {
      version: "0.3.3" as const,
      index: 0n,
      useMetaFactory: true,
      validatorAddress: "0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69" as Address,
      factoryAddress: "0x2577507b78c2008Ff367261CB6285d44ba5eF2E9" as Address,
      accountLogicAddress: "0xd6CEDDe84be40893d153Be9d467CD6aD37875b28" as Address,
      metaFactoryAddress: "0xd703aaE79538628d27099B8c4f621bE4CCd142d5" as Address,
    };
  }
  if (chainId === 100) throw new Error("Legacy passkey accounts are unavailable on Gnosis");
  if (chainId === 421614 || chainId === 11142220) {
    throw new Error(
      "Evidence-only settlement profiles are unavailable through primary passkey auth"
    );
  }
  return { version: "0.3.1" as const };
}

/** Only a completed ceremony establishes the canonical browser ID for a new pilot identity. */
export function getPilotCredentialId(credential: PasskeyCredential): string {
  const id = credential.signingId;
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error("Sign in with the passkey before selecting the pilot account");
  }
  try {
    const bytes = atob(id.replace(/-/g, "+").replace(/_/g, "/"));
    if (!bytes || btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") !== id) {
      throw new Error("Invalid browser credential ID");
    }
  } catch {
    throw new Error("Sign in with the passkey before selecting the pilot account");
  }
  return id;
}
