import { queryKeys } from "./registry";
import { financeInvalidation } from "./invalidation-finance";

export const queryInvalidation = {
  invalidateAll: () => queryKeys.all,

  invalidateQueueStats: () => queryKeys.queue.stats(),

  invalidateWorksForGarden: (gardenId: string, chainId: number) => [
    queryKeys.works.online(gardenId, chainId),
    queryKeys.works.offline(gardenId),
    queryKeys.works.merged(gardenId, chainId),
  ],

  invalidateAllWorks: () => queryKeys.works.all,

  invalidateOfflineState: () => queryKeys.offline.all,

  onJobAdded: (gardenId: string, chainId: number, userAddress?: string) => {
    const keys: Array<
      | ReturnType<typeof queryKeys.queue.stats>
      | ReturnType<typeof queryKeys.queue.pendingCount>
      | ReturnType<typeof queryKeys.works.offline>
      | ReturnType<typeof queryKeys.works.merged>
      | ReturnType<typeof queryKeys.works.mineByUser>
    > = [
      queryKeys.queue.stats(),
      queryKeys.queue.pendingCount(),
      queryKeys.works.offline(gardenId),
      queryKeys.works.merged(gardenId, chainId),
    ];

    if (userAddress) {
      keys.push(queryKeys.works.mineByUser(userAddress));
    }

    return keys;
  },

  onJobCompleted: (gardenId: string, chainId: number, userAddress?: string) => {
    const keys: Array<
      | ReturnType<typeof queryKeys.queue.stats>
      | ReturnType<typeof queryKeys.queue.pendingCount>
      | typeof queryKeys.works.all
      | ReturnType<typeof queryKeys.works.online>
      | ReturnType<typeof queryKeys.works.merged>
      | ReturnType<typeof queryKeys.works.approvals>
      | ReturnType<typeof queryKeys.works.mineByUser>
    > = [
      queryKeys.queue.stats(),
      queryKeys.queue.pendingCount(),
      queryKeys.works.all,
      queryKeys.works.online(gardenId, chainId),
      queryKeys.works.merged(gardenId, chainId),
      queryKeys.works.approvals(),
      queryKeys.works.approvals(undefined, chainId),
    ];

    if (userAddress) {
      keys.push(queryKeys.works.approvals(userAddress, chainId));
      keys.push(queryKeys.works.mineByUser(userAddress));
    }

    return keys;
  },

  onSyncCompleted: () => [queryKeys.queue.all, queryKeys.works.all, queryKeys.offline.sync()],

  invalidateGardens: (chainId: number) => [
    queryKeys.gardens.all,
    queryKeys.gardens.byChain(chainId),
  ],

  invalidateGarden: (gardenId: string, chainId: number) => [
    queryKeys.gardens.byChain(chainId),
    queryKeys.gardens.detail(gardenId, chainId),
  ],

  invalidateDrafts: (userAddress: string, chainId: number) => [
    queryKeys.drafts.all,
    queryKeys.drafts.list(userAddress, chainId),
  ],

  invalidateDraft: (draftId: string) => [
    queryKeys.drafts.detail(draftId),
    queryKeys.drafts.images(draftId),
  ],

  invalidateHypercerts: (gardenId?: string, chainId?: number, status?: string) => [
    queryKeys.hypercerts.all,
    queryKeys.hypercerts.list(gardenId, chainId, status),
    queryKeys.hypercerts.attestations(gardenId),
  ],

  invalidateMarketplace: (gardenAddress?: string, chainId?: number) => {
    if (gardenAddress && chainId) {
      return [queryKeys.marketplace.orders(gardenAddress, chainId), queryKeys.marketplace.all];
    }
    return [queryKeys.marketplace.all];
  },

  onMarketplaceListingChanged: (gardenAddress: string, chainId: number) => [
    queryKeys.marketplace.orders(gardenAddress, chainId),
    queryKeys.marketplace.all,
  ],

  onFractionPurchased: (hypercertId: string, chainId: number) => [
    queryKeys.marketplace.tradeHistory(hypercertId, chainId),
    queryKeys.marketplace.all,
  ],

  invalidateAllowlist: (chainId: number) => [
    queryKeys.role.allowlist(chainId),
    queryKeys.role.deploymentPermissions(),
  ],

  invalidateGardenerProfile: (address?: string, chainId?: number) => {
    if (address && chainId) {
      return [queryKeys.gardenerProfile.byAddress(address, chainId)];
    }
    return [queryKeys.gardenerProfile.all];
  },

  invalidateEns: (address?: string) => {
    if (address) {
      return [queryKeys.ens.name(address), queryKeys.ens.avatar(address)];
    }
    return [queryKeys.ens.all];
  },

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

  invalidateAssessments: (gardenAddress?: string, chainId?: number) => {
    if (gardenAddress && chainId) {
      return [
        queryKeys.assessments.byGardenBase(gardenAddress, chainId),
        queryKeys.gardens.byChain(chainId),
        queryKeys.gardens.detail(gardenAddress, chainId),
      ];
    }
    return [queryKeys.assessments.all];
  },

  /** Refresh sendable-token balances after a token send (direct RPC reads). */
  onTokenSent: (account: string, chainId: number) => [
    queryKeys.tokens.balances(account, chainId),
    queryKeys.tokens.all,
  ],

  ...financeInvalidation,
};
