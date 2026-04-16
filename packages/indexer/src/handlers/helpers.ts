import { Capital, HypercertStatus, PoolType, WeightScheme } from "../../generated";
import type { Domain_t } from "../../generated/src/db/Enums.gen";
import type { Garden, GardenVault, Hypercert } from "../../generated/src/Types.gen";

import type { FetchJsonContext, TransactionWithHash } from "./types";
import {
  CAPITAL_TYPE_MAP,
  DEFAULT_IPFS_GATEWAY,
  DOMAIN_TYPE_MAP,
  ENS_NAME_TYPE_MAP,
  POOL_TYPE_MAP,
  WEIGHT_SCHEME_MAP,
} from "./constants";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper to safely access transaction hash from event.transaction.
 * Works around the empty Transaction_t type in generated code.
 */
export function getTxHash(transaction: unknown): string {
  if (
    typeof transaction !== "object" ||
    transaction === null ||
    !("hash" in transaction) ||
    typeof (transaction as TransactionWithHash).hash !== "string"
  ) {
    throw new Error(
      `Invalid transaction object: expected { hash: string }, got ${JSON.stringify(transaction)}`
    );
  }
  return (transaction as TransactionWithHash).hash;
}

/**
 * Converts a numeric domain type from the blockchain to a Domain enum value.
 * Returns "UNKNOWN" for any unrecognized values.
 */
export function mapDomainType(value: bigint): Domain_t {
  const numValue = Number(value);
  return DOMAIN_TYPE_MAP[numValue] ?? "UNKNOWN";
}

/**
 * Expands a domain bitmask into an array of Domain enum strings.
 * Bit 0=SOLAR, 1=AGRO, 2=EDU, 3=WASTE
 */
export function expandDomainMask(mask: number): Domain_t[] {
  const domains: Domain_t[] = [];
  if (mask & 1) domains.push("SOLAR");
  if (mask & 2) domains.push("AGRO");
  if (mask & 4) domains.push("EDU");
  if (mask & 8) domains.push("WASTE");
  return domains;
}

/**
 * Converts a numeric capital type from the blockchain to a Capital enum value.
 * Returns "UNKNOWN" for any unrecognized values.
 */
export function mapCapitalType(value: bigint): Capital {
  const numValue = Number(value);
  return CAPITAL_TYPE_MAP[numValue] ?? "UNKNOWN";
}

export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

export function addUniqueAddress(list: string[], address: string): string[] {
  const normalized = normalizeAddress(address);
  if (list.some((item) => normalizeAddress(item) === normalized)) {
    return list;
  }
  return [...list, normalized];
}

export function removeAddress(list: string[], address: string): string[] {
  const normalized = normalizeAddress(address);
  return list.filter((item) => normalizeAddress(item) !== normalized);
}

/**
 * Creates a default Garden entity with empty values.
 * Used when handling update events for gardens that don't exist yet.
 */
export function createDefaultGarden(gardenId: string, chainId: number, timestamp: number): Garden {
  return {
    id: gardenId,
    chainId,
    tokenAddress: "",
    tokenID: 0n,
    name: "",
    description: "",
    location: "",
    bannerImage: "",
    openJoining: false,
    initialized: false,
    gardeners: [],
    operators: [],
    evaluators: [],
    owners: [],
    funders: [],
    communities: [],
    createdAt: timestamp,
    gapProjectUID: undefined,
  };
}

export function getGardenVaultId(chainId: number, garden: string, asset: string): string {
  return `${chainId}-${normalizeAddress(garden)}-${normalizeAddress(asset)}`;
}

export function getGardenVaultIndexId(chainId: number, garden: string): string {
  return `${chainId}-${normalizeAddress(garden)}`;
}

export function getVaultDepositId(
  chainId: number,
  vaultAddress: string,
  depositor: string
): string {
  return `${chainId}-${normalizeAddress(vaultAddress)}-${normalizeAddress(depositor)}`;
}

export function getVaultAddressIndexId(chainId: number, vaultAddress: string): string {
  return `${chainId}-${normalizeAddress(vaultAddress)}`;
}

export function getVaultEventId(
  chainId: number,
  txHash: string,
  logIndex: bigint | number
): string {
  return `${chainId}-${txHash}-${logIndex.toString()}`;
}

// ID helpers for Gardens Community entities
export function getGardenCommunityId(chainId: number, garden: string): string {
  return `${chainId}-${normalizeAddress(garden)}`;
}

export function getGardenSignalPoolId(
  chainId: number,
  garden: string,
  poolAddress: string
): string {
  return `${chainId}-${normalizeAddress(garden)}-${normalizeAddress(poolAddress)}`;
}

export function getYieldAllocationId(
  chainId: number,
  txHash: string,
  logIndex: bigint | number
): string {
  return `${chainId}-${txHash}-${logIndex.toString()}`;
}

export function getYieldAccumulationId(chainId: number, garden: string, asset: string): string {
  return `${chainId}-${normalizeAddress(garden)}-${normalizeAddress(asset)}`;
}

export function getYieldFractionPurchaseId(
  chainId: number,
  txHash: string,
  logIndex: bigint | number,
  hypercertId: bigint
): string {
  return `${chainId}-${txHash}-${logIndex.toString()}-${hypercertId.toString()}`;
}

