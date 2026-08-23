import type { Address } from "../../types/domain";
import {
  type OctantVaultCardEndowIntentKind,
  type OctantVaultCardEndowReceiverCustody,
  type OctantVaultCardProvider,
  type OctantVaultShareOwnershipProofInput,
  type OctantVaultShareOwnershipProofValidation,
  validateOctantVaultCardEndowReceiver,
  validateOctantVaultShareOwnershipProof,
} from "./card-endow";
import {
  addressesMatch,
  hasText,
  type OctantVaultCampaignManifest,
  transactionHashesMatch,
  unique,
  validateOctantVaultCardEndowManifest,
} from "./manifest";
import {
  OctantVaultRouteManageProofInput,
  OctantVaultRouteManageProofValidation,
  validateOctantVaultRouteManageProof,
} from "./route-manage";

export type OctantVaultCardDonateIntentKind = "card_donate";

export type OctantVaultCardProofIntentKind =
  | OctantVaultCardEndowIntentKind
  | OctantVaultCardDonateIntentKind;

export type OctantVaultTransactionHash = `0x${string}`;

export interface OctantVaultCardProofAsset {
  address: Address;
  symbol: string;
  decimals: number;
}

export interface OctantVaultCardEndowProof {
  intentKind: OctantVaultCardEndowIntentKind;
  provider: OctantVaultCardProvider;
  paymentMethod: "card";
  chainId: number;
  vaultAddress: Address;
  destinationAddress: Address;
  asset: OctantVaultCardProofAsset;
  amount: string;
  receiverAddress: Address;
  receiverCustody: OctantVaultCardEndowReceiverCustody;
  transactionHash: OctantVaultTransactionHash;
}

export interface OctantVaultCardDonateProof {
  intentKind: OctantVaultCardDonateIntentKind;
  provider: OctantVaultCardProvider;
  paymentMethod: "card";
  chainId: number;
  destinationAddress: Address;
  asset: OctantVaultCardProofAsset;
  amount: string;
  transactionHash: OctantVaultTransactionHash;
}

export type OctantVaultCardProof = OctantVaultCardEndowProof | OctantVaultCardDonateProof;

export interface OctantVaultCardEndowProofInput {
  intentKind?: string;
  provider?: string;
  paymentMethod?: string;
  chainId?: number;
  vaultAddress?: string;
  destinationAddress?: string;
  asset?: Partial<{
    address: string;
    symbol: string;
    decimals: number;
  }>;
  amount?: string;
  receiverAddress?: string;
  receiverCustody?: string;
  transactionHash?: string;
}

export interface OctantVaultCardEndowProofExpectation {
  campaign: OctantVaultCampaignManifest;
  amount: string;
  receiverAddress: Address;
  transactionHash: OctantVaultTransactionHash;
}

export type OctantVaultCardEndowProofValidationError =
  | "manifest_incomplete"
  | "intent_mismatch"
  | "provider_mismatch"
  | "payment_method_mismatch"
  | "chain_mismatch"
  | "vault_mismatch"
  | "destination_mismatch"
  | "asset_address_mismatch"
  | "asset_symbol_mismatch"
  | "asset_decimals_mismatch"
  | "amount_mismatch"
  | "invalid_receiver"
  | "provider_owned_receiver"
  | "receiver_mismatch"
  | "transaction_hash_mismatch";

export interface OctantVaultCardEndowProofValidation {
  status: "valid" | "invalid";
  errors: OctantVaultCardEndowProofValidationError[];
  proof?: OctantVaultCardEndowProof;
}

export interface OctantVaultCardEndowTuple {
  intentKind: OctantVaultCardEndowIntentKind;
  paymentMethod: "card";
  chainId: number;
  vaultAddress: Address;
  tokenAddress: Address;
  amount: string;
  destinationAddress: Address;
  receiverAddress: Address;
}

export type OctantVaultCardEndowReadinessError =
  | "manifest_incomplete"
  | "receiver_invalid"
  | "provider_proof_invalid"
  | "share_proof_invalid"
  | "manage_proof_invalid";

export interface OctantVaultCardEndowReadinessInput {
  campaign: OctantVaultCampaignManifest;
  amount: string;
  receiverAddress?: string;
  transactionHash: OctantVaultTransactionHash;
  providerProof: OctantVaultCardEndowProofInput;
  shareProof: OctantVaultShareOwnershipProofInput;
  manageProof: OctantVaultRouteManageProofInput;
}

export interface OctantVaultCardEndowReadiness {
  status: "ready" | "hidden";
  cardEndowVisible: boolean;
  errors: OctantVaultCardEndowReadinessError[];
  tuple?: OctantVaultCardEndowTuple;
  providerProof?: OctantVaultCardEndowProofValidation;
  shareProof?: OctantVaultShareOwnershipProofValidation;
  manageProof?: OctantVaultRouteManageProofValidation;
}

