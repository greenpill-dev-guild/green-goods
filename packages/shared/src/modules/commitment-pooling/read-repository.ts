import { readIndexedEarnedOptIn, retainIndexedEarnedOptIn } from "./data-earned-voucher";
import type { GraphQLReader } from "../data/graphql-client";
import { discoverVoucherSetups, readVoucherDestinationObservation } from "./data-voucher-service";
import { getServiceAccessProjection } from "./data-service-access";
import type { ServiceAccessKey } from "./service-access-types";
import { readServiceAccess } from "./service-access-chain";
import { getCommitmentActivity, getPoolMemberHistory } from "./data-activity";
import {
  getCommitmentClaimRequests,
  getCommitmentDetail,
  getCommitments,
  getCommitmentWorkAttributionsByWork,
  getFallbackConfirmationCandidates,
  getPoolClaimRequests,
} from "./data-commitments";
import {
  getCommitmentCycleDetail,
  getCommitmentCycles,
  getCommitmentPoolDetail,
  getCommitmentPools,
} from "./data-pools";

export function createCommitmentPoolingReadRepository(
  reader: GraphQLReader,
  serviceReads?: Parameters<typeof readServiceAccess>[2]
) {
  return {
    getServiceAccess: async (key: ServiceAccessKey) => {
      const [snapshot, projection, earned] = await Promise.all([
        readServiceAccess(key, undefined, {
          discoverSetups: (scope, module) => discoverVoucherSetups(scope, module, reader),
          observeDestination: (setup) => readVoucherDestinationObservation(setup, reader),
          ...serviceReads,
        }),
        getServiceAccessProjection(key, reader).catch(() => undefined),
        readIndexedEarnedOptIn(key, reader).catch(() => null),
      ]);
      // Index availability never downgrades authoritative reads or establishes Legacy.
      if (
        snapshot.mode === "unavailable" &&
        projection?.offer &&
        projection.offer.paymentRoute !== 0
      ) {
        snapshot.knownService = true;
        snapshot.acceptancePolicy.knownOptIn = true;
        snapshot.acceptancePolicy.blockGenericMemberAcceptance = true;
      }
      retainIndexedEarnedOptIn(snapshot, earned);
      return snapshot;
    },
    getServiceAccessProjection: (key: ServiceAccessKey) => getServiceAccessProjection(key, reader),
    getCommitments: (input: Parameters<typeof getCommitments>[0]) => getCommitments(input, reader),
    getCommitmentDetail: (
      chainId: Parameters<typeof getCommitmentDetail>[0],
      commitmentId: Parameters<typeof getCommitmentDetail>[1]
    ) => getCommitmentDetail(chainId, commitmentId, reader),
    getCommitmentClaimRequests: (
      chainId: Parameters<typeof getCommitmentClaimRequests>[0],
      commitmentId: Parameters<typeof getCommitmentClaimRequests>[1],
      state?: Parameters<typeof getCommitmentClaimRequests>[2]
    ) => getCommitmentClaimRequests(chainId, commitmentId, state, reader),
    getCommitmentWorkAttributionsByWork: (
      chainId: Parameters<typeof getCommitmentWorkAttributionsByWork>[0],
      workUID: Parameters<typeof getCommitmentWorkAttributionsByWork>[1]
    ) => getCommitmentWorkAttributionsByWork(chainId, workUID, reader),
    getFallbackConfirmationCandidates: (
      input: Parameters<typeof getFallbackConfirmationCandidates>[0]
    ) => getFallbackConfirmationCandidates(input, reader),
    getPoolClaimRequests: (input: Parameters<typeof getPoolClaimRequests>[0]) =>
      getPoolClaimRequests(input, reader),
    getCommitmentPools: (
      chainId: Parameters<typeof getCommitmentPools>[0],
      garden?: Parameters<typeof getCommitmentPools>[1]
    ) => getCommitmentPools(chainId, garden, reader),
    getCommitmentPoolDetail: (
      chainId: Parameters<typeof getCommitmentPoolDetail>[0],
      poolId: Parameters<typeof getCommitmentPoolDetail>[1]
    ) => getCommitmentPoolDetail(chainId, poolId, reader),
    getCommitmentCycles: (input: Parameters<typeof getCommitmentCycles>[0]) =>
      getCommitmentCycles(input, reader),
    getCommitmentCycleDetail: (
      chainId: Parameters<typeof getCommitmentCycleDetail>[0],
      cycleId: Parameters<typeof getCommitmentCycleDetail>[1]
    ) => getCommitmentCycleDetail(chainId, cycleId, reader),
    getCommitmentActivity: (input: Parameters<typeof getCommitmentActivity>[0]) =>
      getCommitmentActivity(input, reader),
    getPoolMemberHistory: (
      chainId: Parameters<typeof getPoolMemberHistory>[0],
      poolId: Parameters<typeof getPoolMemberHistory>[1],
      account: Parameters<typeof getPoolMemberHistory>[2]
    ) => getPoolMemberHistory(chainId, poolId, account, reader),
  };
}

export type CommitmentPoolingReadRepository = ReturnType<
  typeof createCommitmentPoolingReadRepository
>;
