import type {
  ServiceIssuerAction,
  ServiceIssuerAsset,
  ServiceIssuerBooking,
  ServiceIssuerSnapshot,
} from "@green-goods/shared/commitment-pooling";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { formatUnits, parseUnits } from "viem";

/** Never round a member's entered quantity into a different authorization. */
export function parseIssuerAmount(value: string, decimals: number): bigint | null {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) return null;
  if (!/^\d+(\.\d+)?$/.test(value) || (value.split(".")[1]?.length ?? 0) > decimals) return null;
  const amount = parseUnits(value, decimals);
  return amount > 0n && amount < (1n << 256n) - 1n ? amount : null;
}

export function issuerAmount(value: bigint, asset: ServiceIssuerAsset, locale: string) {
  return `${issuerCount(value, asset.decimals, locale)} ${asset.symbol}`;
}

/** A quantity without its unit, every decimal kept: the capacity and location numbers. */
export const issuerCount = (value: bigint, decimals: number, locale: string) =>
  formatTokenAmount(value, decimals, decimals, locale);

/** The same quantity as a number, only to choose a plural form. */
export const issuerPlural = (value: bigint, decimals: number) =>
  Number(formatUnits(value, decimals));

type Onchain = Extract<ServiceIssuerSnapshot, { evidence: "onchain" }>;
const sum = (values: bigint[]) => values.reduce((total, value) => total + value, 0n);
const OPEN_PHASES = new Set(["authorized", "deposited", "active"]);

/** A booking still holds part of the promise: asked, approved or under way, and not yet split. */
const bookingOpen = (b: ServiceIssuerBooking) =>
  !b.finalAllocation && OPEN_PHASES.has(b.result.phase) && b.result.decision !== "abort";

export interface IssuerCapacity {
  promised: bigint | null;
  booked: bigint | null;
  delivered: bigint | null;
  left: bigint | null;
}

/**
 * What the member can still deliver, from the reviewed terms and the verified bookings. One
 * voucher buys one unit of the service, so the numbers count vouchers' worth. Token balances
 * never stand in for them, returned vouchers restore nothing, and a booking read that failed
 * leaves them unknown rather than zero.
 */
export function issuerCapacity(snapshot: Onchain): IssuerCapacity {
  const promised = snapshot.asset.initialSupply;
  if (snapshot.bookings.status === "unavailable")
    return { promised, booked: null, delivered: null, left: null };
  const records = snapshot.bookings.records;
  const booked = sum(records.filter(bookingOpen).map((b) => b.authorization.voucherUnits));
  const delivered = sum(
    records.map((b) => b.finalAllocation?.allocation.releaseVoucherUnits ?? 0n)
  );
  const left =
    promised === null ? null : promised > booked + delivered ? promised - booked - delivered : 0n;
  return { promised, booked, delivered, left };
}

/** What the escrow still holds for the member's bookings: deposits and splits not yet moved. */
export function issuerEscrowed(snapshot: Onchain): bigint | null {
  if (snapshot.bookings.status === "unavailable") return null;
  return sum(
    snapshot.bookings.records.map((b) => {
      const split = b.finalAllocation;
      if (split) {
        const moving = (state: string, units: bigint) => (state === "succeeded" ? 0n : units);
        return (
          moving(split.release.state, split.allocation.releaseVoucherUnits) +
          moving(split.refund.state, split.allocation.refundVoucherUnits)
        );
      }
      if (b.result.phase === "deposited" || b.result.phase === "active")
        return b.result.depositedUnits;
      if (b.result.phase === "abort-refund-pending")
        return b.result.depositedUnits - b.result.setupRefundedUnits;
      return 0n;
    })
  );
}

export type IssuerListing = "setup" | "listed" | "paused" | "delisted";

/** The pill: where the token stands in the pool, and whether the member has paused it. */
export function issuerListing(snapshot: Onchain): IssuerListing {
  if (!snapshot.pool.admitted) return "setup";
  if (snapshot.pool.limit === 0n) return "delisted";
  if (snapshot.reserveEnabled) return "listed";
  // Before the member's own setup nothing is in the pool and nobody has booked.
  return snapshot.pool.holding > 0n || snapshot.bookings.records.length > 0 ? "paused" : "setup";
}

export type IssuerStage =
  | "pending"
  | "approve"
  | "admitting"
  | "setup"
  | "delisted"
  | "paused"
  | "short"
  | "ok";

/** The band's one message, most urgent first: an unconfirmed send, then a booking to approve. */
export function issuerStage(
  snapshot: Onchain,
  pending: boolean
): { stage: IssuerStage; booking?: ServiceIssuerBooking } {
  if (pending) return { stage: "pending" };
  const booking = snapshot.bookings.records.find((b) => b.approvalEligible);
  if (booking) return { stage: "approve", booking };
  const listing = issuerListing(snapshot);
  if (listing === "setup") return { stage: snapshot.pool.admitted ? "setup" : "admitting" };
  if (listing === "delisted" || listing === "paused") return { stage: listing };
  return { stage: snapshot.reserveAllowance === 0n ? "short" : "ok" };
}

export type IssuerBookingState =
  | "approve"
  | "confirming"
  | "deposit"
  | "accept"
  | "active"
  | "proposed"
  | "settling"
  | "delivered"
  | "unapproved"
  | "canceled";

/** One booking's state as its row tells it; a send still being checked comes first. */
export function issuerBookingState(
  b: ServiceIssuerBooking,
  pending: ServiceIssuerAction | null
): IssuerBookingState {
  if (
    pending &&
    "setupId" in pending &&
    pending.setupId === b.setupId &&
    pending.authorizationHash === b.authorizationHash
  )
    return "confirming";
  const split = b.finalAllocation;
  if (split)
    return [split.release.state, split.refund.state].every(
      (state) => state === "succeeded" || state === "not-required"
    )
      ? "delivered"
      : "settling";
  if (b.result.decision === "abort" || b.result.phase.startsWith("abort")) return "canceled";
  if (b.approvalEligible) return "approve";
  if (!b.result.issuerApproved) return "unapproved";
  if (b.issuerReturnCeiling > 0n) return "proposed";
  if (b.result.phase === "active") return "active";
  return b.result.phase === "deposited" ? "accept" : "deposit";
}