// ID helper for yield routing event entities (txHash-based, same as getVaultEventId)
export function getYieldEventId(
  chainId: number,
  txHash: string,
  logIndex: bigint | number
): string {
  return `${chainId}-${txHash}-${logIndex.toString()}`;
}

export function getCookieJarId(chainId: number, garden: string, asset: string): string {
  return `${chainId}-${normalizeAddress(garden)}-${normalizeAddress(asset)}`;
}

export function mapWeightScheme(value: bigint): WeightScheme {
  return WEIGHT_SCHEME_MAP[Number(value)] ?? "LINEAR";
}

export function mapPoolType(value: bigint): PoolType {
  return POOL_TYPE_MAP[Number(value)] ?? "HYPERCERT";
}

export function mapENSNameType(value: bigint): string {
  return ENS_NAME_TYPE_MAP[Number(value)] ?? "Gardener";
}

export function createDefaultGardenVault(
  chainId: number,
  garden: string,
  asset: string,
  vaultAddress: string,
  timestamp: number
): GardenVault {
  return {
    id: getGardenVaultId(chainId, garden, asset),
    chainId,
    garden: normalizeAddress(garden),
    asset: normalizeAddress(asset),
    vaultAddress: normalizeAddress(vaultAddress),
    totalDeposited: 0n,
    totalWithdrawn: 0n,
    totalHarvestCount: 0,
    donationAddress: undefined,
    depositorCount: 0,
    paused: false,
    createdAt: timestamp,
  };
}

export function getMarketplaceOrderId(chainId: number, orderId: bigint): string {
  return `${chainId}-${orderId.toString()}`;
}

export function getMarketplacePurchaseId(
  chainId: number,
  txHash: string,
  logIndex: bigint | number
): string {
  return `${chainId}-${txHash}-${logIndex.toString()}`;
}

// Hypercert helpers
export function resolveIpfsUri(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return `${DEFAULT_IPFS_GATEWAY}${uri.slice("ipfs://".length)}`;
  }
  return uri;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((entry) => typeof entry === "string") as string[];
  return strings.length ? strings : undefined;
}

export async function fetchJson(
  uri: string,
  fetchContext?: FetchJsonContext,
  timeoutMs = 10_000
): Promise<unknown | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(resolveIpfsUri(uri), { signal: controller.signal });
    if (!response.ok) {
      if (fetchContext) {
        fetchContext.log.warn("Metadata fetch returned non-OK status", {
          eventType: fetchContext.eventType,
          chainId: fetchContext.chainId,
          blockNumber: fetchContext.blockNumber,
          correlationId: fetchContext.txHash,
          uri,
          status: response.status,
        });
      }
      return null;
    }
    return await response.json();
  } catch (error) {
    if (fetchContext) {
      fetchContext.log.warn("Metadata fetch failed", {
        eventType: fetchContext.eventType,
        chainId: fetchContext.chainId,
        blockNumber: fetchContext.blockNumber,
        correlationId: fetchContext.txHash,
        uri,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function parseHypercertMetadata(metadata: unknown): {
  title?: string;
  description?: string;
  imageUri?: string;
  workScopes?: string[];
  gardenId?: string;
  attestationUIDs?: string[];
} {
  if (!isRecord(metadata)) return {};

  const title = getString(metadata.name);
  const description = getString(metadata.description);
  const imageUri = getString(metadata.image);

  let workScopes: string[] | undefined;
  const hypercert = isRecord(metadata.hypercert) ? metadata.hypercert : undefined;
  if (hypercert) {
    const workScope = isRecord(hypercert.work_scope) ? hypercert.work_scope : undefined;
    if (workScope) {
      workScopes = getStringArray(workScope.value);
    }
  }

  let gardenId: string | undefined;
  let attestationUIDs: string[] | undefined;
  const hidden = isRecord(metadata.hidden_properties) ? metadata.hidden_properties : undefined;
  if (hidden) {
    gardenId = getString(hidden.gardenId);
    const refs = Array.isArray(hidden.attestationRefs)
      ? hidden.attestationRefs.filter(isRecord)
      : [];
    const uids = refs.map((ref) => getString(ref.uid)).filter((uid): uid is string => Boolean(uid));
    if (uids.length > 0) {
      attestationUIDs = uids;
    }
  }

  return {
    title,
    description,
    imageUri: imageUri ? resolveIpfsUri(imageUri) : undefined,
    workScopes,
    gardenId,
    attestationUIDs,
  };
}

// Helper to create default Hypercert entity
// Note: claims are stored as separate HypercertClaim entities (Envio doesn't support entity arrays)
export function createDefaultHypercert(
  hypercertId: string,
  chainId: number,
  tokenId: bigint,
  timestamp: number
): Hypercert {
  return {
    id: hypercertId,
    chainId,
    tokenId,
    garden: "",
    metadataUri: "",
    mintedAt: timestamp,
    mintedBy: "",
    txHash: "",
    totalUnits: 0n,
    claimedUnits: 0n,
    attestationCount: 0,
    attestationUIDs: [],
    status: "ACTIVE" as HypercertStatus,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
