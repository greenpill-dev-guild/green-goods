import type { Address } from "../types/domain";

export type OctantVaultCampaignSlug = "greenpill-nyc" | "evmavericks" | (string & {});

export type OctantVaultCampaignFixtureRole =
  | "first_available_transaction_fixture"
  | "blocked_pending_manifest"
  | "standard_campaign";

export type OctantVaultCampaignTargetProtocol = "octant-v2-ethereum";

const OCTANT_V2_ETHEREUM_CHAIN_ID = 1;
const ETHEREUM_EXPLORER_HOSTS = new Set(["etherscan.io", "www.etherscan.io"]);

export type OctantVaultManifestField =
  | "chainId"
  | "vaultAddress"
  | "assetAddress"
  | "assetSymbol"
  | "assetDecimals"
  | "recipientRoutingSummary"
  | "protocolGuildDestinationContext"
  | "explorerLink"
  | "campaignCopy";

export type OctantVaultCampaignManifestStatus = "complete" | "blocked_pending_manifest";

export interface OctantVaultCampaignCopy {
  headline: string;
  summary: string;
  fundingPurpose: string;
  recipientLogic: string;
  riskNote: string;
}

export interface OctantVaultCampaignAssetManifest {
  address?: Address;
  symbol?: string;
  decimals?: number;
}

export interface OctantVaultStrategyFactoryEvidence {
  address: Address;
  name: string;
  evidenceType: "pilot_strategy_factory_creator";
  sourcePath: string;
  explorerLink: string;
  roleClarification: string;
  factoryAccessorProofStatus: "reverted";
}

export interface OctantVaultManifest {
  chainId?: number;
  vaultAddress?: Address;
  vaultName?: string;
  vaultSymbol?: string;
  vaultDecimals?: number;
  asset?: OctantVaultCampaignAssetManifest;
  explorerLink?: string;
  strategyFactory?: OctantVaultStrategyFactoryEvidence;
}

export interface OctantVaultCampaignManifest {
  slug: OctantVaultCampaignSlug;
  displayName: string;
  communityName: string;
  fixtureRole: OctantVaultCampaignFixtureRole;
  routePath: "/vaults";
  targetProtocol: OctantVaultCampaignTargetProtocol;
  campaignCopy?: OctantVaultCampaignCopy;
  /**
   * Route-only preview copy lets the browse surface explain why a fixture is
   * present without treating unapproved campaign copy as transaction-ready.
   */
  previewCopy?: OctantVaultCampaignCopy;
  vault?: OctantVaultManifest;
  recipientRoutingSummary?: string;
  protocolGuildDestinationContext?: string;
  requiredManifestFields?: readonly OctantVaultManifestField[];
}

export interface OctantVaultCampaignManifestValidation {
  status: OctantVaultCampaignManifestStatus;
  missingFields: OctantVaultManifestField[];
}

export interface OctantVaultCampaignTransactionState {
  manifestStatus: OctantVaultCampaignManifestStatus;
  status: "ready" | "blocked_pending_manifest" | "blocked_pending_wallet_endow";
  walletEndowEnabled: boolean;
  cardEndowVisible: boolean;
  missingFields: OctantVaultManifestField[];
  disabledReason?: "manifest_incomplete" | "wallet_endow_not_implemented";
}

export type OctantVaultWalletEndowIntentKind = "wallet_endow";
export type OctantVaultCardEndowIntentKind = "card_endow";
export type OctantVaultCardDonateIntentKind = "card_donate";
export type OctantVaultCardProofIntentKind =
  | OctantVaultCardEndowIntentKind
  | OctantVaultCardDonateIntentKind;
export type OctantVaultPaymentMethod = "wallet" | "card";
export type OctantVaultCardProvider = "thirdweb";
export type OctantVaultTransactionHash = `0x${string}`;
export type OctantVaultCardEndowReceiverCustody = "user_owned_recovered_wallet";

export interface OctantVaultWalletEndowReceiver {
  intentKind: OctantVaultWalletEndowIntentKind;
  paymentMethod: "wallet";
  receiverKind: "connected_wallet";
  receiverCustody: "connected_wallet";
  receiverAddress: Address;
}

