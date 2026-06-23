import enMessages from "../i18n/en.json";
import type { Address } from "../types/domain";
import type { YieldSourceKind } from "../utils/blockchain/yield-sources";

export type KnownOctantVaultCampaignSlug = "greenpill-nyc" | "evmavericks";
export type OctantVaultCampaignSlug = KnownOctantVaultCampaignSlug | (string & {});

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

type SharedLocaleMessageId = keyof typeof enMessages;
export type OctantVaultCampaignCopyField = keyof OctantVaultCampaignCopy;
export type OctantVaultCampaignCopyMessageIds = Record<
  OctantVaultCampaignCopyField,
  SharedLocaleMessageId
>;
export type OctantVaultManifestFieldLabelMessageIds = Record<
  OctantVaultManifestField,
  SharedLocaleMessageId
>;

function enMessage(id: SharedLocaleMessageId): string {
  return enMessages[id];
}

function campaignCopyFromMessageIds(
  messageIds: OctantVaultCampaignCopyMessageIds
): OctantVaultCampaignCopy {
  return {
    headline: enMessage(messageIds.headline),
    summary: enMessage(messageIds.summary),
    fundingPurpose: enMessage(messageIds.fundingPurpose),
    recipientLogic: enMessage(messageIds.recipientLogic),
    riskNote: enMessage(messageIds.riskNote),
  };
}

export interface OctantVaultCampaignAssetManifest {
  address?: Address;
  symbol?: string;
  decimals?: number;
}

