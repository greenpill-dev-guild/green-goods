import type { Address } from "../../types/domain";
import {
  hasAddress,
  hasOctantEthereumChainId,
  hasText,
  validateOctantVaultWalletEndowManifest,
} from "./manifest";
import type { OctantVaultCampaignManifest } from "./manifest";

export type OctantVaultWalletEndowIntentKind = "wallet_endow";

export interface OctantVaultWalletEndowReceiver {
  intentKind: OctantVaultWalletEndowIntentKind;
  paymentMethod: "wallet";
  receiverKind: "connected_wallet";
  receiverCustody: "connected_wallet";
  receiverAddress: Address;
}

export type OctantVaultWalletEndowPreparationError =
  | "manifest_incomplete"
  | "amount_required"
  | "receiver_required"
  | "receiver_invalid";

export interface OctantVaultWalletEndowPreparationInput {
  campaign: OctantVaultCampaignManifest;
  amount?: bigint | null;
  receiverAddress?: string;
}

export interface OctantVaultWalletEndowPreparedTransaction {
  intentKind: OctantVaultWalletEndowIntentKind;
  paymentMethod: "wallet";
  chainId: number;
  vaultAddress: Address;
  assetAddress: Address;
  assetSymbol: string;
  assetDecimals: number;
  amount: bigint;
  receiver: OctantVaultWalletEndowReceiver;
}

export interface OctantVaultWalletEndowPreparation {
  status: "ready" | "blocked";
  errors: OctantVaultWalletEndowPreparationError[];
  transaction?: OctantVaultWalletEndowPreparedTransaction;
}

export function createOctantVaultWalletEndowReceiver(
  connectedWalletAddress: Address
): OctantVaultWalletEndowReceiver {
  return {
    intentKind: "wallet_endow",
    paymentMethod: "wallet",
    receiverKind: "connected_wallet",
    receiverCustody: "connected_wallet",
    receiverAddress: connectedWalletAddress,
  };
}

export function prepareOctantVaultWalletEndow({
  campaign,
  amount,
  receiverAddress,
}: OctantVaultWalletEndowPreparationInput): OctantVaultWalletEndowPreparation {
  const errors: OctantVaultWalletEndowPreparationError[] = [];
  const manifestValidation = validateOctantVaultWalletEndowManifest(campaign);
  const vault = campaign.vault;
  const asset = vault?.asset;

  if (manifestValidation.status !== "complete") {
    errors.push("manifest_incomplete");
  }
  if (typeof amount !== "bigint" || amount <= 0n) {
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
      errors,
    };
  }

  const receiver = createOctantVaultWalletEndowReceiver(receiverAddress as Address);

  return {
    status: "ready",
    errors: [],
    transaction: {
      intentKind: "wallet_endow",
      paymentMethod: "wallet",
      chainId: vault?.chainId as number,
      vaultAddress: vault?.vaultAddress as Address,
      assetAddress: asset?.address as Address,
      assetSymbol: asset?.symbol as string,
      assetDecimals: asset?.decimals as number,
      amount: amount as bigint,
      receiver,
    },
  };
}
