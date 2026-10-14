import type { Address } from "../../types/domain";
import type { YieldSourceKind } from "../../utils/blockchain/yield-sources";
import type { OctantVaultShareOwnershipProofInput } from "./card-endow";
import type { OctantVaultTransactionHash } from "./card-proofs";
import type { OctantVaultCampaignCopy } from "./copy";

export type KnownOctantVaultCampaignSlug = "greenpill-nyc" | "evmavericks";

export type OctantVaultCampaignSlug = KnownOctantVaultCampaignSlug | (string & {});

export type OctantVaultCampaignFixtureRole =
  | "first_available_transaction_fixture"
  | "blocked_pending_manifest"
  | "standard_campaign";

export type OctantVaultCampaignTargetProtocol = "octant-v2-ethereum";

export const OCTANT_V2_ETHEREUM_CHAIN_ID = 1;

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

export type OctantVaultYieldSourceKind = YieldSourceKind;

export interface OctantVaultYieldSource {
  /** Address of the external yield source the strategy deposits into. */
  address: Address;
  kind: OctantVaultYieldSourceKind;
  /** Chain the source lives on; defaults to the vault chain. */
  chainId?: number;
  /** How the source address was verified (recorded, not inferred at runtime). */
  evidence?: string;
}

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

export function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasAddress(value: unknown): value is Address {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function hasTransactionHash(value: unknown): value is OctantVaultTransactionHash {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}

export function addressesMatch(value: unknown, expected: unknown): boolean {
  return (
    hasAddress(value) && hasAddress(expected) && value.toLowerCase() === expected.toLowerCase()
  );
}

export function transactionHashesMatch(value: unknown, expected: unknown): boolean {
  return (
    hasTransactionHash(value) &&
    hasTransactionHash(expected) &&
    value.toLowerCase() === expected.toLowerCase()
  );
}

export function unique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export function hasPositiveShareBalance(
  value: OctantVaultShareOwnershipProofInput["shareBalance"]
) {
  if (typeof value === "bigint") return value > 0n;
  if (typeof value === "number") return Number.isInteger(value) && value > 0;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return false;
  return BigInt(value) > 0n;
}

export function hasPositiveBaseUnitAmount(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value) && BigInt(value) > 0n;
}

export function hasOctantEthereumChainId(value: unknown): boolean {
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
