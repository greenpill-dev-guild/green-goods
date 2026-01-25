import type { Address } from "viem";

import { logger } from "../app/logger";
import type {
  ActionDomain,
  ActionType,
  AttestationFilters,
  HypercertAttestation,
  HypercertRecord,
  HypercertStatus,
  MetricValue,
} from "../../types/hypercerts";
import { greenGoodsIndexer } from "./graphql-client";

const APPROVED_ATTESTATIONS_QUERY = /* GraphQL */ `
  query ApprovedWorkApprovals($gardenId: ID!, $limit: Int!) {
    WorkApproval(
      where: {
        approved: { _eq: true }
        bundledInHypercert: { _is_null: true }
        garden: { id: { _eq: $gardenId } }
      }
      order_by: { approvedAt: desc }
      limit: $limit
    ) {
      id
      approvedAt
      approvedBy
      feedback
      txHash
      garden {
        id
      }
      workSubmission {
        id
        title
        gardenerName
        domain
        actionType
        workScope
        metrics
        mediaUrls
        createdAt
        txHash
        gardener {
          id
          ensName
        }
      }
    }
  }
`;

const GARDEN_HYPERCERTS_QUERY = /* GraphQL */ `
  query GardenHypercerts($gardenId: ID!, $limit: Int!) {
    Hypercert(
      where: { garden: { id: { _eq: $gardenId } } }
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
      title
      description
      workScopes
      status
      garden {
        id
      }
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
      title
      description
      workScopes
      status
      garden {
        id
      }
      workApprovals {
        id
        approvedAt
        approvedBy
        feedback
        workSubmission {
          id
          title
          gardenerName
          domain
          actionType
          workScope
          metrics
          mediaUrls
          createdAt
          gardener {
            id
            ensName
          }
        }
      }
    }
  }
`;

const CHECK_BUNDLED_QUERY = /* GraphQL */ `
  query CheckAttestationsBundled($uids: [ID!]!) {
    WorkApproval(where: { id: { _in: $uids }, bundledInHypercert: { _is_null: false } }) {
      id
      bundledInHypercert {
        id
        title
      }
    }
  }
`;

interface RawWorkApproval {
  id: string;
  approvedAt?: number | null;
  approvedBy?: string | null;
  feedback?: string | null;
  txHash?: string | null;
  garden?: { id?: string | null } | null;
  workSubmission?: {
    id: string;
    title?: string | null;
    gardenerName?: string | null;
    domain?: string | null;
    actionType?: string | null;
    workScope?: string[] | null;
    metrics?: unknown;
    mediaUrls?: string[] | null;
    createdAt?: number | null;
    txHash?: string | null;
    gardener?: { id?: string | null; ensName?: string | null } | null;
  } | null;
}

function isMetricValue(value: unknown): value is MetricValue {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.value === "number" && typeof record.unit === "string";
}

function parseMetrics(raw: unknown): Record<string, MetricValue> | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const entries = Object.entries(record);
  if (!entries.length) return null;

  const parsed: Record<string, MetricValue> = {};
  for (const [key, value] of entries) {
    if (isMetricValue(value)) {
      parsed[key] = value;
    }
  }

  return Object.keys(parsed).length ? parsed : null;
}

const ACTION_DOMAINS = new Set<ActionDomain>([
  "solar",
  "waste",
  "agroforestry",
  "education",
  "mutual_credit",
]);

const ACTION_TYPES = new Set<ActionType>([
  "hub_session",
  "workshop",
  "node_deployment",
  "cleanup",
  "recycling",
  "composting",
  "planting",
  "nursery",
  "maintenance",
  "training",
  "certification",
  "commitment",
  "exchange",
]);

function parseActionDomain(value?: string | null): ActionDomain | undefined {
  if (!value) return undefined;
  return ACTION_DOMAINS.has(value as ActionDomain) ? (value as ActionDomain) : undefined;
}

function parseActionType(value?: string | null): ActionType | undefined {
  if (!value) return undefined;
  return ACTION_TYPES.has(value as ActionType) ? (value as ActionType) : undefined;
}

