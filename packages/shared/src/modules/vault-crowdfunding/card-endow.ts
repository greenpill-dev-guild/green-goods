import type { Address } from "../../types/domain";
import {
  addressesMatch,
  hasAddress,
  hasPositiveShareBalance,
  hasText,
  type OctantVaultCampaignManifest,
  validateOctantVaultCardEndowManifest,
} from "./manifest";

export type OctantVaultCardEndowIntentKind = "card_endow";

export type OctantVaultCardProvider = "thirdweb";

export type OctantVaultCardEndowReceiverCustody = "user_owned_recovered_wallet";

export interface OctantVaultCardEndowReceiver {
  intentKind: OctantVaultCardEndowIntentKind;
  paymentMethod: "card";
  receiverKind: "recovered_wallet";
  receiverCustody: OctantVaultCardEndowReceiverCustody;
  receiverAddress: Address;
}

export interface OctantVaultCardEndowReceiverInput {
  receiverAddress?: string;
  receiverCustody?: string;
}

export type OctantVaultCardEndowReceiverValidationError =
  | "receiver_required"
  | "receiver_invalid"
  | "receiver_custody_required"
  | "receiver_custody_invalid"
  | "provider_owned_receiver";

export interface OctantVaultCardEndowReceiverValidation {
  status: "valid" | "invalid";
  errors: OctantVaultCardEndowReceiverValidationError[];
  receiver?: OctantVaultCardEndowReceiver;
}

export function validateOctantVaultCardEndowReceiver(
  input: OctantVaultCardEndowReceiverInput
): OctantVaultCardEndowReceiverValidation {
  const errors: OctantVaultCardEndowReceiverValidationError[] = [];

  if (!hasText(input.receiverAddress)) {
    errors.push("receiver_required");
  } else if (!hasAddress(input.receiverAddress)) {
    errors.push("receiver_invalid");
  }

  if (!hasText(input.receiverCustody)) {
    errors.push("receiver_custody_required");
  } else if (input.receiverCustody === "provider_owned_custody") {
    errors.push("provider_owned_receiver");
  } else if (input.receiverCustody !== "user_owned_recovered_wallet") {
    errors.push("receiver_custody_invalid");
  }

  if (errors.length > 0) {
    return {
      status: "invalid",
      errors,
    };
  }

  return {
    status: "valid",
    errors: [],
    receiver: {
      intentKind: "card_endow",
      paymentMethod: "card",
      receiverKind: "recovered_wallet",
      receiverCustody: "user_owned_recovered_wallet",
      receiverAddress: input.receiverAddress as Address,
    },
  };
}

export const OCTANT_VAULT_CARD_ENDOW_MIN_USD_CENTS = 200n;

export function meetsOctantVaultCardEndowUsdMinimum(usdCents: bigint | null): boolean {
  return usdCents !== null && usdCents >= OCTANT_VAULT_CARD_ENDOW_MIN_USD_CENTS;
}

export type OctantVaultCardOnrampQuoteError =
  | "quote_missing"
  | "chain_mismatch"
  | "token_mismatch"
  | "receiver_mismatch"
  | "amount_mismatch";

export interface OctantVaultCardOnrampQuoteInput {
  /** Destination chain echoed by the provider quote/intent. */
  chainId?: number;
  /** Destination token echoed by the provider quote/intent. */
  tokenAddress?: string;
  /** Receiver echoed by the provider quote/intent. */
  receiver?: string;
  /** Intent amount echoed by the provider quote, in base units. */
  amount?: string | bigint | null;
  /** Quoted destination amount, in base units. */
  destinationAmount?: string | bigint | null;
}

export interface OctantVaultCardOnrampRouteExpectation {
  chainId: number;
  tokenAddress: Address;
  receiverAddress: Address;
  /** Expected base-unit amount. */
  amount: string;
}

export interface OctantVaultCardOnrampQuoteValidation {
  status: "valid" | "invalid";
  errors: OctantVaultCardOnrampQuoteError[];
}

function toBaseUnitString(value: string | bigint | null | undefined): string | null {
  if (typeof value === "bigint") return value >= 0n ? value.toString() : null;
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  return null;
}

export function validateOctantVaultCardOnrampQuote(
  quote: OctantVaultCardOnrampQuoteInput | null | undefined,
  expected: OctantVaultCardOnrampRouteExpectation
): OctantVaultCardOnrampQuoteValidation {
  if (!quote) {
    return { status: "invalid", errors: ["quote_missing"] };
  }

  const errors: OctantVaultCardOnrampQuoteError[] = [];

  if (quote.chainId !== expected.chainId) {
    errors.push("chain_mismatch");
  }
  if (!addressesMatch(quote.tokenAddress, expected.tokenAddress)) {
    errors.push("token_mismatch");
  }
  if (!addressesMatch(quote.receiver, expected.receiverAddress)) {
    errors.push("receiver_mismatch");
  }

  const intentAmount = toBaseUnitString(quote.amount);
  const destinationAmount = toBaseUnitString(quote.destinationAmount);
  const amountConfirmed =
    (intentAmount !== null || destinationAmount !== null) &&
    (intentAmount === null || intentAmount === expected.amount) &&
    (destinationAmount === null || destinationAmount === expected.amount);
  if (!amountConfirmed) {
    errors.push("amount_mismatch");
  }

  return {
    status: errors.length === 0 ? "valid" : "invalid",
    errors,
  };
}

