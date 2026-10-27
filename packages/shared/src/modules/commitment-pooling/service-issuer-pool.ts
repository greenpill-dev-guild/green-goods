/**
 * An issuer token's place in the shared pool, from the pool's own listing: not admitted yet while
 * its setup is pending, listed under a holding limit, or delisted. Admitted with a zero holding
 * limit is delisted: the pool takes in no more of the token, while holders keep their vouchers.
 * The Voucher Issuers card and a promise's inspector (PRD-1323) read it the same way.
 *
 * @module modules/commitment-pooling/service-issuer-pool
 */

import type { ServiceIssuerPoolListing } from "./service-issuer-types";

export type IssuerPoolStatus = "setup" | "listed" | "delisted";

export function issuerPoolStatus(listing: ServiceIssuerPoolListing): IssuerPoolStatus {
  if (!listing.admitted) return "setup";
  return listing.limit === 0n ? "delisted" : "listed";
}
