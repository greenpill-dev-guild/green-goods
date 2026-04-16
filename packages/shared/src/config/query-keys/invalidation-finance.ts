import { queryKeys } from "./index";

export const financeInvalidation = {
  invalidateCommunity: (gardenAddress: string, chainId: number) => [
    queryKeys.community.garden(gardenAddress, chainId),
    queryKeys.community.pools(gardenAddress, chainId),
  ],

  invalidateYield: (gardenAddress: string, chainId: number) => [
    queryKeys.yield.allocationsBase(gardenAddress, chainId),
    queryKeys.yield.splitConfig(gardenAddress, chainId),
  ],

  onCommunityCreated: (gardenAddress: string, chainId: number) => [
    queryKeys.community.garden(gardenAddress, chainId),
    queryKeys.community.pools(gardenAddress, chainId),
    queryKeys.community.all,
  ],

  onYieldAllocated: (gardenAddress: string, assetAddress: string, chainId: number) => [
    queryKeys.yield.allocationsBase(gardenAddress, chainId),
    queryKeys.yield.byAsset(assetAddress, chainId),
    queryKeys.yield.pendingYield(gardenAddress, assetAddress, chainId),
    queryKeys.yield.all,
  ],

  onSplitRatioUpdated: (gardenAddress: string, chainId: number) => [
    queryKeys.yield.splitConfig(gardenAddress, chainId),
  ],

  onConvictionStrategiesUpdated: (gardenAddress: string, chainId: number) => [
    queryKeys.conviction.strategies(gardenAddress, chainId),
  ],

  onSupportAllocated: (poolAddress: string, voterAddress: string, chainId: number) => [
    queryKeys.conviction.convictionWeights(poolAddress, chainId),
    queryKeys.conviction.memberPower(poolAddress, voterAddress, chainId),
  ],

  onPoolConfigChanged: (poolAddress: string, chainId: number) => [
    queryKeys.conviction.convictionWeights(poolAddress, chainId),
    queryKeys.conviction.registeredHypercerts(poolAddress, chainId),
    queryKeys.conviction.all,
  ],

  onHypercertRegistrationChanged: (poolAddress: string, chainId: number) => [
    queryKeys.conviction.registeredHypercerts(poolAddress, chainId),
    queryKeys.conviction.convictionWeights(poolAddress, chainId),
  ],

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

  onVaultWithdraw: (gardenAddress: string, userAddress: string | undefined, chainId: number) =>
    financeInvalidation.onVaultDeposit(gardenAddress, userAddress, chainId),

  onVaultHarvest: (gardenAddress: string, chainId: number) => [
    queryKeys.vaults.byGarden(gardenAddress, chainId),
    queryKeys.vaults.eventsBase(gardenAddress, chainId),
  ],

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

  onCookieJarDeposit: (gardenAddress: string, jarAddress: string, chainId: number) => [
    queryKeys.cookieJar.byGarden(gardenAddress, chainId),
    queryKeys.cookieJar.jarDetail(jarAddress, chainId),
  ],

  onCookieJarAdminAction: (gardenAddress: string, jarAddress: string, chainId: number) => [
    queryKeys.cookieJar.byGarden(gardenAddress, chainId),
    queryKeys.cookieJar.jarDetail(jarAddress, chainId),
  ],
};
