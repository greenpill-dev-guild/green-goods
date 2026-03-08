import type { Address } from "viem";
import { Domain, type GardenAssessment } from "../../types/domain";
import type { EASWorkApproval } from "../../types/eas-responses";
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
import { logger } from "../app/logger";
import { getWorkApprovals, getWorkApprovalsByUIDs, getWorks, getWorksByUIDs } from "./eas";
import { GQLClient, greenGoodsIndexer } from "./graphql-client";
import { resolveIPFSUrl } from "./ipfs";

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
  const testChains = [11155111, 421614, 314159];
  const isTestChain = chainId ? testChains.includes(chainId) : false;
  return isTestChain ? HYPERCERTS_API_ENDPOINTS.test : HYPERCERTS_API_ENDPOINTS.production;
}

/** URL-aware Hypercerts SDK API clients (one per endpoint) */
const hypercertsApiClients = new Map<string, GQLClient>();

function getHypercertsApiClient(chainId?: number): GQLClient {
  const url = `${getHypercertsApiUrl(chainId)}/v1/graphql`;
  const cached = hypercertsApiClients.get(url);
  if (cached) {
    return cached;
  }
  const client = new GQLClient(url);
  hypercertsApiClients.set(url, client);
  return client;
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
 * @param hypercertId - Format: "{chainId}-{tokenId}" e.g., "11155111-123456789"
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
  query GardenHypercerts($gardenId: ID!, $chainId: Int!, $limit: Int!) {
    Hypercert(
      where: { garden: { _eq: $gardenId }, chainId: { _eq: $chainId } }
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
  query HypercertDetail($id: ID!, $chainId: Int!) {
    Hypercert(
      where: { id: { _eq: $id }, chainId: { _eq: $chainId } }
      limit: 1
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

/**
 * Maps numeric Domain enum values to ActionDomain strings used in hypercert attestations.
 */
const DOMAIN_TO_ACTION_DOMAIN: Record<number, ActionDomain> = {
  [Domain.SOLAR]: "solar",
  [Domain.AGRO]: "agroforestry",
  [Domain.EDU]: "education",
  [Domain.WASTE]: "waste",
};

/**
 * Converts a numeric Domain enum to its ActionDomain string equivalent.
 */
export function domainToActionDomain(domain: Domain): ActionDomain | undefined {
  return DOMAIN_TO_ACTION_DOMAIN[domain];
}

/**
 * Filters attestations based on a GardenAssessment's parameters.
 * Applies the assessment's reportingPeriod, domain, and selectedActionUIDs
 * as filters to narrow down which work attestations are relevant for hypercert minting.
 */
export function filterAttestationsByAssessment(
  attestations: HypercertAttestation[],
  assessment: GardenAssessment
): HypercertAttestation[] {
  const actionDomain = domainToActionDomain(assessment.domain);
  const { start, end } = assessment.reportingPeriod;

  return attestations.filter((attestation) => {
    // Filter by reporting period (work must fall within the assessment window)
    if (start && attestation.createdAt < start) return false;
    if (end && attestation.createdAt > end) return false;

    // Filter by domain
    if (actionDomain && attestation.domain && attestation.domain !== actionDomain) {
      return false;
    }

    return true;
  });
}

/**
 * Metadata fields that can be prefilled from an assessment.
 * Compatible with HypercertWizardStore.updateMetadata().
 */
export interface AssessmentMetadataPrefill {
  title: string;
  description: string;
  workScopes: string[];
  impactScopes: string[];
  workTimeframeStart: number;
  workTimeframeEnd: number;
  sdgs: number[];
  outcomes: import("../../types/hypercerts").OutcomeMetrics;
}

/**
 * Derives hypercert metadata fields from a GardenAssessment.
 *
 * Mapping follows the WHAT / HOW MUCH framework:
 * - WHAT (scope tags): domain name + SDG labels → workScopes;
 *   SMART outcome descriptions → impactScopes
 * - HOW MUCH (metrics): SMART outcomes → outcomes.predefined (with aggregation)
 * - Timeframe: assessment reportingPeriod → workTimeframeStart/End
 * - SDGs: direct passthrough from assessment sdgTargets
 *
 * @param assessment - The garden assessment to derive metadata from
 * @param getSDGLabel - Optional SDG label lookup function (for tree-shaking in non-UI contexts)
 */
export function prefillMetadataFromAssessment(
  assessment: GardenAssessment,
  getSDGLabel?: (id: number) => string | undefined
): AssessmentMetadataPrefill {
  const actionDomain = domainToActionDomain(assessment.domain);

  // WHAT — work scopes from domain + SDG labels
  const workScopes: string[] = [];
  if (actionDomain) {
    workScopes.push(actionDomain);
  }
  if (getSDGLabel) {
    for (const sdgId of assessment.sdgTargets) {
      const label = getSDGLabel(sdgId);
      if (label) workScopes.push(label);
    }
  }

  // WHAT — impact scopes from SMART outcome descriptions
  const impactScopes: string[] = assessment.smartOutcomes.map((o) => o.description).filter(Boolean);

  // HOW MUCH — outcome metrics from SMART outcomes (predefined with aggregation)
  const predefined: Record<string, import("../../types/hypercerts").PredefinedMetric> = {};
  for (const outcome of assessment.smartOutcomes) {
    if (outcome.metric) {
      predefined[outcome.metric] = {
        value: outcome.target,
        unit: outcome.metric,
        aggregation: "sum",
        label: outcome.description || outcome.metric,
      };
    }
  }

  return {
    title: assessment.title,
    description: assessment.diagnosis,
    workScopes,
    impactScopes,
    workTimeframeStart: assessment.reportingPeriod.start,
    workTimeframeEnd: assessment.reportingPeriod.end,
    sdgs: [...assessment.sdgTargets],
    outcomes: {
      predefined,
      custom: {},
    },
  };
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

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string");
  return items.length > 0 ? items : undefined;
}

function parseMetadataPayload(payload: unknown): Partial<HypercertRecord> {
  if (!isRecord(payload)) return {};

  const title = getString(payload.name);
  const description = getString(payload.description);
  const image = getString(payload.image);

  let workScopes: string[] | undefined;
  const hypercertMetadata = isRecord(payload.hypercert) ? payload.hypercert : undefined;
  if (hypercertMetadata) {
    const workScope = isRecord(hypercertMetadata.work_scope)
      ? hypercertMetadata.work_scope
      : undefined;
    if (workScope) {
      workScopes = getStringArray(workScope.value);
    }
  }

  return {
    title,
    description,
    imageUri: image ? resolveIPFSUrl(image) : undefined,
    workScopes,
  };
}

async function getHypercertMetadataFromIpfs(
  metadataUri?: string
): Promise<Partial<HypercertRecord>> {
  if (!metadataUri) return {};

  try {
    const response = await fetch(resolveIPFSUrl(metadataUri));
    if (!response.ok) {
      return {};
    }
    const payload = (await response.json()) as unknown;
    return parseMetadataPayload(payload);
  } catch (error) {
    logger.debug("[getHypercertMetadataFromIpfs] Metadata fetch failed", {
      metadataUri,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

export async function hydrateHypercertMetadata(
  hypercertId: string,
  metadataUri?: string,
  chainId?: number
): Promise<Partial<HypercertRecord>> {
  const [sdkResult, ipfsResult] = await Promise.allSettled([
    getHypercertFromSdkApi(hypercertId),
    getHypercertMetadataFromIpfs(metadataUri),
  ]);

  const sdkMetadata =
    sdkResult.status === "fulfilled" && sdkResult.value
      ? sdkResult.value
      : ({} as Partial<HypercertRecord>);
  const ipfsMetadata = ipfsResult.status === "fulfilled" ? ipfsResult.value : {};

  if (sdkResult.status === "rejected") {
    logger.debug("[hydrateHypercertMetadata] SDK metadata fetch failed", {
      hypercertId,
      chainId,
      error:
        sdkResult.reason instanceof Error ? sdkResult.reason.message : String(sdkResult.reason),
    });
  }

  if (ipfsResult.status === "rejected") {
    logger.debug("[hydrateHypercertMetadata] IPFS metadata fetch failed", {
      hypercertId,
      chainId,
      metadataUri,
      error:
        ipfsResult.reason instanceof Error ? ipfsResult.reason.message : String(ipfsResult.reason),
    });
  }

  return {
    title: sdkMetadata.title ?? ipfsMetadata.title,
    description: sdkMetadata.description ?? ipfsMetadata.description,
    imageUri: sdkMetadata.imageUri ?? ipfsMetadata.imageUri,
    workScopes: sdkMetadata.workScopes ?? ipfsMetadata.workScopes,
  };
}

export async function hydrateHypercertRecords(
  records: HypercertRecord[],
  chainId?: number
): Promise<Record<string, Partial<HypercertRecord>>> {
  if (!records.length) return {};

  const settled = await Promise.allSettled(
    records.map(async (record) => ({
      id: record.id,
      metadata: await hydrateHypercertMetadata(record.id, record.metadataUri, chainId),
    }))
  );

  const merged: Record<string, Partial<HypercertRecord>> = {};
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    merged[result.value.id] = result.value.metadata;
  }

  return merged;
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
    // Fetch works and approvals in parallel from EAS, scoped to garden
    const [works, allApprovals] = await Promise.all([
      getWorks(gardenId),
      getWorkApprovals(gardenId),
    ]);

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
  chainId: number,
  status?: HypercertStatus,
  limit = 50
): Promise<HypercertRecord[]> {
  const { data, error } = await greenGoodsIndexer.query(
    GARDEN_HYPERCERTS_QUERY,
    { gardenId, chainId, limit },
    "getGardenHypercerts"
  );

  if (error) {
    logger.error("Indexer query failed", {
      source: "getGardenHypercerts",
      gardenId,
      chainId,
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
        mintedAt: Number(record.mintedAt ?? 0),
        mintedBy: record.mintedBy as Address,
        txHash: record.txHash as `0x${string}`,
        totalUnits: BigInt((record.totalUnits as string | number | bigint | undefined) ?? 0),
        claimedUnits: BigInt((record.claimedUnits as string | number | bigint | undefined) ?? 0),
        attestationCount: Number(record.attestationCount ?? 0),
        attestationUIDs: (record.attestationUIDs as string[] | null | undefined) ?? undefined,
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
  const chainId = Number.parseInt(hypercertId.split("-")[0] ?? "", 10);
  if (!Number.isFinite(chainId)) {
    logger.warn("Invalid hypercertId format; expected chain-scoped ID", {
      source: "getHypercertById",
      hypercertId,
    });
    return null;
  }

  const { data, error } = await greenGoodsIndexer.query(
    HYPERCERT_DETAIL_QUERY,
    { id: hypercertId, chainId },
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
    mintedAt: Number(record.mintedAt ?? 0),
    mintedBy: record.mintedBy as Address,
    txHash: record.txHash as `0x${string}`,
    totalUnits: BigInt((record.totalUnits as string | number | bigint | undefined) ?? 0),
    claimedUnits: BigInt((record.claimedUnits as string | number | bigint | undefined) ?? 0),
    attestationCount: Number(record.attestationCount ?? attestationUIDs.length),
    // Attestations are not populated here - use getApprovedAttestations for full details
    attestations,
    attestationUIDs,
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
  chainId: number,
  limit = 200
): Promise<BundledAttestationInfo[]> {
  if (!uids.length || !gardenId) return [];

  const hypercerts = await getGardenHypercerts(gardenId, chainId, undefined, limit);
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
