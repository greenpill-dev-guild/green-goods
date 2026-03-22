/**
 * Centralized Query Key Factory
 * Standardizes and simplifies React Query cache keys
 */

import type { Address } from "../types/domain";
import type { AttestationFilters } from "../types/hypercerts";

const serializeAttestationFilters = (filters?: AttestationFilters): string => {
  if (!filters) return "";

  const normalizeDate = (value?: Date | number | null) => {
    if (value === null || value === undefined) return undefined;
    return value instanceof Date ? value.toISOString() : value;
  };

  return JSON.stringify({
    startDate: normalizeDate(filters.startDate),
    endDate: normalizeDate(filters.endDate),
    domain: filters.domain ?? undefined,
    workScope: filters.workScope ?? undefined,
    actionType: filters.actionType ?? undefined,
    gardenerAddress: filters.gardenerAddress ? filters.gardenerAddress.toLowerCase() : undefined,
    searchQuery: filters.searchQuery?.trim() || undefined,
  });
};

// ============================================
// Stale Time Constants (in milliseconds)
// ============================================

/** Fast-changing data (queue status, uploading jobs) */
export const STALE_TIME_FAST = 5_000; // 5 seconds

/** Medium-frequency data (approvals, recent works) */
export const STALE_TIME_MEDIUM = 30_000; // 30 seconds

/** Slow-changing data (gardens, actions) */
export const STALE_TIME_SLOW = 60_000; // 1 minute

/** Rarely changing data (user profile, settings) */
export const STALE_TIME_RARE = 300_000; // 5 minutes

/** Default retry configuration */
export const DEFAULT_RETRY_COUNT = 3;
export const DEFAULT_RETRY_DELAY = 1000; // 1 second

/** Delay for follow-up query invalidation to handle indexer lag */
export const INDEXER_LAG_FOLLOWUP_MS = 2000 as const;

