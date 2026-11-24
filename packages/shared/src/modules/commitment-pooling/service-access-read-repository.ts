/**
 * The reads behind a voucher booking: the chain's service-access snapshot, the index's
 * projection of the same offer and claims, and the earned opt-in the index saw.
 *
 * They are composed here, apart from the pooling read repository, because the hooks every
 * installed-app screen starts with build that repository at import time
 * (`modules/commitment-pooling/data`). Composed there, the voucher chain readers and their
 * ABIs rode in the installed startup budget for screens that never book anything; the
 * promise page and the wallet's Vouchers tab reach them through `useServiceAccess` instead.
 *
 * @module modules/commitment-pooling/service-access-read-repository
 */

import type { GraphQLReader } from "../data/graphql-client";
import { readIndexedEarnedOptIn, retainIndexedEarnedOptIn } from "./data-earned-voucher";
import { getServiceAccessProjection } from "./data-service-access";
import { discoverVoucherSetups, readVoucherDestinationObservation } from "./data-voucher-service";
import { readServiceAccess } from "./service-access-chain";
import type { ServiceAccessKey } from "./service-access-types";

export function createServiceAccessReadRepository(
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
  };
}
