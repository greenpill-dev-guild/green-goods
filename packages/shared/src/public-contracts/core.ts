// Dependency-light public funding contracts: no UI frameworks, browser globals, or package-root imports.

import type {
  Address,
  FundingDestinationType,
  PublicFundingIntentKind,
  PublicFundingProvider,
  PublicFundingSourceRoute,
  PublicPaymentMethod,
} from "./funding-types";

export * from "./funding-types";

export type PublicFundingAvailabilityState = "live" | "comingSoon" | "hidden" | "disabled";
export type PublicFundingAvailabilityReasonCode =
  | "no_destination"
  | "proof_pending"
  | "provider_unavailable"
  | "chain_unsupported"
  | "token_unsupported"
  | "config_missing"
  | "disabled";

export type PublicFundingAvailabilityKeyInput = {
  gardenKey: string;
  destinationType: FundingDestinationType;
  destinationAddress: Address | string;
  fundingIntent: PublicFundingIntentKind;
  paymentMethod: PublicPaymentMethod;
  chainId: number | string;
  token: Address | string;
  provider: PublicFundingProvider;
  sourceRoute?: PublicFundingSourceRoute;
};

export type PublicFundingAvailability = PublicFundingAvailabilityKeyInput & {
  availabilityKey: string;
  state: PublicFundingAvailabilityState;
  reasonCode?: PublicFundingAvailabilityReasonCode;
  reasonParams?: Record<string, string | number | boolean>;
  minAmount?: string;
  maxAmount?: string;
  requiredProof?: string;
  proofReference?: string;
};

export const PUBLIC_FUNDING_AVAILABILITY_REASON_SEMANTICS = {
  no_destination: {
    allowedStates: ["hidden", "disabled"],
    requiredParams: ["destinationType"],
  },
  proof_pending: {
    allowedStates: ["hidden", "comingSoon"],
    requiredParams: ["provider", "requiredProof"],
  },
  provider_unavailable: {
    allowedStates: ["hidden", "disabled"],
    requiredParams: ["provider"],
  },
  chain_unsupported: {
    allowedStates: ["hidden", "disabled"],
    requiredParams: ["chainId"],
  },
  token_unsupported: {
    allowedStates: ["hidden", "disabled"],
    requiredParams: ["token", "chainId"],
  },
  config_missing: {
    allowedStates: ["hidden", "disabled"],
    requiredParams: ["missingConfig"],
  },
  disabled: {
    allowedStates: ["disabled"],
    requiredParams: [],
  },
} as const satisfies Record<
  PublicFundingAvailabilityReasonCode,
  { allowedStates: readonly PublicFundingAvailabilityState[]; requiredParams: readonly string[] }
>;

export type ProviderProofState = "hidden" | "comingSoon" | "live";
export type ProviderProofEntry = PublicFundingAvailabilityKeyInput & {
  state: ProviderProofState;
  proofReference?: string;
  requiredProof?: string;
  note?: string;
};

export const normalizeAddressLike = (value: string): string => value.trim().toLowerCase();

export function buildPublicFundingAvailabilityKey(
  input: PublicFundingAvailabilityKeyInput
): string {
  const gardenKey = input.gardenKey.trim().toLowerCase();
  const destinationAddress = normalizeAddressLike(input.destinationAddress);
  const chainId = String(input.chainId).trim();
  const token = normalizeAddressLike(input.token);
  if (input.sourceRoute) {
    return [
      "v2",
      input.sourceRoute,
      gardenKey,
      input.destinationType,
      destinationAddress,
      input.fundingIntent,
      input.paymentMethod,
      chainId,
      token,
      input.provider,
    ].join(":");
  }

  return [
    "v1",
    gardenKey,
    input.destinationType,
    destinationAddress,
    input.fundingIntent,
    input.paymentMethod,
    chainId,
    token,
    input.provider,
  ].join(":");
}
