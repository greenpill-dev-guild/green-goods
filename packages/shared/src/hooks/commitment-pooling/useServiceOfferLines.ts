/**
 * useServiceOfferLines Hook
 *
 * What booking each service offer on a garden's list of promises takes first, and who promises
 * it (PRD-1299 surface 5, decision 12), for the shared commitment row: the garden page's
 * Promises tab for visitors, and the garden's open promises over Home for its members. It reads
 * each approval-gated individual offer's service terms, sharing the promise page's cached read,
 * and the reader's vouchers. Reads only; an offer the reads cannot place stays an ordinary offer
 * (`serviceOfferLine`).
 *
 * @module hooks/commitment-pooling/useServiceOfferLines
 */

import { useMemo } from "react";

import {
  type ServiceOfferLine,
  serviceOfferLine,
} from "../../modules/commitment-pooling/service-offer-line";
import type { ServiceAccessKey } from "../../modules/commitment-pooling/service-access-types";
import type { CommitmentReadModel } from "../../modules/commitment-pooling/types-core";
import type { Address } from "../../types/domain";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useServiceAccessReads } from "./useServiceAccess";
import { useVoucherWallet } from "./useVoucherWallet";

type ListedOffer = Pick<
  CommitmentReadModel,
  "commitmentId" | "direction" | "onchainState" | "claimMode" | "claimType"
>;

/** A service is an approval-gated offer a person takes up, still open: only those are read. */
function mayBeService(promise: ListedOffer): boolean {
  return (
    promise.direction === "OFFER" &&
    promise.onchainState === "OFFERED" &&
    promise.claimMode === "APPROVAL_GATED" &&
    promise.claimType === "INDIVIDUAL"
  );
}

/** Each listed service offer's line for the signed-in reader, by decimal promise id. */
export function useServiceOfferLines(input: {
  chainId: number;
  offers: readonly ListedOffer[];
}): ReadonlyMap<string, ServiceOfferLine> {
  const { chainId, offers } = input;
  const viewer = usePrimaryAddress() as Address | null;
  const coreModule = getNetworkContracts(chainId).commitmentPoolingModule as Address;
  const keys = useMemo(
    (): ServiceAccessKey[] =>
      viewer
        ? offers.filter(mayBeService).map((offer) => ({
            sourceChainId: chainId,
            coreModule,
            commitmentId: offer.commitmentId,
            buyer: viewer,
          }))
        : [],
    [chainId, coreModule, offers, viewer]
  );
  const reads = useServiceAccessReads(keys);
  const wallet = useVoucherWallet(
    viewer && keys.length > 0 ? { sourceChainId: chainId, coreModule, account: viewer } : null
  ).data;

  const lines = new Map<string, ServiceOfferLine>();
  keys.forEach((key, index) => {
    const line = serviceOfferLine(reads[index]?.data, wallet);
    if (line) lines.set(key.commitmentId.toString(), line);
  });
  return lines;
}