export type OctantVaultCardOnrampCompletionError =
  | "status_not_completed"
  | "intent_contradiction"
  | "route_contradiction"
  | "campaign_contradiction"
  | "vault_contradiction"
  | "token_contradiction"
  | "receiver_contradiction"
  | "amount_contradiction";

export interface OctantVaultCardOnrampCompletionInput {
  status?: string;
  /** Provider-echoed purchase/session tuple (untrusted until validated). */
  purchaseData?: unknown;
}

export interface OctantVaultCardOnrampCompletionExpectation
  extends OctantVaultCardOnrampRouteExpectation {
  campaignSlug: string;
  vaultAddress: Address;
}

export interface OctantVaultCardOnrampCompletionValidation {
  status: "valid" | "invalid";
  errors: OctantVaultCardOnrampCompletionError[];
}

export function validateOctantVaultCardOnrampCompletion(
  input: OctantVaultCardOnrampCompletionInput,
  expected: OctantVaultCardOnrampCompletionExpectation
): OctantVaultCardOnrampCompletionValidation {
  const errors: OctantVaultCardOnrampCompletionError[] = [];

  if (input.status !== "COMPLETED") {
    errors.push("status_not_completed");
  }

  if (input.purchaseData && typeof input.purchaseData === "object") {
    const tuple = input.purchaseData as Record<string, unknown>;
    if (tuple.intent !== undefined && tuple.intent !== "octant_vault_card_endow") {
      errors.push("intent_contradiction");
    }
    if (tuple.route !== undefined && tuple.route !== "/vaults") {
      errors.push("route_contradiction");
    }
    if (tuple.campaignSlug !== undefined && tuple.campaignSlug !== expected.campaignSlug) {
      errors.push("campaign_contradiction");
    }
    if (
      tuple.vaultAddress !== undefined &&
      !addressesMatch(tuple.vaultAddress, expected.vaultAddress)
    ) {
      errors.push("vault_contradiction");
    }
    if (
      tuple.tokenAddress !== undefined &&
      !addressesMatch(tuple.tokenAddress, expected.tokenAddress)
    ) {
      errors.push("token_contradiction");
    }
    if (
      tuple.receiverAddress !== undefined &&
      !addressesMatch(tuple.receiverAddress, expected.receiverAddress)
    ) {
      errors.push("receiver_contradiction");
    }
    if (tuple.amount !== undefined && String(tuple.amount) !== expected.amount) {
      errors.push("amount_contradiction");
    }
  }

  return {
    status: errors.length === 0 ? "valid" : "invalid",
    errors,
  };
}

export function hasRequiredOctantVaultFundingBalance(
  balance: bigint | string | number | null | undefined,
  expectedAmount: string
): boolean {
  if (!/^\d+$/.test(expectedAmount)) return false;
  let parsed: bigint;
  if (typeof balance === "bigint") {
    parsed = balance;
  } else if (typeof balance === "number" && Number.isInteger(balance) && balance >= 0) {
    parsed = BigInt(balance);
  } else if (typeof balance === "string" && /^\d+$/.test(balance)) {
    parsed = BigInt(balance);
  } else {
    return false;
  }
  return parsed >= BigInt(expectedAmount);
}

export type OctantVaultShareOwnershipProofError =
  | "manifest_incomplete"
  | "receiver_required"
  | "receiver_invalid"
  | "owner_required"
  | "owner_receiver_mismatch"
  | "vault_mismatch"
  | "shares_missing"
  | "shares_not_visible";

export interface OctantVaultShareOwnershipProofInput {
  campaign: OctantVaultCampaignManifest;
  ownerAddress?: string;
  receiverAddress?: string;
  vaultAddress?: string;
  shareBalance?: string | bigint | number;
  sharesVisible?: boolean;
}

export interface OctantVaultShareOwnershipProofValidation {
  status: "valid" | "invalid";
  errors: OctantVaultShareOwnershipProofError[];
}

export function validateOctantVaultShareOwnershipProof(
  input: OctantVaultShareOwnershipProofInput
): OctantVaultShareOwnershipProofValidation {
  const errors: OctantVaultShareOwnershipProofError[] = [];
  const manifestValidation = validateOctantVaultCardEndowManifest(input.campaign);

  if (manifestValidation.status !== "complete") {
    errors.push("manifest_incomplete");
  }
  if (!hasText(input.receiverAddress)) {
    errors.push("receiver_required");
  } else if (!hasAddress(input.receiverAddress)) {
    errors.push("receiver_invalid");
  }
  if (!hasText(input.ownerAddress)) {
    errors.push("owner_required");
  } else if (!addressesMatch(input.ownerAddress, input.receiverAddress)) {
    errors.push("owner_receiver_mismatch");
  }
  if (!addressesMatch(input.vaultAddress, input.campaign.vault?.vaultAddress)) {
    errors.push("vault_mismatch");
  }
  if (!hasPositiveShareBalance(input.shareBalance)) {
    errors.push("shares_missing");
  }
  if (input.sharesVisible !== true) {
    errors.push("shares_not_visible");
  }

  return {
    status: errors.length === 0 ? "valid" : "invalid",
    errors,
  };
}