export interface OctantVaultAssetDisplayPolicy {
  /** Primary donor-facing unit. WETH vault deposits are presented as ETH contributions. */
  donorSymbol: string;
  /** Settlement unit for receipt/review copy. */
  settlementSymbol: string;
  /** Exact token symbol used by the deployed vault. */
  technicalSymbol: string;
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

/**
 * Protocol family of the external yield source a YDS strategy deploys into.
 * Single-sourced from the adapter registry so the manifest and adapters can't drift.
 */
export type OctantVaultYieldSourceKind = YieldSourceKind;

/**
 * The external yield source the pilot strategy deploys into, recorded as a
 * verified deployment fact (like {@link OctantVaultManifest.vaultAddress}).
 *
 * The deployed `YieldDonatingTokenizedStrategy` exposes no public getter for its
 * source, so the address is read once off-chain (`YearnV3Strategy.yearnVault()`
 * for the pilots) and recorded here. `useOctantVaultStrategyApy` then reads this
 * source's live APY through the matching {@link YieldSourceAdapter}. Absent =>
 * the APY renders an honest `missing_source` unavailable state, never a number.
 */
export interface OctantVaultYieldSource {
  /** Address of the external yield source the strategy deposits into. */
  address: Address;
  kind: OctantVaultYieldSourceKind;
  /** Chain the source lives on; defaults to the vault chain. */
  chainId?: number;
  /** How the source address was verified (recorded, not inferred at runtime). */
  evidence?: string;
}

/**
 * Verified per-campaign strategy used to compute harvestable generated yield.
 *
 * This is intentionally separate from {@link OctantVaultYieldSource}. The
 * yield source can support APY reads, but generated WETH must come from the
 * campaign strategy balance itself so the metric does not accidentally include
 * unrelated deposits in the shared upstream source.
 */
export interface OctantVaultYieldStrategy {
  address: Address;
  /** Chain the strategy lives on; defaults to the vault chain. */
  chainId?: number;
  /** How the strategy address was verified before it was added to the manifest. */
  evidence?: string;
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
  /** External yield source for the live strategy-APY read. See {@link OctantVaultYieldSource}. */
  yieldSource?: OctantVaultYieldSource;
  /** Verified per-campaign strategy for harvestable generated-yield reads. */
  yieldStrategy?: OctantVaultYieldStrategy;
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
  cardEndowStatus?: "hidden_manifest_incomplete" | "hidden_pending_proof" | "visible";
  cardEndowProofErrors?: OctantVaultCardEndowReadinessError[];
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

export const OCTANT_VAULT_ROUTE_MANAGEMENT_URL = "/vaults?manage=positions" as const;

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

export const OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS = {
  chainId: "public.vaults.field.chainId",
  vaultAddress: "public.vaults.field.vaultAddress",
  assetAddress: "public.vaults.field.assetAddress",
  assetSymbol: "public.vaults.field.assetSymbol",
  assetDecimals: "public.vaults.field.assetDecimals",
  recipientRoutingSummary: "public.vaults.field.recipientRoutingSummary",
  protocolGuildDestinationContext: "public.vaults.field.protocolGuildDestinationContext",
  explorerLink: "public.vaults.field.explorerLink",
  campaignCopy: "public.vaults.field.campaignCopy",
} as const satisfies OctantVaultManifestFieldLabelMessageIds;

export const OCTANT_VAULT_MANIFEST_FIELD_LABELS: Record<OctantVaultManifestField, string> = {
  chainId: enMessage(OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.chainId),
  vaultAddress: enMessage(OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.vaultAddress),
  assetAddress: enMessage(OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.assetAddress),
  assetSymbol: enMessage(OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.assetSymbol),
  assetDecimals: enMessage(OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.assetDecimals),
  recipientRoutingSummary: enMessage(
    OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.recipientRoutingSummary
  ),
  protocolGuildDestinationContext: enMessage(
    OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.protocolGuildDestinationContext
  ),
  explorerLink: enMessage(OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.explorerLink),
  campaignCopy: enMessage(OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.campaignCopy),
};

export const OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS = {
  "greenpill-nyc": {
    headline: "public.vaults.campaign.greenpill-nyc.headline",
    summary: "public.vaults.campaign.greenpill-nyc.summary",
    fundingPurpose: "public.vaults.campaign.greenpill-nyc.fundingPurpose",
    recipientLogic: "public.vaults.campaign.greenpill-nyc.recipientLogic",
    riskNote: "public.vaults.campaign.greenpill-nyc.riskNote",
  },
  evmavericks: {
    headline: "public.vaults.campaign.evmavericks.headline",
    summary: "public.vaults.campaign.evmavericks.summary",
    fundingPurpose: "public.vaults.campaign.evmavericks.fundingPurpose",
    recipientLogic: "public.vaults.campaign.evmavericks.recipientLogic",
    riskNote: "public.vaults.campaign.evmavericks.riskNote",
  },
} as const satisfies Record<KnownOctantVaultCampaignSlug, OctantVaultCampaignCopyMessageIds>;

function isKnownOctantVaultCampaignSlug(
  slug: OctantVaultCampaignSlug
): slug is KnownOctantVaultCampaignSlug {
  return slug === "greenpill-nyc" || slug === "evmavericks";
}

const OCTANT_VAULT_CAMPAIGN_COPY_FALLBACK_MESSAGE_IDS = {
  summary: "public.vaults.campaign.fallback.summary",
  fundingPurpose: "public.vaults.campaign.fallback.fundingPurpose",
  recipientLogic: "public.vaults.campaign.fallback.recipientLogic",
  riskNote: "public.vaults.campaign.fallback.riskNote",
} as const satisfies Omit<OctantVaultCampaignCopyMessageIds, "headline">;

const greenpillNycPreviewCopy = campaignCopyFromMessageIds(
  OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS["greenpill-nyc"]
);

const evmavericksPreviewCopy = campaignCopyFromMessageIds(
  OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS.evmavericks
);

const WETH_ASSET_MANIFEST = {
  address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  symbol: "WETH",
  decimals: 18,
} as const satisfies OctantVaultCampaignAssetManifest;

/**
 * Both pilot `YearnV3Strategy` vaults deposit into the same inner Yearn V3 WETH
 * vault, read once off-chain via `YearnV3Strategy.yearnVault()` (the deployed
 * strategy exposes no other source getter). That inner vault is a standard Yearn
 * V3 vault listed on yDaemon, so its live `apr.netAPR` is the strategy's
 * gross/donation-funding rate surfaced on `/vaults`.
 */
const PILOT_YEARN_V3_WETH_SOURCE = {
  address: "0xc56413869c6CDf96496f2b1eF801fEDBdFA7dDB0",
  kind: "yearn-v3",
  chainId: OCTANT_V2_ETHEREUM_CHAIN_ID,
} as const satisfies OctantVaultYieldSource;

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
    campaignCopy: greenpillNycPreviewCopy,
    recipientRoutingSummary:
      "Contributions deposit into the Greenpill NYC Octant vault; generated yield supports local civic tech initiatives surfaced via Decentral Park.",
    vault: {
      chainId: OCTANT_V2_ETHEREUM_CHAIN_ID,
      vaultAddress: "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5",
      vaultName: "Greenpill NYC",
      vaultSymbol: "gpWETH",
      vaultDecimals: 18,
      asset: WETH_ASSET_MANIFEST,
      explorerLink: "https://etherscan.io/address/0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5",
      strategyFactory: PILOT_STRATEGY_FACTORY_CREATOR,
      yieldSource: PILOT_YEARN_V3_WETH_SOURCE,
    },
    requiredManifestFields: GREENPILL_NYC_REQUIRED_MANIFEST_FIELDS,
  },
  {
    slug: "evmavericks",
    displayName: "EVMavericks Fantasy Football League",
    communityName: "EVMavericks",
    fixtureRole: "standard_campaign",
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
      yieldSource: PILOT_YEARN_V3_WETH_SOURCE,
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

function unique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function hasPositiveShareBalance(value: OctantVaultShareOwnershipProofInput["shareBalance"]) {
  if (typeof value === "bigint") return value > 0n;
  if (typeof value === "number") return Number.isInteger(value) && value > 0;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return false;
  return BigInt(value) > 0n;
}

function hasPositiveBaseUnitAmount(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value) && BigInt(value) > 0n;
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

export function getOctantVaultAssetDisplayPolicy(
  symbol: string | null | undefined
): OctantVaultAssetDisplayPolicy {
  const technicalSymbol = symbol?.trim() || "tokens";
  if (technicalSymbol.toUpperCase() === "WETH") {
    return {
      donorSymbol: "ETH",
      settlementSymbol: "WETH",
      technicalSymbol: "WETH",
    };
  }

  return {
    donorSymbol: technicalSymbol,
    settlementSymbol: technicalSymbol,
    technicalSymbol,
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

const WALLET_ENDOW_REQUIRED_MANIFEST_FIELDS = [
  "chainId",
  "vaultAddress",
  "assetAddress",
  "assetSymbol",
  "assetDecimals",
  "explorerLink",
] as const satisfies readonly OctantVaultManifestField[];

const CARD_ENDOW_REQUIRED_MANIFEST_FIELDS = WALLET_ENDOW_REQUIRED_MANIFEST_FIELDS;

/**
 * Stripe/Coinbase onramp minimum buyer amount in USD cents ($2.00). Below this,
 * `Bridge.Onramp.prepare` fails for every configured provider, so the checkout
 * amount step must gate card payments before any provider session is attempted.
 */
export const OCTANT_VAULT_CARD_ENDOW_MIN_USD_CENTS = 200n;

/** True when a parsed USD-cents amount satisfies the card onramp provider minimum. */
export function meetsOctantVaultCardEndowUsdMinimum(usdCents: bigint | null): boolean {
  return usdCents !== null && usdCents >= OCTANT_VAULT_CARD_ENDOW_MIN_USD_CENTS;
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

export function validateOctantVaultWalletEndowManifest(
  campaign: OctantVaultCampaignManifest
): OctantVaultCampaignManifestValidation {
  const missingFields = WALLET_ENDOW_REQUIRED_MANIFEST_FIELDS.filter(
    (field) => !hasManifestField(campaign, field)
  );

  return {
    status: missingFields.length === 0 ? "complete" : "blocked_pending_manifest",
    missingFields,
  };
}

export function validateOctantVaultCardEndowManifest(
  campaign: OctantVaultCampaignManifest
): OctantVaultCampaignManifestValidation {
  const missingFields = CARD_ENDOW_REQUIRED_MANIFEST_FIELDS.filter(
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

/**
 * Exact-route proof for a prepared card onramp quote. A Card Endow checkout
 * session may only be accepted when the provider quote funds the exact chain,
 * vault asset (WETH for the pilots), recovered receiver, and base-unit amount
 * this endowment expects. Any mismatch blocks the session before checkout.
 */
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

/**
 * Card Endow settlement may start only on a `COMPLETED` onramp status whose
 * echoed purchase/session tuple does not contradict the expected route. Absent
 * tuple fields cannot contradict; present fields must match exactly.
 */
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

/**
 * Funding-balance proof: the recovered wallet's vault-asset (WETH) balance must
 * cover the expected base-unit amount before approve/deposit may begin.
 */
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

function cloneCampaign(campaign: OctantVaultCampaignManifest): OctantVaultCampaignManifest {
  return {
    ...campaign,
    campaignCopy: campaign.campaignCopy ? { ...campaign.campaignCopy } : undefined,
    previewCopy: campaign.previewCopy ? { ...campaign.previewCopy } : undefined,
    requiredManifestFields: campaign.requiredManifestFields
      ? [...campaign.requiredManifestFields]
      : undefined,
    vault: campaign.vault
      ? {
          ...campaign.vault,
          asset: campaign.vault.asset ? { ...campaign.vault.asset } : undefined,
          strategyFactory: campaign.vault.strategyFactory
            ? { ...campaign.vault.strategyFactory }
            : undefined,
          yieldSource: campaign.vault.yieldSource ? { ...campaign.vault.yieldSource } : undefined,
          yieldStrategy: campaign.vault.yieldStrategy
            ? { ...campaign.vault.yieldStrategy }
            : undefined,
        }
      : undefined,
  };
}

export function getOctantVaultCampaigns(): OctantVaultCampaignManifest[] {
  return OCTANT_VAULT_CAMPAIGN_MANIFEST.map(cloneCampaign);
}

export function getOctantVaultCampaignBySlug(
  slug: OctantVaultCampaignSlug
): OctantVaultCampaignManifest | undefined {
  const campaign = OCTANT_VAULT_CAMPAIGN_MANIFEST.find((entry) => entry.slug === slug);
  return campaign ? cloneCampaign(campaign) : undefined;
}

export function getOctantVaultCampaignCopyMessageIds(
  campaign: OctantVaultCampaignManifest
): OctantVaultCampaignCopyMessageIds | undefined {
  return isKnownOctantVaultCampaignSlug(campaign.slug)
    ? OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS[campaign.slug]
    : undefined;
}

export function getOctantVaultCampaignCopy(
  campaign: OctantVaultCampaignManifest
): OctantVaultCampaignCopy {
  return (
    campaign.campaignCopy ??
    campaign.previewCopy ?? {
      headline: campaign.displayName,
      summary: enMessage(OCTANT_VAULT_CAMPAIGN_COPY_FALLBACK_MESSAGE_IDS.summary),
      fundingPurpose: enMessage(OCTANT_VAULT_CAMPAIGN_COPY_FALLBACK_MESSAGE_IDS.fundingPurpose),
      recipientLogic: enMessage(OCTANT_VAULT_CAMPAIGN_COPY_FALLBACK_MESSAGE_IDS.recipientLogic),
      riskNote: enMessage(OCTANT_VAULT_CAMPAIGN_COPY_FALLBACK_MESSAGE_IDS.riskNote),
    }
  );
}
