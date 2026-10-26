/**
 * A service offer on a garden's list of promises (PRD-1299, surface 5): what booking it takes
 * first, and who promises delivery, for the shared commitment row's detail line (DL-110).
 *
 * Only a collective issuer's voucher offer qualifies in the pilot's first slice: a member's own
 * service waits for slice 2. Anything the reads cannot establish leaves the row an ordinary
 * offer, never an error: a promise with no voucher route, an issuer the reader's wallet does not
 * name, holdings or token precision that could not be read. Until the deployment is adopted the
 * live reads answer "unavailable", so every row reads as an ordinary offer.
 *
 * @module modules/commitment-pooling/service-offer-line
 */

import type { ServiceAccessSnapshot } from "./service-access-types";
import type { VoucherIssuer, VoucherWalletSnapshot } from "./service-access-wallet-types";

export interface ServiceOfferLine {
  /** The issuer's name from its reviewed metadata: who promises delivery. */
  promisedBy: string;
  /** What booking takes first: the reader holds enough of the issuer's vouchers, or not. */
  booking: { kind: "hold"; held: bigint; decimals: number } | { kind: "exchange" };
}

const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
/** One account can issue several vouchers: an issuer's token is its account, chain and token. */
const sameIssuerToken = (left: VoucherIssuer, right: VoucherIssuer) =>
  same(left.account, right.account) &&
  left.asset.chainId === right.asset.chainId &&
  same(left.asset.token, right.asset.token);

export function serviceOfferLine(
  snapshot: Pick<ServiceAccessSnapshot, "mode" | "offer"> | null | undefined,
  wallet: Pick<VoucherWalletSnapshot, "evidence" | "issuers" | "holdings"> | null | undefined
): ServiceOfferLine | null {
  const voucher = snapshot?.mode === "voucher" ? snapshot.offer?.voucher : null;
  if (!voucher || !wallet || wallet.evidence === "unavailable") return null;
  const issuer = wallet.issuers.find(
    (each) =>
      each.kind === "collective" &&
      same(each.account, voucher.issuer) &&
      same(each.asset.token, voucher.asset.token)
  );
  const decimals = voucher.asset.decimals ?? issuer?.asset.decimals ?? null;
  if (!issuer || decimals === null) return null;
  const held =
    wallet.holdings.find((holding) => sameIssuerToken(holding.issuer, issuer))?.available ?? 0n;
  return {
    promisedBy: issuer.name,
    booking:
      held > 0n && held >= voucher.units ? { kind: "hold", held, decimals } : { kind: "exchange" },
  };
}
