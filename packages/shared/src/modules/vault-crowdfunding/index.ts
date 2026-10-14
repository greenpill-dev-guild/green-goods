export {
  EVMAVERICKS_REQUIRED_MANIFEST_FIELDS,
  GREENPILL_NYC_REQUIRED_MANIFEST_FIELDS,
  validateOctantVaultCampaignManifest,
  validateOctantVaultCardEndowManifest,
  validateOctantVaultWalletEndowManifest,
} from "./manifest";
export type {
  KnownOctantVaultCampaignSlug,
  OctantVaultCampaignAssetManifest,
  OctantVaultCampaignFixtureRole,
  OctantVaultCampaignManifest,
  OctantVaultCampaignManifestStatus,
  OctantVaultCampaignManifestValidation,
  OctantVaultCampaignSlug,
  OctantVaultCampaignTargetProtocol,
  OctantVaultManifest,
  OctantVaultManifestField,
  OctantVaultStrategyFactoryEvidence,
  OctantVaultYieldSource,
  OctantVaultYieldSourceKind,
  OctantVaultYieldStrategy,
} from "./manifest";
export {
  OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS,
  OCTANT_VAULT_CAMPAIGN_MANIFEST,
  OCTANT_VAULT_MANIFEST_FIELD_LABELS,
  OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS,
  getOctantVaultAssetDisplayPolicy,
  getOctantVaultCampaignBySlug,
  getOctantVaultCampaignCopy,
  getOctantVaultCampaignCopyMessageIds,
  getOctantVaultCampaigns,
} from "./copy";
export type {
  OctantVaultAssetDisplayPolicy,
  OctantVaultCampaignCopy,
  OctantVaultCampaignCopyField,
  OctantVaultCampaignCopyMessageIds,
  OctantVaultManifestFieldLabelMessageIds,
} from "./copy";
export {
  OCTANT_VAULT_CARD_ENDOW_MIN_USD_CENTS,
  hasRequiredOctantVaultFundingBalance,
  meetsOctantVaultCardEndowUsdMinimum,
  validateOctantVaultCardEndowReceiver,
  validateOctantVaultCardOnrampCompletion,
  validateOctantVaultCardOnrampQuote,
  validateOctantVaultShareOwnershipProof,
} from "./card-endow";
export type {
  OctantVaultCardEndowIntentKind,
  OctantVaultCardEndowReceiver,
  OctantVaultCardEndowReceiverCustody,
  OctantVaultCardEndowReceiverInput,
  OctantVaultCardEndowReceiverValidation,
  OctantVaultCardEndowReceiverValidationError,
  OctantVaultCardOnrampCompletionError,
  OctantVaultCardOnrampCompletionExpectation,
  OctantVaultCardOnrampCompletionInput,
  OctantVaultCardOnrampCompletionValidation,
  OctantVaultCardOnrampQuoteError,
  OctantVaultCardOnrampQuoteInput,
  OctantVaultCardOnrampQuoteValidation,
  OctantVaultCardOnrampRouteExpectation,
  OctantVaultCardProvider,
  OctantVaultShareOwnershipProofError,
  OctantVaultShareOwnershipProofInput,
  OctantVaultShareOwnershipProofValidation,
} from "./card-endow";
export {
  prepareOctantVaultCardEndowReadiness,
  validateOctantVaultCardEndowProof,
} from "./card-proofs";
export type {
  OctantVaultCardDonateIntentKind,
  OctantVaultCardDonateProof,
  OctantVaultCardEndowProof,
  OctantVaultCardEndowProofExpectation,
  OctantVaultCardEndowProofInput,
  OctantVaultCardEndowProofValidation,
  OctantVaultCardEndowProofValidationError,
  OctantVaultCardEndowReadiness,
  OctantVaultCardEndowReadinessError,
  OctantVaultCardEndowReadinessInput,
  OctantVaultCardEndowTuple,
  OctantVaultCardProof,
  OctantVaultCardProofAsset,
  OctantVaultCardProofIntentKind,
  OctantVaultTransactionHash,
} from "./card-proofs";
export {
  OCTANT_VAULT_ROUTE_MANAGEMENT_URL,
  getOctantVaultCampaignTransactionState,
  isOctantVaultCampaignTransactionReady,
  prepareOctantVaultCardEndowFallbackPlan,
  validateOctantVaultRouteManageProof,
} from "./route-manage";
export type {
  OctantVaultCampaignTransactionState,
  OctantVaultCardEndowFallbackApprovalTransaction,
  OctantVaultCardEndowFallbackDepositTransaction,
  OctantVaultCardEndowFallbackFundingStep,
  OctantVaultCardEndowFallbackPlan,
  OctantVaultCardEndowFallbackPlanError,
  OctantVaultCardEndowFallbackPlanInput,
  OctantVaultCardEndowFallbackPreparation,
  OctantVaultCardEndowFallbackReceiptExpectation,
  OctantVaultCardEndowFallbackShareVerification,
  OctantVaultCardEndowFallbackTransactionRole,
  OctantVaultCardEndowFallbackUserTransaction,
  OctantVaultRouteManageProofError,
  OctantVaultRouteManageProofInput,
  OctantVaultRouteManageProofValidation,
} from "./route-manage";
export {
  createOctantVaultWalletEndowReceiver,
  prepareOctantVaultWalletEndow,
} from "./wallet-endow";
export type {
  OctantVaultWalletEndowIntentKind,
  OctantVaultWalletEndowPreparation,
  OctantVaultWalletEndowPreparationError,
  OctantVaultWalletEndowPreparationInput,
  OctantVaultWalletEndowPreparedTransaction,
  OctantVaultWalletEndowReceiver,
} from "./wallet-endow";

export type OctantVaultEndowReceiver =
  | import("./wallet-endow").OctantVaultWalletEndowReceiver
  | import("./card-endow").OctantVaultCardEndowReceiver;

export type OctantVaultPaymentMethod = "wallet" | "card";
