import type { Address } from "viem";
import type {
  HypercertAttestation,
  HypercertRecord,
  HypercertStatus,
} from "../../types/hypercerts";
import { logger } from "../app/logger";
import { GQLClient, greenGoodsIndexer } from "./graphql-client";
import { getHypercertMetadataFromIpfs, normalizeHypercertStatus } from "./hypercerts-metadata";

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

// =============================================================================
// GraphQL Queries
// =============================================================================

const GARDEN_HYPERCERTS_QUERY = /* GraphQL */ `
  query GardenHypercerts($gardenId: String!, $chainId: Int!, $limit: Int!) {
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

// =============================================================================
// Metadata Hydration
// =============================================================================

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

// =============================================================================
// Envio Indexer Queries
// =============================================================================

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
  // Lazy import to avoid circular dependency (hypercerts-attestations imports from this file)
  const { getAttestationsByUIDs } = await import("./hypercerts-attestations");

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
