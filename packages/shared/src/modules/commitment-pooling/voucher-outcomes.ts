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
 * An offer paid with a gardener issuer's vouchers also says where that token stands in the shared
 * pool: admitted or not, and its holding limit, the current cap.
 *
 * @module modules/commitment-pooling/voucher-outcomes
 */

import type { Address } from "../../types/domain";
import type { ServiceAccessSnapshot, ServiceAsset } from "./service-access-types";
import { requestRewardDeliveries } from "./service-access-wallet";
import type { RequestRewardDelivery, VoucherIssuer } from "./service-access-wallet-types";
import { type IssuerPoolStatus, issuerPoolStatus } from "./service-issuer-pool";
import type { ServiceIssuerAsset, ServiceIssuerPoolListing } from "./service-issuer-types";
import type { CommitmentReadModel } from "./types-core";

/** How a reward's issuer reads in copy; null when the directory doesn't name it. */
export type VoucherIssuerName = Pick<VoucherIssuer, "name" | "gender">;

/** A gardener issuer's token in the shared pool, or unread while the pool's listing isn't read. */
type IssuerPoolAdmission =
  | { status: "unread" }
  | {
      status: IssuerPoolStatus;
      /** The pool's holding limit for the token: the current cap. Zero once delisted. */
      limit: bigint;
      /** What the pool holds of the token now. */
      holding: bigint;
    };

/** The reviewed issuer routes, and the pool's listing of each asset; undefined while unread. */
interface IssuerPoolRead {
  routes: readonly {
    service: { id: string };
    assets: readonly (Pick<ServiceIssuerAsset, "id" | "kind" | "ownerReserve" | "delisting"> & {
      token: { address: Address };
    })[];
  }[];
  listing: (routeId: string, assetId: string) => ServiceIssuerPoolListing | undefined;
}

const NO_POOL_READ: IssuerPoolRead = { routes: [], listing: () => undefined };
const sameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Where a voucher payment's token stands in the pool, when a gardener issuer issues it: the
 * reviewed member asset with that token and owner, read through its pool listing. Null for a
 * collective's token and for a token no reviewed route carries.
 */
function gardenerPoolAdmission(
  voucher: { asset: ServiceAsset; issuer: Address },
  pool: IssuerPoolRead
): IssuerPoolAdmission | null {
  for (const route of pool.routes) {
    const asset = route.assets.find(
      (entry) =>
        sameAddress(entry.token.address, voucher.asset.token) &&
        sameAddress(entry.ownerReserve, voucher.issuer)
    );
    if (!asset) continue;
    if (asset.kind !== "individual") return null;
    const listing = pool.listing(route.service.id, asset.id);
    return listing
      ? { status: issuerPoolStatus(listing, asset), limit: listing.limit, holding: listing.holding }
      : { status: "unread" };
  }
  return null;
}

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
    /** A gardener issuer's token in the shared pool; null for a collective's token. */
    admission: IssuerPoolAdmission | null;
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
 * directory (`VoucherWalletSnapshot.issuers`) and a gardener issuer's payment placed in the pool
 * from its listing. Null when the promise pays no reward and takes no voucher payment, so the
 * inspector shows nothing for it.
 */
export function selectCommitmentVoucherOutcomes(
  snapshot: ServiceAccessSnapshot | null | undefined,
  issuers: readonly VoucherIssuer[] = [],
  pool: IssuerPoolRead = NO_POOL_READ
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
          admission: gardenerPoolAdmission(voucher, pool),
        }
      : null;
  if (rewards.length === 0 && !payment) return null;
  return { rewards, workFulfilled: snapshot.pilot?.reward?.workFulfilled ?? false, payment };
}
