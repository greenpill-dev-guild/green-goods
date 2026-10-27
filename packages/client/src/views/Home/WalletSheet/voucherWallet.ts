import type {
  VoucherBookingRef,
  VoucherIssuer,
  VoucherWalletSnapshot,
} from "@green-goods/shared/commitment-pooling";
import type { Address } from "@green-goods/shared/types/domain";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";

/** Pilot vouchers carry six decimals where the asset doesn't say. */
const VOUCHER_DECIMALS = 6;

/**
 * Whether the voucher pilot answered for this account. Until its deployment is adopted the read
 * is unavailable, and the wallet keeps to Cookies and Tokens.
 */
export function hasVoucherWallet(
  wallet: VoucherWalletSnapshot | null | undefined
): wallet is VoucherWalletSnapshot {
  return wallet !== null && wallet !== undefined && wallet.evidence !== "unavailable";
}

/**
 * What the Vouchers tab draws, in the lab's order (`SWallet`): a voucher a booking holds, as its
 * own row (decision 11); a return on its way, pending until it arrives; then what the account
 * holds of each issuer. A booking that is settling or returning shows through its return
 * instead, so no voucher is counted twice. An issuer the account holds none of has no row, so
 * an account with nothing yet reads "No vouchers yet".
 */
export function selectVoucherWalletRows(wallet: VoucherWalletSnapshot) {
  return {
    bookings: wallet.bookings.filter((escrow) => escrow.stage === "held" && escrow.held > 0n),
    returns: wallet.returns,
    holdings: wallet.holdings.filter((holding) => holding.available > 0n),
  };
}

export function voucherIssuerOf(
  wallet: VoucherWalletSnapshot,
  account: Address
): VoucherIssuer | undefined {
  return wallet.issuers.find((issuer) => issuer.account.toLowerCase() === account.toLowerCase());
}

/** Whole vouchers as the lab writes them ("9", "0.99"), never cut to "0" while some remain. */
export function formatVouchers(units: bigint, decimals: number | null, locale: string): string {
  return formatTokenAmount(units, decimals ?? VOUCHER_DECIMALS, 2, locale, true);
}

/** The booking's own page, in its garden, whatever garden Home has active. */
export function voucherBookingPath(booking: VoucherBookingRef): string {
  return `/home/${booking.garden}/commitments/${booking.commitmentId.toString()}`;
}