// Base query key factory
export const queryKeys = {
  // Top-level key for all Green Goods queries
  all: ["greengoods"] as const,

  // Job queue related keys
  queue: {
    all: ["greengoods", "queue"] as const,
    stats: () => ["greengoods", "queue", "stats"] as const,
    jobs: (filter?: { kind?: string; synced?: boolean }) =>
      ["greengoods", "queue", "jobs", filter] as const,
    pendingCount: () => ["greengoods", "queue", "pendingCount"] as const,
    uploading: () => ["greengoods", "queue", "uploading"] as const,
  },

  // Works related keys
  works: {
    all: ["greengoods", "works"] as const,
    mine: (
      userAddress?: string,
      chainId?: number,
      includeOffline?: boolean,
      timeFilter?: string,
      limit?: number
    ) =>
      [
        "greengoods",
        "works",
        "mine",
        userAddress,
        chainId,
        includeOffline,
        timeFilter,
        limit,
      ] as const,
    online: (gardenId: string, chainId: number) =>
      ["greengoods", "works", "online", gardenId, chainId] as const,
    offline: (gardenId: string) => ["greengoods", "works", "offline", gardenId] as const,
    merged: (gardenId: string, chainId: number) =>
      ["greengoods", "works", "merged", gardenId, chainId] as const,
    approvals: (userAddress?: string, chainId?: number) =>
      ["greengoods", "works", "approvals", userAddress, chainId] as const,
  },

  // Work approvals related keys
  workApprovals: {
    all: ["greengoods", "workApprovals"] as const,
    byAttester: (attesterAddress?: string, chainId?: number) =>
      ["greengoods", "workApprovals", "byAttester", attesterAddress, chainId] as const,
    offline: (attesterAddress?: string) =>
      ["greengoods", "workApprovals", "offline", attesterAddress] as const,
  },

  // Approvals aggregated by operator gardens
  approvals: {
    all: ["greengoods", "approvals"] as const,
    byOperatorGardens: (gardenIds: string[]) =>
      [
        "greengoods",
        "approvals",
        "byOperatorGardens",
        JSON.stringify([...gardenIds].sort()),
      ] as const,
  },

  // Operator works related keys
  operatorWorks: {
    all: ["greengoods", "operatorWorks"] as const,
    byAddress: (address: Address | undefined, gardenIds: string[]) =>
      ["greengoods", "operatorWorks", address, JSON.stringify([...gardenIds].sort())] as const,
  },

  // Offline state keys
  offline: {
    all: ["greengoods", "offline"] as const,
    status: () => ["greengoods", "offline", "status"] as const,
    sync: () => ["greengoods", "offline", "sync"] as const,
  },

  // Media related keys
  media: {
    all: ["greengoods", "media"] as const,
    forJob: (jobId: string) => ["greengoods", "media", "job", jobId] as const,
  },

  // Garden related keys
  gardens: {
    all: ["greengoods", "gardens"] as const,
    byChain: (chainId: number) => ["greengoods", "gardens", chainId] as const,
    detail: (gardenId: string, chainId: number) =>
      ["greengoods", "gardens", "detail", gardenId, chainId] as const,
  },

  // Vault / treasury related keys
  vaults: {
    all: ["greengoods", "vaults"] as const,
    byChain: (chainId: number) => ["greengoods", "vaults", "chain", chainId] as const,
    byGarden: (gardenAddress: string, chainId: number) =>
      ["greengoods", "vaults", "garden", gardenAddress, chainId] as const,
    deposits: (gardenAddress: string, chainId: number) =>
      ["greengoods", "vaults", "deposits", gardenAddress, chainId] as const,
    myDeposits: (gardenAddress: string, userAddress: string, chainId: number) =>
      ["greengoods", "vaults", "myDeposits", gardenAddress, userAddress, chainId] as const,
    myDepositsByUser: (userAddress: string, chainId: number) =>
      ["greengoods", "vaults", "myDepositsByUser", userAddress, chainId] as const,
    eventsBase: (gardenAddress: string, chainId: number) =>
      ["greengoods", "vaults", "events", gardenAddress, chainId] as const,
    events: (gardenAddress: string, chainId: number, limit?: number) =>
      ["greengoods", "vaults", "events", gardenAddress, chainId, limit] as const,
    preview: (
      vaultAddress: string,
      amount?: bigint,
      shares?: bigint,
      userAddress?: string,
      chainId?: number
    ) =>
      [
        "greengoods",
        "vaults",
        "preview",
        vaultAddress,
        amount?.toString(),
        shares?.toString(),
        userAddress,
        chainId,
      ] as const,
  },

  // Cookie jar related keys
  cookieJar: {
    all: ["greengoods", "cookieJar"] as const,
    byGarden: (gardenAddress: string, chainId: number) =>
      ["greengoods", "cookieJar", "garden", gardenAddress, chainId] as const,
    jarDetail: (jarAddress: string, chainId: number) =>
      ["greengoods", "cookieJar", "detail", jarAddress, chainId] as const,
    userHistory: (jarAddress: string, userAddress: string, chainId: number) =>
      ["greengoods", "cookieJar", "history", jarAddress, userAddress, chainId] as const,
  },

  // Conviction voting related keys
  conviction: {
    all: ["greengoods", "conviction"] as const,
    strategies: (gardenAddress: string, chainId: number) =>
      ["greengoods", "conviction", "strategies", gardenAddress, chainId] as const,
    // Signal pool keys
    registeredHypercerts: (poolAddress: string, chainId: number) =>
      ["greengoods", "conviction", "registeredHypercerts", poolAddress, chainId] as const,
    convictionWeights: (poolAddress: string, chainId: number) =>
      ["greengoods", "conviction", "convictionWeights", poolAddress, chainId] as const,
    memberPower: (poolAddress: string, voterAddress: string, chainId: number) =>
      ["greengoods", "conviction", "memberPower", poolAddress, voterAddress, chainId] as const,
  },

  // Community related keys (Gardens V2 integration)
  community: {
    all: ["greengoods", "community"] as const,
    garden: (gardenAddress: string, chainId: number) =>
      ["greengoods", "community", "garden", gardenAddress, chainId] as const,
    pools: (gardenAddress: string, chainId: number) =>
      ["greengoods", "community", "pools", gardenAddress, chainId] as const,
  },

  // Yield allocation related keys
  yield: {
    all: ["greengoods", "yield"] as const,
    /** Base key for garden allocations - use for prefix-based invalidation */
    allocationsBase: (gardenAddress: string, chainId: number) =>
      ["greengoods", "yield", "allocations", gardenAddress, chainId] as const,
    /** Full key with limit - use for specific queries */
    allocations: (gardenAddress: string, chainId: number, limit?: number) =>
      ["greengoods", "yield", "allocations", gardenAddress, chainId, limit] as const,
    byAsset: (assetAddress: string, chainId: number) =>
      ["greengoods", "yield", "byAsset", assetAddress, chainId] as const,
    splitConfig: (gardenAddress: string, chainId: number) =>
      ["greengoods", "yield", "splitConfig", gardenAddress, chainId] as const,
    pendingYield: (gardenAddress: string, assetAddress: string, chainId: number) =>
      ["greengoods", "yield", "pending", gardenAddress, assetAddress, chainId] as const,
    /** Protocol-wide yield summary (all gardens, all assets) */
    protocolSummary: (chainId: number) =>
      ["greengoods", "yield", "protocolSummary", chainId] as const,
  },

  // Platform-wide stats (dashboard)
  platform: {
    all: ["greengoods", "platform"] as const,
    stats: (chainId: number) => ["greengoods", "platform", "stats", chainId] as const,
  },

  // Action related keys
  actions: {
    all: ["greengoods", "actions"] as const,
    byChain: (chainId: number) => ["greengoods", "actions", chainId] as const,
  },

  // Assessment related keys
  assessments: {
    all: ["greengoods", "assessments"] as const,
    /** All assessments across gardens for a chain */
    byChain: (chainId: number) => ["greengoods", "assessments", "byChain", chainId] as const,
    /** Base key for garden assessments - use for prefix-based invalidation */
    byGardenBase: (gardenAddress: string, chainId: number) =>
      ["greengoods", "assessments", "byGarden", gardenAddress, chainId] as const,
    /** Full key with limit - use for specific queries */
    byGarden: (gardenAddress: string, chainId: number, limit?: number) =>
      ["greengoods", "assessments", "byGarden", gardenAddress, chainId, limit] as const,
  },

  // Gardener related keys
  gardeners: {
    all: ["greengoods", "gardeners"] as const,
    byAddress: (address: Address) => ["greengoods", "gardeners", "byAddress", address] as const,
  },

  // Gardener profile related keys (on-chain profile data)
  gardenerProfile: {
    all: ["greengoods", "gardener-profile"] as const,
    byAddress: (address: Address, chainId: number) =>
      ["greengoods", "gardener-profile", address, chainId] as const,
  },

  // ENS related keys
  ens: {
    all: ["greengoods", "ens"] as const,
    name: (address: Address | string) => ["greengoods", "ens", "name", address] as const,
    address: (name: string) => ["greengoods", "ens", "address", name] as const,
    avatar: (address: Address | string) => ["greengoods", "ens", "avatar", address] as const,
    registrationStatus: (slug: string) => ["greengoods", "ens", "registration", slug] as const,
    availability: (slug: string) => ["greengoods", "ens", "availability", slug] as const,
    protocolMembership: (address: Address | string) =>
      ["greengoods", "ens", "protocolMembership", address] as const,
  },

  // Role related keys (operator/deployer detection)
  role: {
    all: ["greengoods", "role"] as const,
    operatorGardens: (address?: Address, chainId?: number) =>
      ["greengoods", "role", "operatorGardens", address, chainId] as const,
    gardenRoles: (gardenId?: string, address?: Address) =>
      ["greengoods", "role", "gardenRoles", gardenId, address] as const,
    hasRole: (gardenId?: string, address?: Address, role?: string) =>
      ["greengoods", "role", "hasRole", gardenId, address, role] as const,
    evaluatorGardens: (address?: Address, gardenIds: string[] = []) =>
      [
        "greengoods",
        "role",
        "evaluatorGardens",
        address,
        JSON.stringify([...gardenIds].sort()),
      ] as const,
    deploymentPermissions: (address?: string, chainId?: number) =>
      ["greengoods", "role", "deploymentPermissions", address, chainId] as const,
    allowlist: (chainId?: number) => ["greengoods", "role", "allowlist", chainId] as const,
  },

  // Draft related keys
  drafts: {
    all: ["greengoods", "drafts"] as const,
    list: (userAddress: string, chainId: number) =>
      ["greengoods", "drafts", "list", userAddress, chainId] as const,
    detail: (draftId: string) => ["greengoods", "drafts", "detail", draftId] as const,
    images: (draftId: string) => ["greengoods", "drafts", "images", draftId] as const,
  },

  // Hypercert related keys
  hypercerts: {
    all: ["greengoods", "hypercerts"] as const,
    attestations: (gardenId?: string, filters?: AttestationFilters) =>
      [
        "greengoods",
        "hypercerts",
        "attestations",
        gardenId,
        serializeAttestationFilters(filters),
      ] as const,
    list: (gardenId?: string, chainId?: number, status?: string) =>
      ["greengoods", "hypercerts", "list", gardenId, chainId, status] as const,
    detail: (hypercertId?: string) => ["greengoods", "hypercerts", "detail", hypercertId] as const,
    drafts: (gardenId?: string, operatorAddress?: string) =>
      ["greengoods", "hypercerts", "drafts", gardenId, operatorAddress] as const,
  },

  // Marketplace related keys (HypercertMarketplaceAdapter)
  marketplace: {
    all: ["greengoods", "marketplace"] as const,
    orders: (gardenAddress: string, chainId: number) =>
      ["greengoods", "marketplace", "orders", gardenAddress, chainId] as const,
    activeOrder: (hypercertId: string, currency: string, chainId: number) =>
      ["greengoods", "marketplace", "active-order", hypercertId, currency, chainId] as const,
    sellerOrders: (seller: string, chainId: number) =>
      ["greengoods", "marketplace", "seller-orders", seller, chainId] as const,
    preview: (hypercertId: string, amount: string, currency: string, chainId: number) =>
      ["greengoods", "marketplace", "preview", hypercertId, amount, currency, chainId] as const,
    tradeHistory: (hypercertId: string, chainId: number) =>
      ["greengoods", "marketplace", "trades", hypercertId, chainId] as const,
    approvals: (operator: string, chainId: number) =>
      ["greengoods", "marketplace", "approvals", operator, chainId] as const,
  },
} as const;

