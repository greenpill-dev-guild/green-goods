import type { Address } from "./domain";

export type GreenWillBadgeId = `0x${string}`;
export type GreenWillSourceRef = `0x${string}`;
export type GreenWillBadgeSlug = "genesis" | "first-work" | "first-support";

export const GREENWILL_BADGE_IDS = {
  GENESIS: "0x019f6193080fa2ce1eb4082321d3fc1563ca3ee6f96dc5b2092d4bd08cc1b2cb",
  FIRST_WORK: "0xcf9804d3da2c8f716a32449c2b67e5dfa650d9335bc0be6c8a48b9a99ad1efde",
  FIRST_SUPPORT: "0x6fc67c6755ce3ed4ebb1672f2ee106e26f5ba6e37f0f76c2b2541991212dcdc4",
} as const satisfies Record<string, GreenWillBadgeId>;

export const GREENWILL_BADGE_ORDER: readonly GreenWillBadgeSlug[] = [
  "genesis",
  "first-work",
  "first-support",
] as const;

export interface GreenWillBadgeDefinition {
  id: string;
  chainId: number;
  badgeId: GreenWillBadgeId;
  slug: string;
  metadataURI: string;
  // Legacy field name retained to match indexed/onchain surfaces; this is the eligibility source contract.
  validator: Address;
  authorizedIssuer: Address;
  unlockLock: Address;
  claimable: boolean;
  active: boolean;
  holderCount: number;
  grantCount: number;
  updatedAt: number;
}

export interface GreenWillBadgeOwnership {
  id: string;
  chainId: number;
  badgeId: GreenWillBadgeId;
  owner: Address;
  sourceRef: GreenWillSourceRef;
  issuer: Address;
  unlockTokenId: bigint;
  issuedAt: number;
  definitionId: string;
  lastGrantId: string;
}

export interface GreenWillBadgeGrant {
  id: string;
  chainId: number;
  badgeId: GreenWillBadgeId;
  owner: Address;
  sourceRef: GreenWillSourceRef;
  issuer: Address;
  unlockTokenId: bigint;
  txHash: `0x${string}`;
  timestamp: number;
}

export interface GreenWillBadgeView extends GreenWillBadgeDefinition {
  owned: boolean;
  claimableNow: boolean;
  ownership: GreenWillBadgeOwnership | null;
}

export interface GreenWillSupportClaimParams {
  gardenAddress: Address;
  assetAddress: Address;
}