export function validateOctantVaultCardEndowProof(
  proof: OctantVaultCardEndowProofInput,
  expected: OctantVaultCardEndowProofExpectation
): OctantVaultCardEndowProofValidation {
  const errors: OctantVaultCardEndowProofValidationError[] = [];
  const manifestValidation = validateOctantVaultCardEndowManifest(expected.campaign);
  const expectedVault = expected.campaign.vault;
  const expectedAsset = expectedVault?.asset;

  if (manifestValidation.status !== "complete") {
    errors.push("manifest_incomplete");
  }
  if (proof.intentKind !== "card_endow") {
    errors.push("intent_mismatch");
  }
  if (proof.provider !== "thirdweb") {
    errors.push("provider_mismatch");
  }
  if (proof.paymentMethod !== "card") {
    errors.push("payment_method_mismatch");
  }
  if (proof.chainId !== expectedVault?.chainId) {
    errors.push("chain_mismatch");
  }
  if (!addressesMatch(proof.vaultAddress, expectedVault?.vaultAddress)) {
    errors.push("vault_mismatch");
  }
  if (!addressesMatch(proof.destinationAddress, expectedVault?.vaultAddress)) {
    errors.push("destination_mismatch");
  }
  if (!addressesMatch(proof.asset?.address, expectedAsset?.address)) {
    errors.push("asset_address_mismatch");
  }
  if (!hasText(proof.asset?.symbol) || proof.asset?.symbol !== expectedAsset?.symbol) {
    errors.push("asset_symbol_mismatch");
  }
  if (
    !Number.isInteger(proof.asset?.decimals) ||
    proof.asset?.decimals !== expectedAsset?.decimals
  ) {
    errors.push("asset_decimals_mismatch");
  }
  if (!hasText(proof.amount) || proof.amount !== expected.amount) {
    errors.push("amount_mismatch");
  }

  const receiverValidation = validateOctantVaultCardEndowReceiver({
    receiverAddress: proof.receiverAddress,
    receiverCustody: proof.receiverCustody,
  });
  if (receiverValidation.status === "invalid") {
    errors.push("invalid_receiver");
    if (receiverValidation.errors.includes("provider_owned_receiver")) {
      errors.push("provider_owned_receiver");
    }
  } else if (
    !receiverValidation.receiver ||
    !addressesMatch(receiverValidation.receiver.receiverAddress, expected.receiverAddress)
  ) {
    errors.push("receiver_mismatch");
  }

  if (!transactionHashesMatch(proof.transactionHash, expected.transactionHash)) {
    errors.push("transaction_hash_mismatch");
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
    proof: {
      intentKind: "card_endow",
      provider: "thirdweb",
      paymentMethod: "card",
      chainId: proof.chainId as number,
      vaultAddress: proof.vaultAddress as Address,
      destinationAddress: proof.destinationAddress as Address,
      asset: {
        address: proof.asset?.address as Address,
        symbol: proof.asset?.symbol as string,
        decimals: proof.asset?.decimals as number,
      },
      amount: proof.amount as string,
      receiverAddress: proof.receiverAddress as Address,
      receiverCustody: "user_owned_recovered_wallet",
      transactionHash: proof.transactionHash as OctantVaultTransactionHash,
    },
  };
}

export function prepareOctantVaultCardEndowReadiness({
  campaign,
  amount,
  receiverAddress,
  transactionHash,
  providerProof,
  shareProof,
  manageProof,
}: OctantVaultCardEndowReadinessInput): OctantVaultCardEndowReadiness {
  const errors: OctantVaultCardEndowReadinessError[] = [];
  const manifestValidation = validateOctantVaultCardEndowManifest(campaign);
  if (manifestValidation.status !== "complete") {
    errors.push("manifest_incomplete");
  }

  const receiverValidation = validateOctantVaultCardEndowReceiver({
    receiverAddress,
    receiverCustody: "user_owned_recovered_wallet",
  });
  if (receiverValidation.status === "invalid" || !receiverValidation.receiver) {
    errors.push("receiver_invalid");
  }

  const expected: OctantVaultCardEndowProofExpectation = {
    campaign,
    amount,
    receiverAddress: receiverAddress as Address,
    transactionHash,
  };
  const providerValidation = validateOctantVaultCardEndowProof(providerProof, expected);
  if (providerValidation.status === "invalid") {
    errors.push("provider_proof_invalid");
  }

  const shareValidation = validateOctantVaultShareOwnershipProof({
    ...shareProof,
    campaign,
    receiverAddress,
  });
  if (shareValidation.status === "invalid") {
    errors.push("share_proof_invalid");
  }

  const manageValidation = validateOctantVaultRouteManageProof({
    ...manageProof,
    campaign,
    receiverAddress,
  });
  if (manageValidation.status === "invalid") {
    errors.push("manage_proof_invalid");
  }

  if (
    errors.length > 0 ||
    !receiverValidation.receiver ||
    !campaign.vault?.vaultAddress ||
    !campaign.vault.asset?.address
  ) {
    return {
      status: "hidden",
      cardEndowVisible: false,
      errors: unique(errors),
      providerProof: providerValidation,
      shareProof: shareValidation,
      manageProof: manageValidation,
    };
  }

  return {
    status: "ready",
    cardEndowVisible: true,
    errors: [],
    tuple: {
      intentKind: "card_endow",
      paymentMethod: "card",
      chainId: campaign.vault.chainId as number,
      vaultAddress: campaign.vault.vaultAddress,
      tokenAddress: campaign.vault.asset.address,
      amount,
      destinationAddress: campaign.vault.vaultAddress,
      receiverAddress: receiverValidation.receiver.receiverAddress,
    },
    providerProof: providerValidation,
    shareProof: shareValidation,
    manageProof: manageValidation,
  };
}