// Utility functions for invalidating related queries
export const queryInvalidation = {
  // Invalidate all Green Goods related queries
  invalidateAll: () => queryKeys.all,

  // Invalidate queue statistics
  invalidateQueueStats: () => queryKeys.queue.stats(),

  // Invalidate works for a specific garden
  invalidateWorksForGarden: (gardenId: string, chainId: number) => [
    queryKeys.works.online(gardenId, chainId),
    queryKeys.works.offline(gardenId),
    queryKeys.works.merged(gardenId, chainId),
  ],

  // Invalidate all works
  invalidateAllWorks: () => queryKeys.works.all,

  // Invalidate offline state
  invalidateOfflineState: () => queryKeys.offline.all,

  // Get queries to invalidate when a job is added
  onJobAdded: (gardenId: string, chainId: number) => [
    queryKeys.queue.stats(),
    queryKeys.queue.pendingCount(),
    queryKeys.works.offline(gardenId),
    queryKeys.works.merged(gardenId, chainId),
  ],

  // Get queries to invalidate when a job is completed
  onJobCompleted: (gardenId: string, chainId: number, userAddress?: string) => {
    const keys: Array<
      | ReturnType<typeof queryKeys.queue.stats>
      | ReturnType<typeof queryKeys.queue.pendingCount>
      | typeof queryKeys.works.all
      | ReturnType<typeof queryKeys.works.online>
      | ReturnType<typeof queryKeys.works.merged>
      | ReturnType<typeof queryKeys.works.approvals>
    > = [
      queryKeys.queue.stats(),
      queryKeys.queue.pendingCount(),
      queryKeys.works.all,
      queryKeys.works.online(gardenId, chainId),
      queryKeys.works.merged(gardenId, chainId),
      // Keep legacy broad invalidation for callers using omitted params.
      queryKeys.works.approvals(),
      // Invalidate chain-scoped approvals (most callers pass chainId).
      queryKeys.works.approvals(undefined, chainId),
    ];

    if (userAddress) {
      keys.push(queryKeys.works.approvals(userAddress, chainId));
    }

    return keys;
  },

  // Get queries to invalidate when sync is completed
  onSyncCompleted: () => [queryKeys.queue.all, queryKeys.works.all, queryKeys.offline.sync()],

  // Invalidate gardens (e.g., after joining/leaving)
  invalidateGardens: (chainId: number) => [
    queryKeys.gardens.all,
    queryKeys.gardens.byChain(chainId),
  ],

  // Invalidate specific garden
  invalidateGarden: (gardenId: string, chainId: number) => [
    queryKeys.gardens.byChain(chainId),
    queryKeys.gardens.detail(gardenId, chainId),
  ],

  // Invalidate drafts for user
  invalidateDrafts: (userAddress: string, chainId: number) => [
    queryKeys.drafts.all,
    queryKeys.drafts.list(userAddress, chainId),
  ],

  // Invalidate specific draft
  invalidateDraft: (draftId: string) => [
    queryKeys.drafts.detail(draftId),
    queryKeys.drafts.images(draftId),
  ],

  // Invalidate hypercert lists
  invalidateHypercerts: (gardenId?: string, chainId?: number, status?: string) => [
    queryKeys.hypercerts.all,
    queryKeys.hypercerts.list(gardenId, chainId, status),
    queryKeys.hypercerts.attestations(gardenId),
  ],

  // Invalidate marketplace data
  invalidateMarketplace: (gardenAddress?: string, chainId?: number) => {
    if (gardenAddress && chainId) {
      return [queryKeys.marketplace.orders(gardenAddress, chainId), queryKeys.marketplace.all];
    }
    return [queryKeys.marketplace.all];
  },

  // Queries to invalidate after listing creation or cancellation
  onMarketplaceListingChanged: (gardenAddress: string, chainId: number) => [
    queryKeys.marketplace.orders(gardenAddress, chainId),
    queryKeys.marketplace.all,
  ],

  // Queries to invalidate after a fraction is purchased via yield
  onFractionPurchased: (hypercertId: string, chainId: number) => [
    queryKeys.marketplace.tradeHistory(hypercertId, chainId),
    queryKeys.marketplace.all,
  ],

  // Invalidate deployment allowlist (after add/remove)
  invalidateAllowlist: (chainId: number) => [
    queryKeys.role.allowlist(chainId),
    queryKeys.role.deploymentPermissions(),
  ],

  // Invalidate gardener profile
  invalidateGardenerProfile: (address?: string, chainId?: number) => {
    if (address && chainId) {
      return [queryKeys.gardenerProfile.byAddress(address, chainId)];
    }
    return [queryKeys.gardenerProfile.all];
  },

  // Invalidate ENS data
  invalidateEns: (address?: string) => {
    if (address) {
      return [queryKeys.ens.name(address), queryKeys.ens.avatar(address)];
    }
    return [queryKeys.ens.all];
  },

  // Invalidate ENS registration data (after claim or status change)
  invalidateEnsRegistration: (slug?: string, address?: string) => {
    const keys: Array<
      | typeof queryKeys.ens.all
      | ReturnType<typeof queryKeys.ens.registrationStatus>
      | ReturnType<typeof queryKeys.ens.availability>
      | ReturnType<typeof queryKeys.ens.protocolMembership>
    > = [];
    if (slug) {
      keys.push(queryKeys.ens.registrationStatus(slug));
      keys.push(queryKeys.ens.availability(slug));
    }
    if (address) {
      keys.push(queryKeys.ens.protocolMembership(address));
    }
    return keys.length > 0 ? keys : [queryKeys.ens.all];
  },

  // Invalidate assessments (uses byGardenBase for prefix matching regardless of limit)
  invalidateAssessments: (gardenAddress?: string, chainId?: number) => {
    if (gardenAddress && chainId) {
      return [queryKeys.assessments.byGardenBase(gardenAddress, chainId)];
    }
    return [queryKeys.assessments.all];
  },

  // Invalidate community data for a garden
  invalidateCommunity: (gardenAddress: string, chainId: number) => [
    queryKeys.community.garden(gardenAddress, chainId),
    queryKeys.community.pools(gardenAddress, chainId),
  ],

  // Invalidate yield data for a garden (uses allocationsBase for prefix matching regardless of limit)
  invalidateYield: (gardenAddress: string, chainId: number) => [
    queryKeys.yield.allocationsBase(gardenAddress, chainId),
    queryKeys.yield.splitConfig(gardenAddress, chainId),
  ],

  // Queries to invalidate after community creation (garden mint)
  onCommunityCreated: (gardenAddress: string, chainId: number) => [
    queryKeys.community.garden(gardenAddress, chainId),
    queryKeys.community.pools(gardenAddress, chainId),
    queryKeys.community.all,
  ],

  // Queries to invalidate after yield allocation (uses allocationsBase for prefix matching regardless of limit)
  onYieldAllocated: (gardenAddress: string, assetAddress: string, chainId: number) => [
    queryKeys.yield.allocationsBase(gardenAddress, chainId),
    queryKeys.yield.byAsset(assetAddress, chainId),
    queryKeys.yield.pendingYield(gardenAddress, assetAddress, chainId),
    queryKeys.yield.all,
  ],

  // Queries to invalidate after split ratio update
  onSplitRatioUpdated: (gardenAddress: string, chainId: number) => [
    queryKeys.yield.splitConfig(gardenAddress, chainId),
  ],

  // Queries to invalidate after conviction strategies are updated
  onConvictionStrategiesUpdated: (gardenAddress: string, chainId: number) => [
    queryKeys.conviction.strategies(gardenAddress, chainId),
  ],

  // Queries to invalidate after support is allocated in a signal pool
  onSupportAllocated: (poolAddress: string, voterAddress: string, chainId: number) => [
    queryKeys.conviction.convictionWeights(poolAddress, chainId),
    queryKeys.conviction.memberPower(poolAddress, voterAddress, chainId),
  ],

  // Queries to invalidate after pool configuration changes (decay, points, hat IDs)
  // Note: uses conviction.all for broad memberPower invalidation since voter address is unavailable
  onPoolConfigChanged: (poolAddress: string, chainId: number) => [
    queryKeys.conviction.convictionWeights(poolAddress, chainId),
    queryKeys.conviction.registeredHypercerts(poolAddress, chainId),
    queryKeys.conviction.all,
  ],

  // Queries to invalidate after a hypercert is registered/deregistered
  onHypercertRegistrationChanged: (poolAddress: string, chainId: number) => [
    queryKeys.conviction.registeredHypercerts(poolAddress, chainId),
    queryKeys.conviction.convictionWeights(poolAddress, chainId),
  ],

  // Queries to invalidate after a successful vault deposit
  onVaultDeposit: (gardenAddress: string, userAddress: string | undefined, chainId: number) => {
    const keys: Array<
      | ReturnType<typeof queryKeys.vaults.byGarden>
      | ReturnType<typeof queryKeys.vaults.deposits>
      | ReturnType<typeof queryKeys.vaults.eventsBase>
      | ReturnType<typeof queryKeys.vaults.myDeposits>
      | ReturnType<typeof queryKeys.vaults.myDepositsByUser>
    > = [
      queryKeys.vaults.byGarden(gardenAddress, chainId),
      queryKeys.vaults.deposits(gardenAddress, chainId),
      queryKeys.vaults.eventsBase(gardenAddress, chainId),
    ];

    if (userAddress) {
      keys.push(queryKeys.vaults.myDeposits(gardenAddress, userAddress, chainId));
      keys.push(queryKeys.vaults.myDepositsByUser(userAddress, chainId));
    }

    return keys;
  },

  // Queries to invalidate after a successful vault withdraw
  onVaultWithdraw: (gardenAddress: string, userAddress: string | undefined, chainId: number) =>
    queryInvalidation.onVaultDeposit(gardenAddress, userAddress, chainId),

  // Queries to invalidate after a successful harvest/emergency action
  onVaultHarvest: (gardenAddress: string, chainId: number) => [
    queryKeys.vaults.byGarden(gardenAddress, chainId),
    queryKeys.vaults.eventsBase(gardenAddress, chainId),
  ],

  // Queries to invalidate after a cookie jar withdrawal
  onCookieJarWithdraw: (
    gardenAddress: string,
    jarAddress: string,
    userAddress: string | undefined,
    chainId: number
  ) => {
    const keys: Array<
      | ReturnType<typeof queryKeys.cookieJar.byGarden>
      | ReturnType<typeof queryKeys.cookieJar.jarDetail>
      | ReturnType<typeof queryKeys.cookieJar.userHistory>
    > = [
      queryKeys.cookieJar.byGarden(gardenAddress, chainId),
      queryKeys.cookieJar.jarDetail(jarAddress, chainId),
    ];

    if (userAddress) {
      keys.push(queryKeys.cookieJar.userHistory(jarAddress, userAddress, chainId));
    }

    return keys;
  },

  // Queries to invalidate after a cookie jar deposit
  onCookieJarDeposit: (gardenAddress: string, jarAddress: string, chainId: number) => [
    queryKeys.cookieJar.byGarden(gardenAddress, chainId),
    queryKeys.cookieJar.jarDetail(jarAddress, chainId),
  ],

  // Queries to invalidate after a cookie jar admin action (pause/unpause/update limits)
  onCookieJarAdminAction: (gardenAddress: string, jarAddress: string, chainId: number) => [
    queryKeys.cookieJar.byGarden(gardenAddress, chainId),
    queryKeys.cookieJar.jarDetail(jarAddress, chainId),
  ],
};

