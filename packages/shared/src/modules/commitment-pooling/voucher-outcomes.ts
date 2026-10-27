/**
 * What a commitment's vouchers come to, as its garden's stewards see it in the promise's inspector
 * (PRD-1323): a request's rewards, or an offer's voucher payment.
 *
 * A request's rewards are each on their own: a voucher reward sent from its issuer's reserve
 * within the garden's allowance, and an optional G$ reward paid on Celo by the garden's payout
 * plan, each with its own state and receipt, so one received beside one still on its way reads as
 * normal. Nothing is set aside when the member is accepted: each reward draws on its source only
 * once the work is confirmed, and a voucher reward that finds the reserve or the allowance short
 * waits for the issuer instead of failing.
 *
 * @module modules/commitment-pooling/voucher-outcomes
 */

import type { Address } from "../../types/domain";
import type { ServiceAccessSnapshot, ServiceAsset } from "./service-access-types";
import { requestRewardDeliveries } from "./service-access-wallet";
import type { RequestRewardDelivery, VoucherIssuer } from "./service-access-wallet-types";
import type { CommitmentReadModel } from "./types-core";

/** How a reward's issuer reads in copy; null when the directory doesn't name it. */
export type VoucherIssuerName = Pick<VoucherIssuer, "name" | "gender">;

export interface CommitmentRewardOutcome extends RequestRewardDelivery {
  /** The voucher reward's issuer, by its reviewed name; null for G$ or an unnamed issuer. */
  issuer: VoucherIssuerName | null;
}

export interface CommitmentVoucherOutcomes {
  /** A request's rewards, the voucher one first: neither waits on the other. */
  rewards: readonly CommitmentRewardOutcome[];
  /** The member's work is confirmed, so each reward has started from its source. */
  workFulfilled: boolean;
  /** An offer's voucher payment, what one booking takes, under the offer's terms revision. */
  payment: {
    asset: ServiceAsset;
    issuer: VoucherIssuerName | null;
    /** The issuer's account, which approves each booking: what names an unnamed issuer. */
    issuerAccount: Address;
    units: bigint;
    revision: bigint;
  } | null;
}

/**
 * Whose service read holds a promise's outcomes. A request's rewards belong to the member who took
 * it up, so they are read as that member, as their own promise page reads them. An offer's terms
 * read the same for anyone, so the steward viewing reads them. Null for a request nobody has
 * taken up: it has no rewards yet.
 */
export function selectVoucherOutcomesReader(
  commitment: Pick<CommitmentReadModel, "direction" | "leadProvider" | "counterparty"> | null,
  viewer: Address | undefined
): Address | null {
  if (!commitment) return null;
  if (commitment.direction === "REQUEST") {
    return commitment.leadProvider ?? commitment.counterparty ?? null;
  }
  return viewer ?? null;
}

/**
 * The outcomes a service read carries for a promise, with each issuer named from the voucher
 * directory (`VoucherWalletSnapshot.issuers`). Null when the promise pays no reward and takes no
 * voucher payment, so the inspector shows nothing for it.
 */
export function selectCommitmentVoucherOutcomes(
  snapshot: ServiceAccessSnapshot | null | undefined,
  issuers: readonly VoucherIssuer[] = []
): CommitmentVoucherOutcomes | null {
  if (!snapshot) return null;
  const named = (account: string): VoucherIssuerName | null => {
    const issuer = issuers.find((entry) => entry.account.toLowerCase() === account.toLowerCase());
    return issuer ? { name: issuer.name, gender: issuer.gender } : null;
  };
  const rewards = (requestRewardDeliveries(snapshot) ?? []).map((delivery) => ({
    ...delivery,
    issuer: delivery.kind === "voucher" ? named(delivery.funder) : null,
  }));
  const voucher = snapshot.offer?.voucher ?? null;
  const payment =
    snapshot.offer && voucher
      ? {
          asset: voucher.asset,
          issuer: named(voucher.issuer),
          issuerAccount: voucher.issuer,
          units: voucher.units,
          revision: snapshot.offer.revision,
        }
      : null;
  if (rewards.length === 0 && !payment) return null;
  return { rewards, workFulfilled: snapshot.pilot?.reward?.workFulfilled ?? false, payment };
}
