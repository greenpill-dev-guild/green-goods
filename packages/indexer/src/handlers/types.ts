import type { Domain_t } from "../../generated/src/db/Enums.gen";

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
// NOTE: Declared on the contract but no longer emitted as of release/1.1.0 — kept here for
// historical event indexing on chains that emitted it before the upgrade.
export type YieldSplitter_YieldStranded_eventArgs = {
  readonly garden: string;
  readonly asset: string;
  readonly amount: bigint;
  readonly destination: string;
};

// Solidity: event YieldToTreasury(address indexed garden, address indexed asset, uint256 amount, address indexed treasury, string source)
// NEW in release/1.1.0: emitted on the fallback path when cookieJar/juicebox is unconfigured;
// `source` carries the originating split bucket name ("cookieJar" | "juicebox") for routing-attribution.
export type YieldSplitter_YieldToTreasury_eventArgs = {
  readonly garden: string;
  readonly asset: string;
  readonly amount: bigint;
  readonly treasury: string;
  readonly source: string;
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
export type TransactionWithHash = { hash: string };

/**
 * Context for fetchJson logging on failure.
 */
export interface FetchJsonContext {
  eventType: string;
  chainId: number;
  blockNumber: number;
  txHash: string;
  log: { warn: (message: string, context?: Record<string, unknown>) => void };
}
