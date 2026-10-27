/**
 * useCommitmentVoucherOutcomes Hook
 *
 * A promise's voucher outcomes for its inspector (PRD-1323), published through the
 * `usePoolConsoleController` leaf. A request's rewards are read for the member who took it up, as
 * their own promise page reads them; an offer's voucher payment is the offer's, read for the
 * steward viewing. Each issuer is named from that reader's voucher directory. Null while nothing is
 * read, and for a promise that pays no reward and takes no vouchers.
 *
 * @module hooks/admin-ui/pool/useCommitmentVoucherOutcomes
 */

import { useMemo } from "react";
import type { CommitmentReadModel } from "../../../modules/commitment-pooling/types-core";
import {
  type CommitmentVoucherOutcomes,
  selectCommitmentVoucherOutcomes,
  selectVoucherOutcomesReader,
} from "../../../modules/commitment-pooling/voucher-outcomes";
import type { Address } from "../../../types/domain";
import { getNetworkContracts } from "../../../utils/blockchain/contracts";
import { useServiceAccess } from "../../commitment-pooling/useServiceAccess";
import { useVoucherWallet } from "../../commitment-pooling/useVoucherWallet";

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
  return useMemo(
    () => selectCommitmentVoucherOutcomes(access.data, issuers),
    [access.data, issuers]
  );
}
