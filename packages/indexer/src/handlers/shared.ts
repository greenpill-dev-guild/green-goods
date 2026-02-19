import type { Domain_t } from "../../generated/src/db/Enums.gen";

import type { Garden, GardenVault, Hypercert } from "../../generated/src/Types.gen";

import { Capital, HypercertStatus, PoolType, VaultEventType, WeightScheme } from "../../generated";

// ============================================================================
// TYPE HELPERS
// ============================================================================

/**
 * Utility type that removes readonly modifier from all properties.
 * Used to work around readonly entity types when building update objects.
 */
export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

// Local entity types for new schema entities (until codegen runs)
export type GoodsAirdropEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly garden: string;
  readonly totalAmount: bigint;
  readonly txHash: string;
  readonly timestamp: number;
};

export type YieldCookieJarTransferEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly garden: string;
  readonly asset: string;
  readonly amount: bigint;
  readonly jar: string;
  readonly txHash: string;
  readonly timestamp: number;
};

export type YieldJuiceboxPaymentEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly garden: string;
  readonly asset: string;
  readonly amount: bigint;
  readonly projectId: bigint;
  readonly txHash: string;
  readonly timestamp: number;
};

export type YieldStrandedEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly garden: string;
  readonly asset: string;
  readonly amount: bigint;
  readonly destination: string;
  readonly txHash: string;
  readonly timestamp: number;
};

export type GardenHatTreeEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly garden: string;
  readonly adminHatId: string;
  readonly ownerHatId: string | undefined;
  readonly operatorHatId: string | undefined;
  readonly evaluatorHatId: string | undefined;
  readonly gardenerHatId: string | undefined;
  readonly funderHatId: string | undefined;
  readonly communityHatId: string | undefined;
  readonly createdAt: number;
};

export type PartialGrantFailureEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly garden: string;
  readonly account: string;
  readonly role: number;
  readonly reason: string;
  readonly txHash: string;
  readonly timestamp: number;
};

export type HatsModule_GardenHatTreeCreated_eventArgs = {
  readonly garden: string;
  readonly adminHatId: bigint;
};

export type HatsModule_RoleGranted_eventArgs = {
  readonly garden: string;
  readonly account: string;
  readonly role: bigint;
};

export type HatsModule_RoleRevoked_eventArgs = {
  readonly garden: string;
  readonly account: string;
  readonly role: bigint;
};

// ActionRegistry domain event arg types (local until codegen runs)
export type ActionRegistry_GardenDomainsUpdated_eventArgs = {
  readonly garden: string;
  readonly domainMask: bigint;
};

export type GardenDomainsEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly garden: string;
  readonly domainMask: number;
  readonly domains: Domain_t[];
  readonly updatedAt: number;
};

// GardensModule event arg types (local until codegen runs)
export type GardensModule_CommunityCreated_eventArgs = {
  readonly garden: string;
  readonly community: string;
  readonly weightScheme: bigint;
  readonly goodsToken: string;
};

export type GardensModule_SignalPoolCreated_eventArgs = {
  readonly garden: string;
  readonly pool: string;
  readonly poolType: bigint;
  readonly community: string;
};

// YieldSplitter event arg types — aligned with generated types from codegen.
// NOTE: The generated types omit some Solidity event fields (totalYield, treasury, amount).
// Handlers compute derived values from available fields.
export type YieldSplitter_YieldSplit_eventArgs = {
  readonly garden: string;
  readonly asset: string;
  readonly cookieJarAmount: bigint;
  readonly fractionsAmount: bigint;
  readonly juiceboxAmount: bigint;
  readonly totalYield: bigint;
};

// YieldSplitter_FractionPurchased_eventArgs is now imported from generated types.

// Solidity: event YieldAccumulated(address indexed garden, address indexed asset, uint256 amount, uint256 totalPending)
export type YieldSplitter_YieldAccumulated_eventArgs = {
  readonly garden: string;
  readonly asset: string;
  readonly amount: bigint;
  readonly totalPending: bigint;
};

