import type { Address } from "../../types/domain";

export interface SettlementAccountProfile {
  profileId: "kernel-0.2.4-testnet" | "kernel-0.3.1-mainnet";
  kernelVersion: "0.2.4" | "0.3.1";
  entryPointVersion: "0.7";
  entryPoint: Address;
  factoryProfile: string;
  implementationProfile: string;
  initializerProfile: string;
  passkeyProfile: string;
  saltProfile: string;
  production: boolean;
}

const ENTRY_POINT_V07 = "0x0000000071727de22e5e9d8baf0edac6f37da032" as Address;

const TESTNET_PROFILE: SettlementAccountProfile = {
  profileId: "kernel-0.2.4-testnet",
  kernelVersion: "0.2.4",
  entryPointVersion: "0.7",
  entryPoint: ENTRY_POINT_V07,
  factoryProfile: "kernel-v2.4-factory",
  implementationProfile: "kernel-v2.4-implementation",
  initializerProfile: "kernel-v2.4-passkey-initializer",
  passkeyProfile: "webauthn-owner-v1",
  saltProfile: "green-goods-member-v1",
  production: false,
};

const MAINNET_PROFILE: SettlementAccountProfile = {
  profileId: "kernel-0.3.1-mainnet",
  kernelVersion: "0.3.1",
  entryPointVersion: "0.7",
  entryPoint: ENTRY_POINT_V07,
  factoryProfile: "kernel-v3.1-factory",
  implementationProfile: "kernel-v3.1-implementation",
  initializerProfile: "kernel-v3.1-passkey-initializer",
  passkeyProfile: "webauthn-owner-v1",
  saltProfile: "green-goods-member-v1",
  production: true,
};

const SETTLEMENT_ACCOUNT_PROFILES: Readonly<Record<number, SettlementAccountProfile>> = {
  421614: TESTNET_PROFILE,
  11142220: TESTNET_PROFILE,
  42161: MAINNET_PROFILE,
  42220: MAINNET_PROFILE,
};

export function getSettlementAccountProfile(chainId: number): SettlementAccountProfile | undefined {
  return SETTLEMENT_ACCOUNT_PROFILES[chainId];
}

export function assertMatchingAccountProfile(
  source: SettlementAccountProfile,
  destination: SettlementAccountProfile
): SettlementAccountProfile {
  const fields: ReadonlyArray<keyof SettlementAccountProfile> = [
    "profileId",
    "kernelVersion",
    "entryPointVersion",
    "entryPoint",
    "factoryProfile",
    "implementationProfile",
    "initializerProfile",
    "passkeyProfile",
    "saltProfile",
    "production",
  ];
  if (fields.some((field) => source[field] !== destination[field])) {
    throw new Error("account profile mismatch");
  }
  return source;
}

export function isGardenerDeliveryEnabled(input: {
  chainId: number;
  indexed: boolean | null;
  mainnetEvidenceReady: boolean;
}): boolean {
  const profile = getSettlementAccountProfile(input.chainId);
  return Boolean(
    profile?.production && input.indexed === true && input.mainnetEvidenceReady === true
  );
}