export interface OctantVaultCardEndowReceiver {
  intentKind: OctantVaultCardEndowIntentKind;
  paymentMethod: "card";
  receiverKind: "recovered_wallet";
  receiverCustody: OctantVaultCardEndowReceiverCustody;
  receiverAddress: Address;
}

export type OctantVaultEndowReceiver =
  | OctantVaultWalletEndowReceiver
  | OctantVaultCardEndowReceiver;

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

export const GREENPILL_NYC_REQUIRED_MANIFEST_FIELDS = [
  "chainId",
  "vaultAddress",
  "assetAddress",
  "assetSymbol",
  "assetDecimals",
  "recipientRoutingSummary",
  "explorerLink",
  "campaignCopy",
] as const satisfies readonly OctantVaultManifestField[];

export const EVMAVERICKS_REQUIRED_MANIFEST_FIELDS = [
  "chainId",
  "vaultAddress",
  "assetAddress",
  "assetSymbol",
  "assetDecimals",
  "recipientRoutingSummary",
  "protocolGuildDestinationContext",
  "explorerLink",
  "campaignCopy",
] as const satisfies readonly OctantVaultManifestField[];

export const OCTANT_VAULT_MANIFEST_FIELD_LABELS: Record<OctantVaultManifestField, string> = {
  chainId: "chain ID",
  vaultAddress: "vault address",
  assetAddress: "asset address",
  assetSymbol: "asset symbol",
  assetDecimals: "asset decimals",
  recipientRoutingSummary: "recipient/routing summary",
  protocolGuildDestinationContext: "Protocol Guild destination context",
  explorerLink: "explorer link",
  campaignCopy: "campaign copy",
};

const greenpillNycPreviewCopy: OctantVaultCampaignCopy = {
  headline: "A dedicated vault for Greenpill NYC civic-tech funding.",
  summary:
    "Greenpill NYC is the first pilot slot for the Octant V2 Ethereum vault crowdfunding demo.",
  fundingPurpose:
    "The campaign is intended to fund local public-goods coordination while keeping the vault tuple explicit before transactions are enabled.",
  recipientLogic:
    "Recipient routing will be shown here once the deployed Octant V2 Ethereum vault manifest is recorded.",
  riskNote:
    "Wallet Endow stays disabled until the chain, vault, asset, recipient routing, explorer link, and approved campaign copy are complete.",
};

const evmavericksPreviewCopy: OctantVaultCampaignCopy = {
  headline: "A pending vault slot for recurring ETH-native public-goods funding.",
  summary:
    "EVMavericks appears in the first demo manifest so reviewers can inspect the slot before transaction metadata lands.",
  fundingPurpose:
    "The campaign is intended to support a Fantasy Football League funding flow tied to public-goods outcomes.",
  recipientLogic:
    "Protocol Guild destination context and recipient routing are required before this campaign can accept Endow transactions.",
  riskNote:
    "Wallet Endow and Thirdweb Card Endow are blocked until the complete EVMavericks Octant V2 Ethereum manifest is supplied.",
};

const WETH_ASSET_MANIFEST = {
  address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  symbol: "WETH",
  decimals: 18,
} as const satisfies OctantVaultCampaignAssetManifest;

const PILOT_STRATEGY_FACTORY_CREATOR = {
  address: "0x9A6c9aA80D4A0d8Da29EcbA62c40ccBBB321abB6",
  name: "YearnV3StrategyFactory",
  evidenceType: "pilot_strategy_factory_creator",
  sourcePath: "src/factories/yieldDonating/YearnV3StrategyFactory.sol",
  explorerLink: "https://etherscan.io/address/0x9A6c9aA80D4A0d8Da29EcbA62c40ccBBB321abB6",
  roleClarification:
    "Shared pilot strategy-factory/creator evidence only; not a proven MultistrategyVaultFactory deployment or successful FACTORY() return.",
  factoryAccessorProofStatus: "reverted",
} as const satisfies OctantVaultStrategyFactoryEvidence;