// Type-safe query key helpers
export type QueryKey =
  | typeof queryKeys.all
  | ReturnType<typeof queryKeys.queue.stats>
  | ReturnType<typeof queryKeys.queue.jobs>
  | ReturnType<typeof queryKeys.queue.pendingCount>
  | typeof queryKeys.works.all
  | ReturnType<typeof queryKeys.works.online>
  | ReturnType<typeof queryKeys.works.offline>
  | ReturnType<typeof queryKeys.works.merged>
  | ReturnType<typeof queryKeys.works.approvals>
  | typeof queryKeys.workApprovals.all
  | ReturnType<typeof queryKeys.workApprovals.byAttester>
  | ReturnType<typeof queryKeys.workApprovals.offline>
  | typeof queryKeys.offline.all
  | ReturnType<typeof queryKeys.offline.status>
  | ReturnType<typeof queryKeys.offline.sync>
  | typeof queryKeys.media.all
  | ReturnType<typeof queryKeys.media.forJob>
  | typeof queryKeys.hypercerts.all
  | ReturnType<typeof queryKeys.hypercerts.attestations>
  | ReturnType<typeof queryKeys.hypercerts.list>
  | ReturnType<typeof queryKeys.hypercerts.detail>
  | ReturnType<typeof queryKeys.hypercerts.drafts>
  | typeof queryKeys.vaults.all
  | ReturnType<typeof queryKeys.vaults.byChain>
  | ReturnType<typeof queryKeys.vaults.byGarden>
  | ReturnType<typeof queryKeys.vaults.deposits>
  | ReturnType<typeof queryKeys.vaults.myDeposits>
  | ReturnType<typeof queryKeys.vaults.events>
  | ReturnType<typeof queryKeys.vaults.preview>
  | typeof queryKeys.platform.all
  | ReturnType<typeof queryKeys.platform.stats>
  | typeof queryKeys.assessments.all
  | ReturnType<typeof queryKeys.assessments.byChain>
  | ReturnType<typeof queryKeys.assessments.byGarden>
  | typeof queryKeys.conviction.all
  | ReturnType<typeof queryKeys.conviction.strategies>
  | ReturnType<typeof queryKeys.conviction.registeredHypercerts>
  | ReturnType<typeof queryKeys.conviction.convictionWeights>
  | ReturnType<typeof queryKeys.conviction.memberPower>
  | typeof queryKeys.community.all
  | ReturnType<typeof queryKeys.community.garden>
  | ReturnType<typeof queryKeys.community.pools>
  | typeof queryKeys.cookieJar.all
  | ReturnType<typeof queryKeys.cookieJar.byGarden>
  | ReturnType<typeof queryKeys.cookieJar.jarDetail>
  | ReturnType<typeof queryKeys.cookieJar.userHistory>
  | typeof queryKeys.yield.all
  | ReturnType<typeof queryKeys.yield.allocationsBase>
  | ReturnType<typeof queryKeys.yield.allocations>
  | ReturnType<typeof queryKeys.yield.byAsset>
  | ReturnType<typeof queryKeys.yield.splitConfig>
  | ReturnType<typeof queryKeys.yield.pendingYield>
  | ReturnType<typeof queryKeys.yield.protocolSummary>
  | typeof queryKeys.ens.all
  | ReturnType<typeof queryKeys.ens.name>
  | ReturnType<typeof queryKeys.ens.address>
  | ReturnType<typeof queryKeys.ens.avatar>
  | ReturnType<typeof queryKeys.ens.registrationStatus>
  | ReturnType<typeof queryKeys.ens.availability>
  | ReturnType<typeof queryKeys.ens.protocolMembership>
  | typeof queryKeys.marketplace.all
  | ReturnType<typeof queryKeys.marketplace.orders>
  | ReturnType<typeof queryKeys.marketplace.activeOrder>
  | ReturnType<typeof queryKeys.marketplace.sellerOrders>
  | ReturnType<typeof queryKeys.marketplace.preview>
  | ReturnType<typeof queryKeys.marketplace.tradeHistory>
  | ReturnType<typeof queryKeys.marketplace.approvals>
  | ReturnType<typeof queryKeys.role.allowlist>;

export type WorksQueryKey =
  | typeof queryKeys.works.all
  | ReturnType<typeof queryKeys.works.online>
  | ReturnType<typeof queryKeys.works.offline>
  | ReturnType<typeof queryKeys.works.merged>
  | ReturnType<typeof queryKeys.works.approvals>;

export type QueueQueryKey =
  | typeof queryKeys.queue.all
  | ReturnType<typeof queryKeys.queue.stats>
  | ReturnType<typeof queryKeys.queue.jobs>
  | ReturnType<typeof queryKeys.queue.pendingCount>;
