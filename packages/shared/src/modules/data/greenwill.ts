import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import type {
  GreenWillBadgeDefinition,
  GreenWillBadgeGrant,
  GreenWillBadgeId,
  GreenWillBadgeOwnership,
  GreenWillSourceRef,
} from "../../types/greenwill";
import { normalizeAddress } from "../../utils/blockchain/address";
import { logger } from "../app/logger";
import { greenGoodsIndexer } from "./graphql-client";

const GREENWILL_BADGE_DEFINITION_QUERY = /* GraphQL */ `
  query GreenWillBadgeDefinitions($chainId: Int!) {
    GreenWillBadgeDefinition(
      where: { chainId: { _eq: $chainId } }
      order_by: [{ active: desc }, { holderCount: desc }, { slug: asc }]
    ) {
      id
      chainId
      badgeId
      slug
      metadataURI
      validator
      authorizedIssuer
      unlockLock
      claimable
      active
      holderCount
      grantCount
      updatedAt
    }
  }
`;

const GREENWILL_BADGE_OWNERSHIP_QUERY = /* GraphQL */ `
  query GreenWillBadgeOwnershipByOwner($chainId: Int!, $owner: String!) {
    GreenWillBadgeOwnership(
      where: { chainId: { _eq: $chainId }, owner: { _eq: $owner } }
      order_by: { issuedAt: desc }
    ) {
      id
      chainId
      badgeId
      owner
      sourceRef
      issuer
      unlockTokenId
      issuedAt
      definitionId
      lastGrantId
    }
  }
`;

const GREENWILL_RECENT_GRANTS_QUERY = /* GraphQL */ `
  query GreenWillRecentGrants($chainId: Int!, $limit: Int!) {
    GreenWillBadgeGrant(
      where: { chainId: { _eq: $chainId } }
      order_by: { timestamp: desc }
      limit: $limit
    ) {
      id
      chainId
      badgeId
      owner
      sourceRef
      issuer
      unlockTokenId
      txHash
      timestamp
    }
  }
`;

interface GreenWillBadgeDefinitionResponse {
  GreenWillBadgeDefinition?: Array<{
    id: string;
    chainId: number;
    badgeId: string;
    slug: string;
    metadataURI: string | null;
    validator: string;
    authorizedIssuer: string;
    unlockLock: string;
    claimable: boolean | null;
    active: boolean | null;
    holderCount: number | string | null;
    grantCount: number | string | null;
    updatedAt: number | null;
  }>;
}

interface GreenWillBadgeOwnershipResponse {
  GreenWillBadgeOwnership?: Array<{
    id: string;
    chainId: number;
    badgeId: string;
    owner: string;
    sourceRef: string;
    issuer: string;
    unlockTokenId: number | string | bigint | null;
    issuedAt: number | null;
    definitionId: string;
    lastGrantId: string;
  }>;
}

interface GreenWillBadgeGrantResponse {
  GreenWillBadgeGrant?: Array<{
    id: string;
    chainId: number;
    badgeId: string;
    owner: string;
    sourceRef: string;
    issuer: string;
    unlockTokenId: number | string | bigint | null;
    txHash: string;
    timestamp: number | null;
  }>;
}

function toBigInt(value: bigint | number | string | null | undefined): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && value.length > 0) return BigInt(value);
  return 0n;
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.length > 0) return Number(value);
  return 0;
}

function normalizeHex(value: string): `0x${string}` {
  return value.toLowerCase() as `0x${string}`;
}

function mapBadgeDefinition(
  definition: NonNullable<GreenWillBadgeDefinitionResponse["GreenWillBadgeDefinition"]>[number]
): GreenWillBadgeDefinition {
  return {
    id: definition.id,
    chainId: definition.chainId,
    badgeId: normalizeHex(definition.badgeId) as GreenWillBadgeId,
    slug: definition.slug,
    metadataURI: definition.metadataURI ?? "",
    validator: normalizeAddress(definition.validator) as GreenWillBadgeDefinition["validator"],
    authorizedIssuer: normalizeAddress(
      definition.authorizedIssuer
    ) as GreenWillBadgeDefinition["authorizedIssuer"],
    unlockLock: normalizeAddress(definition.unlockLock) as GreenWillBadgeDefinition["unlockLock"],
    claimable: Boolean(definition.claimable),
    active: Boolean(definition.active),
    holderCount: toNumber(definition.holderCount),
    grantCount: toNumber(definition.grantCount),
    updatedAt: definition.updatedAt ?? 0,
  };
}