export const OCTANT_VAULT_CAMPAIGN_MANIFEST = [
  {
    slug: "greenpill-nyc",
    displayName: "Greenpill NYC",
    communityName: "Greenpill NYC",
    fixtureRole: "first_available_transaction_fixture",
    routePath: "/vaults",
    targetProtocol: "octant-v2-ethereum",
    previewCopy: greenpillNycPreviewCopy,
    vault: {
      chainId: OCTANT_V2_ETHEREUM_CHAIN_ID,
      vaultAddress: "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5",
      vaultName: "Greenpill NYC",
      vaultSymbol: "gpWETH",
      vaultDecimals: 18,
      asset: WETH_ASSET_MANIFEST,
      explorerLink: "https://etherscan.io/address/0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5",
      strategyFactory: PILOT_STRATEGY_FACTORY_CREATOR,
    },
    requiredManifestFields: GREENPILL_NYC_REQUIRED_MANIFEST_FIELDS,
  },
  {
    slug: "evmavericks",
    displayName: "EVMavericks Fantasy Football League",
    communityName: "EVMavericks",
    fixtureRole: "blocked_pending_manifest",
    routePath: "/vaults",
    targetProtocol: "octant-v2-ethereum",
    previewCopy: evmavericksPreviewCopy,
    vault: {
      chainId: OCTANT_V2_ETHEREUM_CHAIN_ID,
      vaultAddress: "0x0bCe8c16974FFD3B410A32365c5bCf27a5A630Fc",
      vaultName: "EVMavs PGF",
      vaultSymbol: "evmWETH",
      vaultDecimals: 18,
      asset: WETH_ASSET_MANIFEST,
      explorerLink: "https://etherscan.io/address/0x0bCe8c16974FFD3B410A32365c5bCf27a5A630Fc",
      strategyFactory: PILOT_STRATEGY_FACTORY_CREATOR,
    },
    requiredManifestFields: EVMAVERICKS_REQUIRED_MANIFEST_FIELDS,
  },
] as const satisfies readonly OctantVaultCampaignManifest[];

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasAddress(value: unknown): value is Address {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function hasTransactionHash(value: unknown): value is OctantVaultTransactionHash {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}

function addressesMatch(value: unknown, expected: unknown): boolean {
  return (
    hasAddress(value) && hasAddress(expected) && value.toLowerCase() === expected.toLowerCase()
  );
}

function transactionHashesMatch(value: unknown, expected: unknown): boolean {
  return (
    hasTransactionHash(value) &&
    hasTransactionHash(expected) &&
    value.toLowerCase() === expected.toLowerCase()
  );
}

function hasOctantEthereumChainId(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) === OCTANT_V2_ETHEREUM_CHAIN_ID;
}

function hasMatchingEthereumExplorerLink(value: unknown, vaultAddress: unknown): boolean {
  if (!hasText(value) || !hasAddress(vaultAddress)) return false;

  try {
    const url = new URL(value);
    const normalizedPath = url.pathname.toLowerCase().replace(/\/$/, "");
    return (
      url.protocol === "https:" &&
      ETHEREUM_EXPLORER_HOSTS.has(url.hostname.toLowerCase()) &&
      normalizedPath === `/address/${vaultAddress.toLowerCase()}`
    );
  } catch {
    return false;
  }
}

