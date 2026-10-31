/**
 * An issuer token's place in the shared pool, from the pool's own listing: not admitted yet while
 * its setup is pending, listed under a holding limit, or delisted. Delisting sets a zero holding
 * limit: the pool takes in no more of the token, while holders keep their vouchers. Setup passes
 * through a zero limit too, since the registry admits the token before its cap lands, so a zero
 * limit reads as delisted only with the stewards' recorded delisting, or while the pool still holds
 * some of the token (it can only have taken it in under a limit). The Voucher Issuers card, a
 * member's own service and a promise's inspector (PRD-1323) read it the same way.
 *
 * @module modules/commitment-pooling/service-issuer-pool
 */

import type { ServiceIssuerAsset, ServiceIssuerPoolListing } from "./service-issuer-types";

export type IssuerPoolStatus = "setup" | "listed" | "delisted";

export function issuerPoolStatus(
  listing: ServiceIssuerPoolListing,
  asset: Pick<ServiceIssuerAsset, "delisting">
): IssuerPoolStatus {
  if (!listing.admitted) return "setup";
  if (listing.limit > 0n) return "listed";
  return asset.delisting || listing.holding > 0n ? "delisted" : "setup";
}
