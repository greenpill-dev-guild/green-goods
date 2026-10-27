/**
 * useCommitmentVoucherOutcomes Hook
 *
 * A promise's voucher outcomes for its inspector (PRD-1323), published through the
 * `usePoolConsoleController` leaf. A request's rewards are read for the member who took it up, as
 * their own promise page reads them; an offer's voucher payment is the offer's, read for the
 * steward viewing. Each issuer is named from that reader's voucher directory. An offer paid in a
 * gardener issuer's vouchers also reads the shared pool's listing of that token. Null while nothing
 * is read, and for a promise that pays no reward and takes no vouchers.
 *
 * @module hooks/admin-ui/pool/useCommitmentVoucherOutcomes
 */

import { useMemo } from "react";
import { SERVICE_ISSUER_ROUTES } from "../../../modules/commitment-pooling/service-issuer-metadata";
import type { ServiceIssuerRoute } from "../../../modules/commitment-pooling/service-issuer-types";
import type { CommitmentReadModel } from "../../../modules/commitment-pooling/types-core";
import {
  type CommitmentVoucherOutcomes,
  selectCommitmentVoucherOutcomes,
  selectVoucherOutcomesReader,
} from "../../../modules/commitment-pooling/voucher-outcomes";
import type { Address } from "../../../types/domain";
import { getNetworkContracts } from "../../../utils/blockchain/contracts";
import { useServiceAccess } from "../../commitment-pooling/useServiceAccess";
import {
  serviceIssuerListingKey,
  useServiceIssuerListings,
} from "../../commitment-pooling/useServiceIssuerOnboarding";
import { useVoucherWallet } from "../../commitment-pooling/useVoucherWallet";

const NO_ROUTES: readonly ServiceIssuerRoute[] = [];

export function useCommitmentVoucherOutcomes(input: {
  chainId: number;
  commitment: Pick<
    CommitmentReadModel,
    "commitmentId" | "direction" | "leadProvider" | "counterparty"
  > | null;
  /** The steward viewing, who reads an offer's terms. */
  viewer: Address | undefined;
}): CommitmentVoucherOutcomes | null {
  const { chainId, commitment, viewer } = input;
  const reader = selectVoucherOutcomesReader(commitment, viewer);
  const commitmentId = commitment?.commitmentId;
  // The service read and the voucher directory are read as the same account.
  const { key, scope } = useMemo(() => {
    if (commitmentId === undefined || !reader) return { key: null, scope: null };
    const coreModule = getNetworkContracts(chainId).commitmentPoolingModule as Address;
    return {
      key: { sourceChainId: chainId, coreModule, commitmentId, buyer: reader },
      scope: { sourceChainId: chainId, coreModule, account: reader },
    };
  }, [chainId, commitmentId, reader]);
  const access = useServiceAccess(key);
  const issuers = useVoucherWallet(scope).data?.issuers;
  // Only an offer paid in vouchers reads the pool, where a gardener issuer's token is listed.
  const listings = useServiceIssuerListings(
    access.data?.offer?.voucher ? SERVICE_ISSUER_ROUTES : NO_ROUTES
  ).data;
  return useMemo(
    () =>
      selectCommitmentVoucherOutcomes(access.data, issuers, {
        routes: SERVICE_ISSUER_ROUTES,
        listing: (routeId, assetId) => listings?.get(serviceIssuerListingKey(routeId, assetId)),
      }),
    [access.data, issuers, listings]
  );
}
