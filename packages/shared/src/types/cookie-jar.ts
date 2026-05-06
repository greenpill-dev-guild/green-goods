import type { Address } from "./domain";

export interface CookieJar {
  jarAddress: Address;
  gardenAddress: Address;
  assetAddress: Address;
  balance: bigint;
  currency: Address;
  decimals: number;
  maxWithdrawal: bigint;
  withdrawalInterval: bigint;
  minDeposit: bigint;
  isPaused: boolean;
  emergencyWithdrawalEnabled: boolean;
}

export type CookieJarAccessType = "allowlist" | "erc721" | "erc1155" | "unknown";
export type CookieJarWithdrawalType = "fixed" | "variable" | "unknown";
export type CampaignCookieJarOperatorPolicy = "one-operator-per-garden";

export interface CampaignCookieJarMetadata {
  kind: "green-goods.campaign-cookie-jar";
  version: 1;
  slug: string;
  title: string;
  description?: string;
  image?: string;
  externalUrl?: string;
  sourceGardens: Address[];
  operatorPolicy: CampaignCookieJarOperatorPolicy;
  extraAllowlist: Address[];
  chainId: number;
  createdAt: number;
}

export interface CampaignCookieJar extends Omit<CookieJar, "gardenAddress"> {
  metadata: CampaignCookieJarMetadata | null;
  rawMetadata: string;
  symbol: string;
  accessType: CookieJarAccessType;
  withdrawalType: CookieJarWithdrawalType;
  fixedAmount: bigint;
  oneTimeWithdrawal: boolean;
  strictPurpose: boolean;
  allowlist: Address[];
  isEligible: boolean;
  isOwner: boolean;
  lastWithdrawalTime: bigint;
  totalWithdrawn: bigint;
  canClaimNow: boolean;
  nextClaimAt: number | null;
}

export interface IndexedCampaignCookieJar {
  id: string;
  chainId: number;
  factoryAddress: Address;
  jarAddress: Address;
  creator: Address;
  rawMetadata: string;
  metadataKind?: string | null;
  metadataVersion?: number | null;
  slug?: string | null;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  externalUrl?: string | null;
  sourceGardens: Address[];
  operatorPolicy?: string | null;
  extraAllowlist: Address[];
  isValidCampaign: boolean;
  createdAt: number;
  metadataUpdatedAt: number;
  txHash: string;
}

export interface CampaignCookieJarCampaign {
  address: Address;
  jarAddress: Address;
  slug: string;
  label: string;
  title: string;
  metadata: CampaignCookieJarMetadata | null;
  rawMetadata: string;
  creator?: Address;
  createdAt?: number;
  source: "indexed" | "fallback" | "direct";
}

export interface CampaignCookieJarOperatorSource {
  gardenAddress: Address;
  gardenName: string;
  gardenSlug: string;
  selectedOperator: Address | null;
  operators: Address[];
}

export interface CampaignCookieJarOperatorAggregation {
  allowlist: Address[];
  invalidAddresses: string[];
  sources: CampaignCookieJarOperatorSource[];
  missingOperatorGardens: CampaignCookieJarOperatorSource[];
  extraAllowlist: Address[];
}

export interface CreateCampaignCookieJarParams {
  factoryAddress: Address;
  title: string;
  slug: string;
  description?: string;
  image?: string;
  externalUrl?: string;
  tokenAddress: Address;
  jarOwner: Address;
  allowlist: Address[];
  sourceGardens: Address[];
  extraAllowlist: Address[];
  fixedAmount: bigint;
  maxWithdrawal: bigint;
  withdrawalInterval: bigint;
  minDeposit: bigint;
  oneTimeWithdrawal: boolean;
  strictPurpose: boolean;
  withdrawalType: Exclude<CookieJarWithdrawalType, "unknown">;
}

export interface SyncCampaignCookieJarAllowlistParams {
  jarAddress: Address;
  grant: Address[];
  revoke: Address[];
}

export interface CookieJarWithdrawParams {
  jarAddress: Address;
  amount: bigint;
  purpose: string;
}

export interface CookieJarDepositParams {
  jarAddress: Address;
  amount: bigint;
  assetAddress: Address;
}

export interface CookieJarAdminParams {
  jarAddress: Address;
}

export interface CookieJarUpdateMaxWithdrawalParams {
  jarAddress: Address;
  maxWithdrawal: bigint;
}

export interface CookieJarUpdateIntervalParams {
  jarAddress: Address;
  withdrawalInterval: bigint;
}

export interface CookieJarEmergencyWithdrawParams {
  jarAddress: Address;
  tokenAddress: Address;
  amount: bigint;
}