function mapBadgeOwnership(
  ownership: NonNullable<GreenWillBadgeOwnershipResponse["GreenWillBadgeOwnership"]>[number]
): GreenWillBadgeOwnership {
  return {
    id: ownership.id,
    chainId: ownership.chainId,
    badgeId: normalizeHex(ownership.badgeId) as GreenWillBadgeId,
    owner: normalizeAddress(ownership.owner) as GreenWillBadgeOwnership["owner"],
    sourceRef: normalizeHex(ownership.sourceRef) as GreenWillSourceRef,
    issuer: normalizeAddress(ownership.issuer) as GreenWillBadgeOwnership["issuer"],
    unlockTokenId: toBigInt(ownership.unlockTokenId),
    issuedAt: ownership.issuedAt ?? 0,
    definitionId: ownership.definitionId,
    lastGrantId: ownership.lastGrantId,
  };
}

function mapBadgeGrant(
  grant: NonNullable<GreenWillBadgeGrantResponse["GreenWillBadgeGrant"]>[number]
): GreenWillBadgeGrant {
  return {
    id: grant.id,
    chainId: grant.chainId,
    badgeId: normalizeHex(grant.badgeId) as GreenWillBadgeId,
    owner: normalizeAddress(grant.owner) as GreenWillBadgeGrant["owner"],
    sourceRef: normalizeHex(grant.sourceRef) as GreenWillSourceRef,
    issuer: normalizeAddress(grant.issuer) as GreenWillBadgeGrant["issuer"],
    unlockTokenId: toBigInt(grant.unlockTokenId),
    txHash: normalizeHex(grant.txHash),
    timestamp: grant.timestamp ?? 0,
  };
}

export async function getGreenWillBadgeDefinitions(
  chainId: number = DEFAULT_CHAIN_ID
): Promise<GreenWillBadgeDefinition[]> {
  const { data, error } = await greenGoodsIndexer.query<GreenWillBadgeDefinitionResponse>(
    GREENWILL_BADGE_DEFINITION_QUERY,
    { chainId },
    "getGreenWillBadgeDefinitions"
  );

  if (error) {
    logger.error("[getGreenWillBadgeDefinitions] Indexer query failed", {
      chainId,
      error: error.message,
    });
    throw new Error(`Failed to load GreenWill badge definitions: ${error.message}`);
  }

  return (data?.GreenWillBadgeDefinition ?? []).map(mapBadgeDefinition);
}

export async function getGreenWillBadgesByOwner(
  owner: string,
  chainId: number = DEFAULT_CHAIN_ID
): Promise<GreenWillBadgeOwnership[]> {
  const normalizedOwner = owner.toLowerCase();
  const { data, error } = await greenGoodsIndexer.query<GreenWillBadgeOwnershipResponse>(
    GREENWILL_BADGE_OWNERSHIP_QUERY,
    { chainId, owner: normalizedOwner },
    "getGreenWillBadgesByOwner"
  );

  if (error) {
    logger.error("[getGreenWillBadgesByOwner] Indexer query failed", {
      chainId,
      owner: normalizedOwner,
      error: error.message,
    });
    throw new Error(`Failed to load GreenWill ownership: ${error.message}`);
  }

  return (data?.GreenWillBadgeOwnership ?? []).map(mapBadgeOwnership);
}

export async function getGreenWillRecentGrants(
  chainId: number = DEFAULT_CHAIN_ID,
  limit = 20
): Promise<GreenWillBadgeGrant[]> {
  const { data, error } = await greenGoodsIndexer.query<GreenWillBadgeGrantResponse>(
    GREENWILL_RECENT_GRANTS_QUERY,
    { chainId, limit },
    "getGreenWillRecentGrants"
  );

  if (error) {
    logger.error("[getGreenWillRecentGrants] Indexer query failed", {
      chainId,
      limit,
      error: error.message,
    });
    throw new Error(`Failed to load GreenWill recent grants: ${error.message}`);
  }

  return (data?.GreenWillBadgeGrant ?? []).map(mapBadgeGrant);
}
