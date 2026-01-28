import type { Address } from "viem";

import { logger } from "../app/logger";
import {
  ACTION_DOMAINS,
  type ActionDomain,
  type ActionType,
  type AttestationFilters,
  type HypercertAttestation,
  type HypercertRecord,
  type HypercertStatus,
  type MetricValue,
} from "../../types/hypercerts";
import type { EASWorkApproval } from "../../types/eas-responses";
import { greenGoodsIndexer, GQLClient } from "./graphql-client";
import { getWorks, getWorkApprovals, getWorkApprovalsByUIDs, getWorksByUIDs } from "./eas";

// =============================================================================
// Hypercerts SDK API Client
// =============================================================================

/**
 * Official Hypercerts API endpoints.
 * These are the canonical indexers maintained by the Hypercerts team.
 */
const HYPERCERTS_API_ENDPOINTS = {
  production: "https://api-v2.hypercerts.org",
  test: "https://staging-api-v2.hypercerts.org",
} as const;

/** Get the Hypercerts API URL based on chain ID */
function getHypercertsApiUrl(chainId?: number): string {
  // Test chains use staging API
  const testChains = [11155111, 84532, 421614, 314159];
  const isTestChain = chainId ? testChains.includes(chainId) : false;
  return isTestChain ? HYPERCERTS_API_ENDPOINTS.test : HYPERCERTS_API_ENDPOINTS.production;
}

/** Singleton Hypercerts SDK API client */
let hypercertsApiClient: GQLClient | null = null;

function getHypercertsApiClient(chainId?: number): GQLClient {
  const url = `${getHypercertsApiUrl(chainId)}/v1/graphql`;
  // Create new client if URL changed or not initialized
  if (!hypercertsApiClient) {
    hypercertsApiClient = new GQLClient(url);
  }
  return hypercertsApiClient;
}

/**
 * GraphQL query for fetching a hypercert from the official Hypercerts API.
 * The API uses a different schema than our Envio indexer.
 */
const SDK_HYPERCERT_QUERY = /* GraphQL */ `
  query GetHypercert($hypercert_id: String!) {
    hypercerts(where: { hypercert_id: { eq: $hypercert_id } }) {
      data {
        hypercert_id
        units
        uri
        creator_address
        creation_block_timestamp
        token_id
        contracts {
          chain_id
          contract_address
        }
        metadata {
          name
          description
          image
          work_scope
        }
      }
    }
  }
`;

interface SdkHypercertResponse {
  hypercerts?: {
    data?: Array<{
      hypercert_id: string;
      units: string;
      uri: string;
      creator_address: string;
      creation_block_timestamp: string;
      token_id: string;
      contracts?: {
        chain_id: number;
        contract_address: string;
      };
      metadata?: {
        name?: string;
        description?: string;
        image?: string;
        work_scope?: string[];
      };
    }>;
  };
}

/**
 * Fetches a hypercert from the official Hypercerts SDK API.
 * This is faster and more reliable than custom indexers for hypercert data.
 *
 * @param hypercertId - Format: "{chainId}-{tokenId}" e.g., "84532-123456789"
 * @returns Partial HypercertRecord with data from SDK API, or null if not found
 */
export async function getHypercertFromSdkApi(
  hypercertId: string
): Promise<Partial<HypercertRecord> | null> {
  // Extract chain ID from hypercert ID for API endpoint selection
  const [chainIdStr] = hypercertId.split("-");
  const chainId = chainIdStr ? parseInt(chainIdStr, 10) : undefined;

  const client = getHypercertsApiClient(chainId);
  const { data, error } = await client.query<SdkHypercertResponse>(
    SDK_HYPERCERT_QUERY,
    { hypercert_id: hypercertId },
    "getHypercertFromSdkApi"
  );

  if (error) {
    logger.debug("[getHypercertFromSdkApi] SDK API query failed", {
      hypercertId,
      error: error.message,
    });
    return null;
  }

  const items = data?.hypercerts?.data;
  if (!items || items.length === 0) {
    logger.debug("[getHypercertFromSdkApi] Hypercert not found in SDK API", { hypercertId });
    return null;
  }

  const item = items[0];
  const tokenIdBigInt = BigInt(item.token_id ?? "0");

  return {
    id: item.hypercert_id,
    tokenId: tokenIdBigInt,
    metadataUri: item.uri,
    mintedAt: item.creation_block_timestamp
      ? Math.floor(new Date(item.creation_block_timestamp).getTime() / 1000)
      : 0,
    mintedBy: item.creator_address as Address,
    totalUnits: BigInt(item.units ?? "0"),
    title: item.metadata?.name ?? undefined,
    description: item.metadata?.description ?? undefined,
    imageUri: item.metadata?.image ?? undefined,
    workScopes: item.metadata?.work_scope ?? undefined,
    // These fields require our Envio indexer or additional queries
    gardenId: "",
    txHash: "0x" as `0x${string}`,
    claimedUnits: 0n,
    attestationCount: 0,
    status: "active" as HypercertStatus,
  };
}