// GardensModule additional event arg types
// Solidity: event GardenPowerRegistered(address indexed garden, WeightScheme weightScheme, uint256 sourceCount)
export type GardensModule_GardenPowerRegistered_eventArgs = {
  readonly garden: string;
  readonly weightScheme: bigint;
  readonly sourceCount: bigint;
};

// Solidity: event GoodsAirdropped(address indexed garden, uint256 totalAmount)
export type GardensModule_GoodsAirdropped_eventArgs = {
  readonly garden: string;
  readonly totalAmount: bigint;
};

// Solidity: event GardenTreasurySeeded(address indexed garden, uint256 amount)
export type GardensModule_GardenTreasurySeeded_eventArgs = {
  readonly garden: string;
  readonly amount: bigint;
};

export type GardenTreasuryEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly garden: string;
  readonly totalSeeded: bigint;
  readonly lastSeededAt: number;
};

// YieldSplitter additional event arg types
// Solidity: event YieldToCookieJar(address indexed garden, address indexed asset, uint256 amount, address indexed jar)
export type YieldSplitter_YieldToCookieJar_eventArgs = {
  readonly garden: string;
  readonly asset: string;
  readonly amount: bigint;
  readonly jar: string;
};

// Solidity: event YieldToJuicebox(address indexed garden, address indexed asset, uint256 amount, uint256 projectId)
export type YieldSplitter_YieldToJuicebox_eventArgs = {
  readonly garden: string;
  readonly asset: string;
  readonly amount: bigint;
  readonly projectId: bigint;
};

// Solidity: event YieldStranded(address indexed garden, address indexed asset, uint256 amount, string destination)
export type YieldSplitter_YieldStranded_eventArgs = {
  readonly garden: string;
  readonly asset: string;
  readonly amount: bigint;
  readonly destination: string;
};

export type HatsModule_PartialGrantFailed_eventArgs = {
  readonly garden: string;
  readonly account: string;
  readonly role: bigint;
  readonly reason: string;
};

// CookieJarModule event arg types (local until codegen runs)
// Solidity: event JarCreated(address indexed garden, address indexed asset, address jar)
export type CookieJarModule_JarCreated_eventArgs = {
  readonly garden: string;
  readonly asset: string;
  readonly jar: string;
};

export type CookieJarEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly garden: string;
  readonly asset: string;
  readonly jarAddress: string;
  readonly createdAt: number;
};

// ENS event arg types
export type GreenGoodsENS_NameRegistrationSent_eventArgs = {
  readonly messageId: string;
  readonly slug: string;
  readonly owner: string;
  readonly nameType: bigint;
  readonly ccipFee: bigint;
};

export type GreenGoodsENS_NameReleaseSent_eventArgs = {
  readonly messageId: string;
  readonly slug: string;
  readonly previousOwner: string;
};

export type ENSRegistrationEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly slug: string;
  readonly owner: string;
  readonly nameType: string;
  readonly ccipMessageId: string;
  readonly status: string;
  readonly ccipFee: bigint;
  readonly registeredAt: number;
  readonly txHash: string;
};

// Marketplace event arg types
export type HypercertMarketplaceAdapter_OrderRegistered_eventArgs = {
  readonly orderId: bigint;
  readonly hypercertId: bigint;
  readonly seller: string;
  readonly currency: string;
  readonly pricePerUnit: bigint;
  readonly endTime: bigint;
};

export type HypercertMarketplaceAdapter_OrderDeactivated_eventArgs = {
  readonly orderId: bigint;
  readonly deactivatedBy: string;
};

export type HypercertMarketplaceAdapter_FractionPurchased_eventArgs = {
  readonly orderId: bigint;
  readonly hypercertId: bigint;
  readonly recipient: string;
  readonly units: bigint;
  readonly payment: bigint;
};

