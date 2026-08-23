import type { Address } from "../../types/domain";
import type {
  OctantVaultCardEndowReadiness,
  OctantVaultCardEndowReadinessError,
} from "./card-proofs";
import type { OctantVaultCardProvider } from "./card-endow";
import {
  addressesMatch,
  hasAddress,
  hasOctantEthereumChainId,
  hasPositiveBaseUnitAmount,
  hasText,
  unique,
  validateOctantVaultCampaignManifest,
  validateOctantVaultCardEndowManifest,
  validateOctantVaultWalletEndowManifest,
} from "./manifest";
import type {
  OctantVaultCampaignManifest,
  OctantVaultCampaignManifestStatus,
  OctantVaultManifestField,
} from "./manifest";

export const OCTANT_VAULT_ROUTE_MANAGEMENT_URL = "/vaults?manage=positions" as const;

export type OctantVaultRouteManageProofError =
  | "manifest_incomplete"
  | "receiver_required"
  | "receiver_invalid"
  | "owner_receiver_mismatch"
  | "vault_mismatch"
  | "route_mismatch"
  | "management_url_mismatch"
  | "shares_not_visible"
  | "withdraw_unavailable";

export interface OctantVaultRouteManageProofInput {
  campaign: OctantVaultCampaignManifest;
  ownerAddress?: string;
  receiverAddress?: string;
  vaultAddress?: string;
  routePath?: string;
  managementUrl?: string;
  sharesVisible?: boolean;
  withdrawAvailable?: boolean;
}

export interface OctantVaultRouteManageProofValidation {
  status: "valid" | "invalid";
  errors: OctantVaultRouteManageProofError[];
}

export function validateOctantVaultRouteManageProof(
  input: OctantVaultRouteManageProofInput
): OctantVaultRouteManageProofValidation {
  const errors: OctantVaultRouteManageProofError[] = [];
  const manifestValidation = validateOctantVaultCardEndowManifest(input.campaign);

  if (manifestValidation.status !== "complete") {
    errors.push("manifest_incomplete");
  }
  if (!hasText(input.receiverAddress)) {
    errors.push("receiver_required");
  } else if (!hasAddress(input.receiverAddress)) {
    errors.push("receiver_invalid");
  }
  if (!addressesMatch(input.ownerAddress, input.receiverAddress)) {
    errors.push("owner_receiver_mismatch");
  }
  if (!addressesMatch(input.vaultAddress, input.campaign.vault?.vaultAddress)) {
    errors.push("vault_mismatch");
  }
  if (input.routePath !== "/vaults") {
    errors.push("route_mismatch");
  }
  if (input.managementUrl !== OCTANT_VAULT_ROUTE_MANAGEMENT_URL) {
    errors.push("management_url_mismatch");
  }
  if (input.sharesVisible !== true) {
    errors.push("shares_not_visible");
  }
  if (input.withdrawAvailable !== true) {
    errors.push("withdraw_unavailable");
  }

  return {
    status: errors.length === 0 ? "valid" : "invalid",
    errors,
  };
}

export type OctantVaultCardEndowFallbackPlanError =
  | "manifest_incomplete"
  | "amount_required"
  | "receiver_required"
  | "receiver_invalid";

export interface OctantVaultCardEndowFallbackPlanInput {
  campaign: OctantVaultCampaignManifest;
  amount?: string | null;
  receiverAddress?: string;
}

export interface OctantVaultCardEndowFallbackFundingStep {
  provider: OctantVaultCardProvider;
  paymentMethod: "card";
  chainId: number;
  destinationAddress: Address;
  tokenAddress: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: string;
  receiverAddress: Address;
}

export interface OctantVaultCardEndowFallbackReceiptExpectation {
  sourceRoute: "/vaults";
  managementUrl: typeof OCTANT_VAULT_ROUTE_MANAGEMENT_URL;
  expectedVaultAddress: Address;
  expectedTokenAddress: Address;
  expectedAmount: string;
  receiverAddress: Address;
}

export type OctantVaultCardEndowFallbackTransactionRole = "approval" | "funding";

export interface OctantVaultCardEndowFallbackApprovalTransaction {
  role: "approval";
  chainId: number;
  contractAddress: Address;
  functionName: "approve";
  args: readonly [Address, string];
}

export interface OctantVaultCardEndowFallbackDepositTransaction {
  role: "funding";
  chainId: number;
  contractAddress: Address;
  functionName: "deposit";
  args: readonly [string, Address];
}

export type OctantVaultCardEndowFallbackUserTransaction =
  | OctantVaultCardEndowFallbackApprovalTransaction
  | OctantVaultCardEndowFallbackDepositTransaction;

export interface OctantVaultCardEndowFallbackShareVerification {
  role: "share_verification";
  chainId: number;
  contractAddress: Address;
  functionName: "balanceOf";
  args: readonly [Address];
  expectedResult: "positive_share_balance";
}

export interface OctantVaultCardEndowFallbackPlan {
  providerFlow: "fund_recovered_wallet_then_user_authorized_deposit";
  cardFunding: OctantVaultCardEndowFallbackFundingStep;
  receiptExpectation: OctantVaultCardEndowFallbackReceiptExpectation;
  userAuthorizedTransactions: readonly [
    OctantVaultCardEndowFallbackApprovalTransaction,
    OctantVaultCardEndowFallbackDepositTransaction,
  ];
  shareVerification: OctantVaultCardEndowFallbackShareVerification;
}

export interface OctantVaultCardEndowFallbackPreparation {
  status: "ready" | "blocked";
  errors: OctantVaultCardEndowFallbackPlanError[];
  plan?: OctantVaultCardEndowFallbackPlan;
}