function applyAttestationFilters(
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

export async function getApprovedAttestations(
  gardenId: string,
  filters?: AttestationFilters,
  limit = 100
): Promise<HypercertAttestation[]> {
  const { data, error } = await greenGoodsIndexer.query(
    APPROVED_ATTESTATIONS_QUERY,
    { gardenId, limit },
    "getApprovedAttestations"
  );

  if (error) {
    logger.error("Indexer query failed", {
      source: "getApprovedAttestations",
      gardenId,
      limit,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  const approvals = (data as { WorkApproval?: RawWorkApproval[] } | undefined)?.WorkApproval;
  if (!approvals || !Array.isArray(approvals)) return [];

  const attestations = approvals.map((approval) => {
    const submission = approval.workSubmission;
    const gardenerAddress = submission?.gardener?.id || approval.approvedBy || "";

    const gardenerName = submission?.gardenerName || submission?.gardener?.ensName || null;

    return {
      id: approval.id,
      workUid: submission?.id ?? "",
      gardenId: approval.garden?.id ?? gardenId,
      title: submission?.title ?? "Untitled work",
      uid: approval.id,
      actionType: parseActionType(submission?.actionType ?? null),
      domain: parseActionDomain(submission?.domain ?? null),
      workScope: submission?.workScope ?? [],
      gardenerAddress:
        (gardenerAddress as Address) ?? ("0x0000000000000000000000000000000000000000" as Address),
      gardenerName,
      mediaUrls: submission?.mediaUrls ?? [],
      metrics: parseMetrics(submission?.metrics) ?? null,
      createdAt: Number(submission?.createdAt ?? 0),
      approvedAt: Number(approval.approvedAt ?? 0),
      approvedBy: approval.approvedBy as Address | undefined,
      feedback: approval.feedback ?? null,
    } satisfies HypercertAttestation;
  });

  return applyAttestationFilters(attestations, filters);
}

/**
 * Fetches claims for a specific hypercert.
 * Envio doesn't support entity arrays, so we query HypercertClaim separately.
 */
export async function getHypercertClaims(
  hypercertId: string,
  limit = 100
): Promise<{ id: string; claimant: Address; units: bigint; claimedAt: number; txHash: `0x${string}` }[]> {
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
      const recordStatus = (record.status as HypercertStatus | undefined) ?? "unknown";

      return {
        id: String(record.id ?? ""),
        tokenId: BigInt((record.tokenId as string | number | bigint | undefined) ?? 0),
        gardenId: (record.garden as { id?: string } | null | undefined)?.id ?? gardenId,
        metadataUri: String(record.metadataUri ?? ""),
        imageUri: undefined,
        mintedAt: Number(record.mintedAt ?? 0),
        mintedBy: record.mintedBy as Address,
        txHash: record.txHash as `0x${string}`,
        totalUnits: BigInt((record.totalUnits as string | number | bigint | undefined) ?? 0),
        claimedUnits: BigInt((record.claimedUnits as string | number | bigint | undefined) ?? 0),
        attestationCount: Number(record.attestationCount ?? 0),
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
  const gardenId = (record.garden as { id?: string } | null | undefined)?.id ?? "";
  const approvals = Array.isArray(record.workApprovals)
    ? (record.workApprovals as Array<Record<string, unknown>>)
    : [];

  const attestations: HypercertAttestation[] = approvals.map((approval) => {
    const submission = approval.workSubmission as Record<string, unknown> | null | undefined;
    const gardener = submission?.gardener as Record<string, unknown> | null | undefined;
    const gardenerAddress =
      (gardener?.id as string | undefined) || (approval.approvedBy as string) || "";

    return {
      id: String(approval.id ?? ""),
      uid: String(approval.id ?? ""),
      workUid: String(submission?.id ?? ""),
      gardenId,
      title: String(submission?.title ?? "Untitled work"),
      actionType: parseActionType((submission?.actionType as string | null | undefined) ?? null),
      domain: parseActionDomain((submission?.domain as string | null | undefined) ?? null),
      workScope: (submission?.workScope as string[] | null | undefined) ?? [],
      gardenerAddress:
        (gardenerAddress as Address) ?? ("0x0000000000000000000000000000000000000000" as Address),
      gardenerName:
        (submission?.gardenerName as string | null | undefined) ??
        (gardener?.ensName as string | null | undefined) ??
        null,
      mediaUrls: (submission?.mediaUrls as string[] | null | undefined) ?? [],
      metrics: parseMetrics(submission?.metrics) ?? null,
      createdAt: Number(submission?.createdAt ?? 0),
      approvedAt: Number(approval.approvedAt ?? 0),
      approvedBy: approval.approvedBy as Address | undefined,
      feedback: (approval.feedback as string | null | undefined) ?? null,
    };
  });

  const hypercertIdStr = String(record.id ?? "");

  // Fetch claims separately (Envio doesn't support entity arrays)
  const claims = await getHypercertClaims(hypercertIdStr);

  return {
    id: hypercertIdStr,
    tokenId: BigInt((record.tokenId as string | number | bigint | undefined) ?? 0),
    gardenId,
    metadataUri: String(record.metadataUri ?? ""),
    imageUri: undefined,
    mintedAt: Number(record.mintedAt ?? 0),
    mintedBy: record.mintedBy as Address,
    txHash: record.txHash as `0x${string}`,
    totalUnits: BigInt((record.totalUnits as string | number | bigint | undefined) ?? 0),
    claimedUnits: BigInt((record.claimedUnits as string | number | bigint | undefined) ?? 0),
    attestationCount: Number(record.attestationCount ?? 0),
    attestations,
    title: record.title ? String(record.title) : undefined,
    description: record.description ? String(record.description) : undefined,
    workScopes: (record.workScopes as string[] | null | undefined) ?? undefined,
    status: (record.status as HypercertStatus | undefined) ?? "unknown",
    allowlistEntries: claims,
  } satisfies HypercertRecord;
}

export interface BundledAttestationInfo {
  uid: string;
  hypercertId: string;
  hypercertTitle?: string | null;
}

export async function checkAttestationsBundled(uids: string[]): Promise<BundledAttestationInfo[]> {
  if (!uids.length) return [];

  const { data, error } = await greenGoodsIndexer.query(
    CHECK_BUNDLED_QUERY,
    { uids },
    "checkAttestationsBundled"
  );

  if (error) {
    logger.error("Indexer query failed", {
      source: "checkAttestationsBundled",
      uidCount: uids.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  const approvals = (data as { WorkApproval?: Array<Record<string, unknown>> } | undefined)
    ?.WorkApproval;
  if (!approvals || !Array.isArray(approvals)) return [];

  return approvals.map((approval) => {
    const bundled = approval.bundledInHypercert as Record<string, unknown> | null | undefined;
    return {
      uid: String(approval.id ?? ""),
      hypercertId: String(bundled?.id ?? ""),
      hypercertTitle: bundled?.title ? String(bundled.title) : null,
    };
  });
}