export type MarketplaceOrderEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly orderId: bigint;
  readonly hypercertId: bigint;
  readonly seller: string;
  readonly currency: string;
  readonly pricePerUnit: bigint;
  readonly endTime: bigint;
  readonly active: boolean;
  readonly totalUnitsSold: bigint;
  readonly totalPaymentsReceived: bigint;
  readonly createdAt: number;
  readonly deactivatedAt: number | undefined;
  readonly deactivatedBy: string | undefined;
  readonly txHash: string;
};

export type MarketplacePurchaseEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly orderId: bigint;
  readonly hypercertId: bigint;
  readonly recipient: string;
  readonly units: bigint;
  readonly payment: bigint;
  readonly txHash: string;
  readonly timestamp: number;
};

// Power registry event arg types
export type UnifiedPowerRegistry_ConfigUpdated_eventArgs = {
  readonly key: string;
  readonly oldValue: string;
  readonly newValue: string;
};

export type UnifiedPowerRegistry_GardenDeregistered_eventArgs = {
  readonly garden: string;
  readonly poolsCleared: bigint;
};

export type PowerRegistryConfigEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly key: string;
  readonly oldValue: string;
  readonly newValue: string;
  readonly txHash: string;
  readonly timestamp: number;
};

export type PowerRegistryDeregistrationEntity = {
  readonly id: string;
  readonly chainId: number;
  readonly garden: string;
  readonly poolsCleared: bigint;
  readonly txHash: string;
  readonly timestamp: number;
};

/**
 * Extended transaction type that includes the hash field.
 * The generated Transaction_t is empty, but the runtime object includes hash.
 */
type TransactionWithHash = { hash: string };

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maps numeric capital type values from the smart contract to Capital enum values.
 * These values correspond to the Capital enum in the ActionRegistry contract.
 */
export const CAPITAL_TYPE_MAP: Record<number, Capital> = {
  0: "SOCIAL",
  1: "MATERIAL",
  2: "FINANCIAL",
  3: "LIVING",
  4: "INTELLECTUAL",
  5: "EXPERIENTIAL",
  6: "SPIRITUAL",
  7: "CULTURAL",
} as const;

/**
 * Maps numeric domain type values from the smart contract to Domain enum string values.
 * These values correspond to the Domain enum in the ActionRegistry contract.
 */
export const DOMAIN_TYPE_MAP: Record<number, Domain_t> = {
  0: "SOLAR",
  1: "AGRO",
  2: "EDU",
  3: "WASTE",
} as const;

/**
 * Maps numeric weight scheme values from the GardensModule contract to WeightScheme enum values.
 * These values correspond to the WeightScheme enum in IGardensModule.
 */
export const WEIGHT_SCHEME_MAP: Record<number, WeightScheme> = {
  0: "LINEAR",
  1: "EXPONENTIAL",
  2: "POWER",
} as const;

/**
 * Maps numeric pool type values from the GardensModule contract to PoolType enum values.
 */
export const POOL_TYPE_MAP: Record<number, PoolType> = {
  0: "HYPERCERT",
  1: "ACTION",
} as const;

/**
 * Garden role enum mapping (mirrors IHatsModule.GardenRole)
 */
export const GARDEN_ROLE = {
  Gardener: 0,
  Evaluator: 1,
  Operator: 2,
  Owner: 3,
  Funder: 4,
  Community: 5,
} as const;

// Zero address constant used for guards and defaults.
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Maps NameType enum from the GreenGoodsENS contract.
 * 0 = Gardener, 1 = Garden
 */
export const ENS_NAME_TYPE_MAP: Record<number, string> = {
  0: "Gardener",
  1: "Garden",
} as const;

export const DEFAULT_IPFS_GATEWAY = "https://w3s.link/ipfs/";

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

export interface FetchJsonContext {
  eventType: string;
  chainId: number;
  blockNumber: number;
  txHash: string;
  log: { warn: (message: string, context?: Record<string, unknown>) => void };
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