function hasCampaignCopy(copy: OctantVaultCampaignCopy | undefined): boolean {
  return (
    Boolean(copy) &&
    hasText(copy?.headline) &&
    hasText(copy?.summary) &&
    hasText(copy?.fundingPurpose) &&
    hasText(copy?.recipientLogic) &&
    hasText(copy?.riskNote)
  );
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

function getRequiredFields(
  campaign: OctantVaultCampaignManifest
): readonly OctantVaultManifestField[] {
  if (campaign.requiredManifestFields) return campaign.requiredManifestFields;
  return GREENPILL_NYC_REQUIRED_MANIFEST_FIELDS;
}

function hasManifestField(
  campaign: OctantVaultCampaignManifest,
  field: OctantVaultManifestField
): boolean {
  switch (field) {
    case "chainId":
      return hasOctantEthereumChainId(campaign.vault?.chainId);
    case "vaultAddress":
      return hasAddress(campaign.vault?.vaultAddress);
    case "assetAddress":
      return hasAddress(campaign.vault?.asset?.address);
    case "assetSymbol":
      return hasText(campaign.vault?.asset?.symbol);
    case "assetDecimals":
      return (
        Number.isInteger(campaign.vault?.asset?.decimals) &&
        Number(campaign.vault?.asset?.decimals) >= 0
      );
    case "recipientRoutingSummary":
      return hasText(campaign.recipientRoutingSummary);
    case "protocolGuildDestinationContext":
      return hasText(campaign.protocolGuildDestinationContext);
    case "explorerLink":
      return hasMatchingEthereumExplorerLink(
        campaign.vault?.explorerLink,
        campaign.vault?.vaultAddress
      );
    case "campaignCopy":
      return hasCampaignCopy(campaign.campaignCopy);
  }
}

export function validateOctantVaultCampaignManifest(
  campaign: OctantVaultCampaignManifest
): OctantVaultCampaignManifestValidation {
  const missingFields = getRequiredFields(campaign).filter(
    (field) => !hasManifestField(campaign, field)
  );

  return {
    status: missingFields.length === 0 ? "complete" : "blocked_pending_manifest",
    missingFields,
  };
}

export function validateOctantVaultCardEndowProof(
  proof: OctantVaultCardEndowProofInput,
  expected: OctantVaultCardEndowProofExpectation
): OctantVaultCardEndowProofValidation {
  const errors: OctantVaultCardEndowProofValidationError[] = [];
  const manifestValidation = validateOctantVaultCampaignManifest(expected.campaign);
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

export function prepareOctantVaultWalletEndow({
  campaign,
  amount,
  receiverAddress,
}: OctantVaultWalletEndowPreparationInput): OctantVaultWalletEndowPreparation {
  const errors: OctantVaultWalletEndowPreparationError[] = [];
  const manifestValidation = validateOctantVaultCampaignManifest(campaign);
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

export function isOctantVaultCampaignTransactionReady(
  campaign: OctantVaultCampaignManifest
): boolean {
  return getOctantVaultCampaignTransactionState(campaign).status === "ready";
}

export function getOctantVaultCampaignTransactionState(
  campaign: OctantVaultCampaignManifest
): OctantVaultCampaignTransactionState {
  const validation = validateOctantVaultCampaignManifest(campaign);
  const manifestComplete = validation.status === "complete";

  if (!manifestComplete) {
    return {
      manifestStatus: validation.status,
      status: "blocked_pending_manifest",
      walletEndowEnabled: false,
      // Card Endow remains hidden until custody/share/provider proof gates land in a later phase.
      cardEndowVisible: false,
      missingFields: validation.missingFields,
      disabledReason: "manifest_incomplete",
    };
  }

  return {
    manifestStatus: validation.status,
    status: "ready",
    walletEndowEnabled: true,
    // Card Endow remains hidden until custody/share/provider proof gates land in a later phase.
    cardEndowVisible: false,
    missingFields: validation.missingFields,
  };
}

export function getOctantVaultCampaigns(): OctantVaultCampaignManifest[] {
  return [...OCTANT_VAULT_CAMPAIGN_MANIFEST];
}

export function getOctantVaultCampaignBySlug(
  slug: OctantVaultCampaignSlug
): OctantVaultCampaignManifest | undefined {
  return OCTANT_VAULT_CAMPAIGN_MANIFEST.find((campaign) => campaign.slug === slug);
}

export function getOctantVaultCampaignCopy(
  campaign: OctantVaultCampaignManifest
): OctantVaultCampaignCopy {
  return (
    campaign.campaignCopy ??
    campaign.previewCopy ?? {
      headline: campaign.displayName,
      summary: "Campaign copy is pending.",
      fundingPurpose: "Funding purpose is pending.",
      recipientLogic: "Recipient routing is pending.",
      riskNote: "Transactions are disabled until the manifest is complete.",
    }
  );
}