export function prepareOctantVaultCardEndowFallbackPlan({
  campaign,
  amount,
  receiverAddress,
}: OctantVaultCardEndowFallbackPlanInput): OctantVaultCardEndowFallbackPreparation {
  const errors: OctantVaultCardEndowFallbackPlanError[] = [];
  const manifestValidation = validateOctantVaultCardEndowManifest(campaign);
  const vault = campaign.vault;
  const asset = vault?.asset;

  if (manifestValidation.status !== "complete") {
    errors.push("manifest_incomplete");
  }
  if (!hasPositiveBaseUnitAmount(amount)) {
    errors.push("amount_required");
  }
  if (!hasText(receiverAddress)) {
    errors.push("receiver_required");
  } else if (!hasAddress(receiverAddress)) {
    errors.push("receiver_invalid");
  }

  if (
    !vault ||
    !asset ||
    !hasOctantEthereumChainId(vault.chainId) ||
    !hasAddress(vault.vaultAddress) ||
    !hasAddress(asset.address) ||
    !hasText(asset.symbol) ||
    !Number.isInteger(asset.decimals) ||
    Number(asset.decimals) < 0
  ) {
    if (!errors.includes("manifest_incomplete")) {
      errors.push("manifest_incomplete");
    }
  }

  if (errors.length > 0) {
    return {
      status: "blocked",
      errors: unique(errors),
    };
  }

  const vaultAddress = vault?.vaultAddress as Address;
  const tokenAddress = asset?.address as Address;
  const receiver = receiverAddress as Address;
  const baseUnitAmount = amount as string;

  return {
    status: "ready",
    errors: [],
    plan: {
      providerFlow: "fund_recovered_wallet_then_user_authorized_deposit",
      cardFunding: {
        provider: "thirdweb",
        paymentMethod: "card",
        chainId: vault?.chainId as number,
        destinationAddress: receiver,
        tokenAddress,
        tokenSymbol: asset?.symbol as string,
        tokenDecimals: asset?.decimals as number,
        amount: baseUnitAmount,
        receiverAddress: receiver,
      },
      receiptExpectation: {
        sourceRoute: "/vaults",
        managementUrl: OCTANT_VAULT_ROUTE_MANAGEMENT_URL,
        expectedVaultAddress: vaultAddress,
        expectedTokenAddress: tokenAddress,
        expectedAmount: baseUnitAmount,
        receiverAddress: receiver,
      },
      userAuthorizedTransactions: [
        {
          role: "approval",
          chainId: vault?.chainId as number,
          contractAddress: tokenAddress,
          functionName: "approve",
          args: [vaultAddress, baseUnitAmount],
        },
        {
          role: "funding",
          chainId: vault?.chainId as number,
          contractAddress: vaultAddress,
          functionName: "deposit",
          args: [baseUnitAmount, receiver],
        },
      ],
      shareVerification: {
        role: "share_verification",
        chainId: vault?.chainId as number,
        contractAddress: vaultAddress,
        functionName: "balanceOf",
        args: [receiver],
        expectedResult: "positive_share_balance",
      },
    },
  };
}

export interface OctantVaultCampaignTransactionState {
  manifestStatus: OctantVaultCampaignManifestStatus;
  status: "ready" | "blocked_pending_manifest" | "blocked_pending_wallet_endow";
  walletEndowEnabled: boolean;
  cardEndowVisible: boolean;
  cardEndowStatus?: "hidden_manifest_incomplete" | "hidden_pending_proof" | "visible";
  cardEndowProofErrors?: OctantVaultCardEndowReadinessError[];
  missingFields: OctantVaultManifestField[];
  disabledReason?: "manifest_incomplete" | "wallet_endow_not_implemented";
}

export function isOctantVaultCampaignTransactionReady(
  campaign: OctantVaultCampaignManifest
): boolean {
  return getOctantVaultCampaignTransactionState(campaign).status === "ready";
}

export function getOctantVaultCampaignTransactionState(
  campaign: OctantVaultCampaignManifest,
  options: { cardEndowReadiness?: OctantVaultCardEndowReadiness } = {}
): OctantVaultCampaignTransactionState {
  const validation = validateOctantVaultCampaignManifest(campaign);
  const walletValidation = validateOctantVaultWalletEndowManifest(campaign);
  const walletEndowEnabled = walletValidation.status === "complete";
  const cardValidation = validateOctantVaultCardEndowManifest(campaign);
  const cardEndowReadyForProof = cardValidation.status === "complete";

  if (!walletEndowEnabled) {
    return {
      manifestStatus: validation.status,
      status: "blocked_pending_manifest",
      walletEndowEnabled: false,
      // Card Endow stays hidden until manifest, custody, share, manage, and provider proof pass.
      cardEndowVisible: false,
      cardEndowStatus: "hidden_manifest_incomplete",
      missingFields: validation.missingFields,
      disabledReason: "manifest_incomplete",
    };
  }

  const cardEndowVisible = cardEndowReadyForProof && options.cardEndowReadiness?.status === "ready";

  return {
    manifestStatus: validation.status,
    status: "ready",
    walletEndowEnabled: true,
    cardEndowVisible,
    cardEndowStatus: cardEndowVisible
      ? "visible"
      : cardEndowReadyForProof
        ? "hidden_pending_proof"
        : "hidden_manifest_incomplete",
    cardEndowProofErrors: options.cardEndowReadiness?.errors,
    missingFields: validation.missingFields,
  };
}