const GARDEN_HYPERCERTS_QUERY = /* GraphQL */ `
  query GardenHypercerts($gardenId: ID!, $limit: Int!) {
    Hypercert(
      where: { garden: { _eq: $gardenId } }
      order_by: { mintedAt: desc }
      limit: $limit
    ) {
      id
      tokenId
      metadataUri
      totalUnits
      mintedBy
      mintedAt
      txHash
      claimedUnits
      attestationCount
      attestationUIDs
      title
      description
      imageUri
      workScopes
      status
      garden
    }
  }
`;

// Separate query for claims (Envio doesn't support entity arrays, use foreign key lookup)
const HYPERCERT_CLAIMS_QUERY = /* GraphQL */ `
  query HypercertClaims($hypercertId: String!, $limit: Int!) {
    HypercertClaim(
      where: { hypercertId: { _eq: $hypercertId } }
      order_by: { claimedAt: desc }
      limit: $limit
    ) {
      id
      claimant
      units
      claimedAt
      txHash
    }
  }
`;

const HYPERCERT_DETAIL_QUERY = /* GraphQL */ `
  query HypercertDetail($id: ID!) {
    Hypercert(where: { id: { _eq: $id } }, limit: 1) {
      id
      tokenId
      metadataUri
      totalUnits
      mintedBy
      mintedAt
      txHash
      claimedUnits
      attestationCount
      attestationUIDs
      title
      description
      imageUri
      workScopes
      status
      garden
    }
  }
`;

// Note: WorkApproval in Envio has hypercertId field (string | null) for bundle tracking
// but we check bundling status by looking up attestationUIDs in the Hypercert entity

export function applyAttestationFilters(
  items: HypercertAttestation[],
  filters?: AttestationFilters
): HypercertAttestation[] {
  if (!filters) return items;

  return items.filter((attestation) => {
    const startDate =
      filters.startDate instanceof Date
        ? Math.floor(filters.startDate.getTime() / 1000)
        : (filters.startDate ?? null);
    const endDate =
      filters.endDate instanceof Date
        ? Math.floor(filters.endDate.getTime() / 1000)
        : (filters.endDate ?? null);

    if (startDate && attestation.approvedAt < startDate) return false;
    if (endDate && attestation.approvedAt > endDate) return false;

    if (filters.domain && attestation.domain !== filters.domain) {
      return false;
    }

    if (filters.actionType && attestation.actionType !== filters.actionType) {
      return false;
    }

    if (filters.workScope) {
      const scopes = attestation.workScope ?? [];
      if (!scopes.includes(filters.workScope)) return false;
    }

    if (filters.gardenerAddress) {
      const address = attestation.gardenerAddress.toLowerCase();
      if (address !== filters.gardenerAddress.toLowerCase()) return false;
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const haystack = [
        attestation.title,
        attestation.gardenerName ?? "",
        attestation.gardenerAddress,
        attestation.domain ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function extractWorkMetadata(metadata: string | undefined): {
  domain?: ActionDomain;
  actionType?: ActionType;
  workScope?: string[];
  metrics?: Record<string, MetricValue>;
} {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata) as unknown;
    if (!isRecord(parsed)) return {};

    const domainRaw = parsed.domain ?? parsed.actionDomain;
    const domain = ACTION_DOMAINS.includes(domainRaw as ActionDomain)
      ? (domainRaw as ActionDomain)
      : undefined;

    const actionType =
      typeof parsed.actionType === "string" ? (parsed.actionType as ActionType) : undefined;

    const scopeCandidate = parsed.workScope ?? parsed.workScopes ?? parsed.work_scope;
    const workScope =
      Array.isArray(scopeCandidate) && scopeCandidate.every((item) => typeof item === "string")
        ? (scopeCandidate as string[])
        : typeof scopeCandidate === "string"
          ? [scopeCandidate]
          : undefined;

    const metrics = isRecord(parsed.metrics)
      ? (parsed.metrics as Record<string, MetricValue>)
      : undefined;

    return { domain, actionType, workScope, metrics };
  } catch {
    return {};
  }
}

function normalizeHypercertStatus(status?: string | null): HypercertStatus {
  switch ((status || "").toLowerCase()) {
    case "active":
      return "active";
    case "claimed":
      return "claimed";
    case "sold":
      return "sold";
    default:
      return "unknown";
  }
}

/**
 * Fetches approved work attestations for a garden from EAS.
 *
 * This function queries the EAS indexer (not Envio) to get:
 * 1. All work submissions for the garden
 * 2. All approved work approvals
 * 3. Joins them to create HypercertAttestation objects
 *
 * @param gardenId - The garden address to fetch attestations for
 * @param filters - Optional filters for date range, domain, etc.
 * @param _limit - Unused, kept for API compatibility
 * @returns Array of approved work attestations ready for bundling into hypercerts
 */
export async function getApprovedAttestations(
  gardenId: string,
  filters?: AttestationFilters,
  _limit = 100
): Promise<HypercertAttestation[]> {
  try {
    // Fetch works and approvals in parallel from EAS
    const [works, allApprovals] = await Promise.all([getWorks(gardenId), getWorkApprovals()]);

    // Filter to only approved work approvals
    const approvedApprovals = allApprovals.filter((approval) => approval.approved);

    // Create a map of workUID -> approval for O(1) lookups
    const approvalsByWorkUID = new Map<string, EASWorkApproval>();
    for (const approval of approvedApprovals) {
      approvalsByWorkUID.set(approval.workUID, approval);
    }

    // Join works with their approvals
    const attestations: HypercertAttestation[] = [];

    for (const work of works) {
      const approval = approvalsByWorkUID.get(work.id);
      if (!approval) continue; // Skip works without approval

      const metadata = extractWorkMetadata(work.metadata);

      attestations.push({
        id: approval.id,
        uid: approval.id,
        workUid: work.id,
        gardenId: work.gardenAddress,
        title: work.title || "Untitled work",
        actionType: metadata.actionType,
        domain: metadata.domain,
        workScope: metadata.workScope ?? [],
        gardenerAddress: work.gardenerAddress as Address,
        gardenerName: null, // ENS lookup would need separate query
        mediaUrls: work.media ?? [],
        metrics: metadata.metrics ?? null,
        createdAt: work.createdAt,
        approvedAt: approval.createdAt,
        approvedBy: approval.operatorAddress as Address,
        feedback: approval.feedback || null,
      });
    }

    // Sort by approvedAt descending (most recent first)
    attestations.sort((a, b) => b.approvedAt - a.approvedAt);

    return applyAttestationFilters(attestations, filters);
  } catch (error) {
    logger.error("Failed to fetch approved attestations from EAS", {
      source: "getApprovedAttestations",
      gardenId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

/**
 * Fetches specific attestations by their UIDs.
 * More efficient than getApprovedAttestations when you have specific UIDs to fetch.
 *
 * @param uids - Array of attestation UIDs (work approval UIDs) to fetch
 * @returns Array of approved work attestations matching the UIDs
 */
export async function getAttestationsByUIDs(uids: string[]): Promise<HypercertAttestation[]> {
  if (uids.length === 0) return [];

  try {
    // Fetch only the specific approvals by UID
    const approvals = await getWorkApprovalsByUIDs(uids);
    if (approvals.length === 0) return [];

    // Filter to only approved ones
    const approvedApprovals = approvals.filter((approval) => approval.approved);
    if (approvedApprovals.length === 0) return [];

    // Get the work UIDs we need
    const workUIDs = approvedApprovals.map((a) => a.workUID);
    const works = await getWorksByUIDs(workUIDs);

    // Create lookup map
    const worksByUID = new Map(works.map((w) => [w.id, w]));

    // Build attestations
    const attestations: HypercertAttestation[] = [];
    for (const approval of approvedApprovals) {
      const work = worksByUID.get(approval.workUID);
      if (!work) continue;

      const metadata = extractWorkMetadata(work.metadata);
      attestations.push({
        id: approval.id,
        uid: approval.id,
        workUid: work.id,
        gardenId: work.gardenAddress,
        title: work.title || "Untitled work",
        actionType: metadata.actionType,
        domain: metadata.domain,
        workScope: metadata.workScope ?? [],
        gardenerAddress: work.gardenerAddress as Address,
        gardenerName: null, // ENS lookup would need separate query
        mediaUrls: work.media ?? [],
        metrics: metadata.metrics ?? null,
        createdAt: work.createdAt,
        approvedAt: approval.createdAt,
        approvedBy: approval.operatorAddress as Address,
        feedback: approval.feedback || null,
      });
    }

    // Sort by approvedAt descending (most recent first) to match getApprovedAttestations behavior
    attestations.sort((a, b) => b.approvedAt - a.approvedAt);

    return attestations;
  } catch (error) {
    logger.error("Failed to fetch attestations by UIDs from EAS", {
      source: "getAttestationsByUIDs",
      uidCount: uids.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Fetches claims for a specific hypercert.
 * Envio doesn't support entity arrays, so we query HypercertClaim separately.
 */
export async function getHypercertClaims(
  hypercertId: string,
  limit = 100
): Promise<
  { id: string; claimant: Address; units: bigint; claimedAt: number; txHash: `0x${string}` }[]
> {
  const { data, error } = await greenGoodsIndexer.query(
    HYPERCERT_CLAIMS_QUERY,
    { hypercertId, limit },
    "getHypercertClaims"
  );

  if (error) {
    logger.error("Indexer query failed", {
      source: "getHypercertClaims",
      hypercertId,
      limit,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  const claims = (data as { HypercertClaim?: unknown[] } | undefined)?.HypercertClaim;
  if (!claims || !Array.isArray(claims)) return [];

  return claims.map((claim) => {
    const claimRecord = claim as Record<string, unknown>;
    return {
      id: String(claimRecord.id ?? ""),
      claimant: claimRecord.claimant as Address,
      units: BigInt((claimRecord.units as string | number | bigint | undefined) ?? 0),
      claimedAt: Number(claimRecord.claimedAt ?? 0),
      txHash: claimRecord.txHash as `0x${string}`,
    };
  });
}

export async function getGardenHypercerts(
  gardenId: string,
  status?: HypercertStatus,
  limit = 50
): Promise<HypercertRecord[]> {
  const { data, error } = await greenGoodsIndexer.query(
    GARDEN_HYPERCERTS_QUERY,
    { gardenId, limit },
    "getGardenHypercerts"
  );

  if (error) {
    logger.error("Indexer query failed", {
      source: "getGardenHypercerts",
      gardenId,
      status,
      limit,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  const items = (data as { Hypercert?: unknown[] } | undefined)?.Hypercert;
  if (!items || !Array.isArray(items)) return [];

  const records = items
    .map((item) => {
      const record = item as Record<string, unknown>;
      const recordStatus = normalizeHypercertStatus(record.status as string | null | undefined);

      return {
        id: String(record.id ?? ""),
        tokenId: BigInt((record.tokenId as string | number | bigint | undefined) ?? 0),
        gardenId: (record.garden as string | undefined) ?? gardenId,
        metadataUri: String(record.metadataUri ?? ""),
        imageUri: record.imageUri ? String(record.imageUri) : undefined,
        mintedAt: Number(record.mintedAt ?? 0),
        mintedBy: record.mintedBy as Address,
        txHash: record.txHash as `0x${string}`,
        totalUnits: BigInt((record.totalUnits as string | number | bigint | undefined) ?? 0),
        claimedUnits: BigInt((record.claimedUnits as string | number | bigint | undefined) ?? 0),
        attestationCount: Number(record.attestationCount ?? 0),
        attestationUIDs: (record.attestationUIDs as string[] | null | undefined) ?? undefined,
        title: record.title ? String(record.title) : undefined,
        description: record.description ? String(record.description) : undefined,
        workScopes: (record.workScopes as string[] | null | undefined) ?? undefined,
        status: recordStatus,
        // Note: Claims are fetched separately via getHypercertClaims() due to Envio schema constraints
        allowlistEntries: [],
      } satisfies HypercertRecord;
    })
    .filter((record) => record.metadataUri && record.id.length > 0 && record.tokenId >= 0n);

  return status ? records.filter((record) => record.status === status) : records;
}

/**
 * Fetches a hypercert by ID from Envio indexer.
 *
 * Note: Attestation data is stored as UIDs only in the Envio schema.
 * To get full attestation details, use getApprovedAttestations() with the garden ID.
 */
export async function getHypercertById(hypercertId: string): Promise<HypercertRecord | null> {
  const { data, error } = await greenGoodsIndexer.query(
    HYPERCERT_DETAIL_QUERY,
    { id: hypercertId },
    "getHypercertById"
  );

  if (error) {
    logger.error("Indexer query failed", {
      source: "getHypercertById",
      hypercertId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  const items = (data as { Hypercert?: unknown[] } | undefined)?.Hypercert;
  if (!items || !Array.isArray(items) || items.length === 0) return null;

  const record = items[0] as Record<string, unknown>;
  const gardenId = (record.garden as string | undefined) ?? "";
  const hypercertIdStr = String(record.id ?? "");

  // Fetch claims separately (Envio doesn't support entity arrays)
  const claims = await getHypercertClaims(hypercertIdStr);

  // attestationUIDs are stored but attestation details must be fetched from EAS
  const attestationUIDs = (record.attestationUIDs as string[] | null | undefined) ?? [];

  let attestations: HypercertAttestation[] | undefined;
  if (attestationUIDs.length > 0) {
    try {
      attestations = await getAttestationsByUIDs(attestationUIDs);
    } catch (error) {
      logger.warn("Failed to hydrate hypercert attestations", {
        source: "getHypercertById",
        hypercertId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    id: hypercertIdStr,
    tokenId: BigInt((record.tokenId as string | number | bigint | undefined) ?? 0),
    gardenId,
    metadataUri: String(record.metadataUri ?? ""),
    imageUri: record.imageUri ? String(record.imageUri) : undefined,
    mintedAt: Number(record.mintedAt ?? 0),
    mintedBy: record.mintedBy as Address,
    txHash: record.txHash as `0x${string}`,
    totalUnits: BigInt((record.totalUnits as string | number | bigint | undefined) ?? 0),
    claimedUnits: BigInt((record.claimedUnits as string | number | bigint | undefined) ?? 0),
    attestationCount: Number(record.attestationCount ?? attestationUIDs.length),
    // Attestations are not populated here - use getApprovedAttestations for full details
    attestations,
    attestationUIDs,
    title: record.title ? String(record.title) : undefined,
    description: record.description ? String(record.description) : undefined,
    workScopes: (record.workScopes as string[] | null | undefined) ?? undefined,
    status: normalizeHypercertStatus(record.status as string | null | undefined),
    allowlistEntries: claims,
  } satisfies HypercertRecord;
}

export interface BundledAttestationInfo {
  uid: string;
  hypercertId: string;
  hypercertTitle?: string | null;
}

/**
 * Checks if any of the given attestation UIDs are already bundled in a hypercert.
 *
 * This uses the Hypercert entity's attestationUIDs list (indexer data) and
 * requires a gardenId to scope the query efficiently.
 */
export async function checkAttestationsBundled(
  uids: string[],
  gardenId: string,
  limit = 200
): Promise<BundledAttestationInfo[]> {
  if (!uids.length || !gardenId) return [];

  const hypercerts = await getGardenHypercerts(gardenId, undefined, limit);
  if (!hypercerts.length) return [];

  const uidSet = new Set(uids);
  const bundledByUid = new Map<string, BundledAttestationInfo>();

  for (const hypercert of hypercerts) {
    const attestationUIDs = hypercert.attestationUIDs ?? [];
    if (!attestationUIDs.length) continue;

    for (const uid of attestationUIDs) {
      if (!uidSet.has(uid) || bundledByUid.has(uid)) continue;
      bundledByUid.set(uid, {
        uid,
        hypercertId: hypercert.id,
        hypercertTitle: hypercert.title ?? null,
      });
    }
  }

  return Array.from(bundledByUid.values());
}
