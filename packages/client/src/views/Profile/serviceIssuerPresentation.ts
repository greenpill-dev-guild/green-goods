import {
  issuerPoolStatus,
  serviceIssuerIssuanceLimit,
  type ServiceIssuerAction,
  type ServiceIssuerAsset,
  type ServiceIssuerBooking,
  type ServiceIssuerSnapshot,
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

/** Only a booking read with no failed or missing record is counted; a partial one counts nothing. */
const bookingsCounted = (snapshot: Onchain) => snapshot.bookings.status === "observed";

/**
 * What the member can still deliver, from the capacity they confirmed and the verified bookings.
 * One voucher buys one unit of the service, so the numbers count vouchers' worth. Neither the
 * issuance ceiling nor token balances stand in for them, returned vouchers restore nothing, and
 * a booking read that failed or left records out leaves them unknown rather than counting the
 * missing bookings as capacity left.
 */
export function issuerCapacity(snapshot: Onchain): IssuerCapacity {
  const promised = snapshot.asset.service.capacity;
  if (!bookingsCounted(snapshot)) return { promised, booked: null, delivered: null, left: null };
  const records = snapshot.bookings.records;
  const booked = sum(records.filter(bookingOpen).map((b) => b.authorization.voucherUnits));
  const delivered = sum(
    records.map((b) => b.finalAllocation?.allocation.releaseVoucherUnits ?? 0n)
  );
  const left =
    promised === null ? null : promised > booked + delivered ? promised - booked - delivered : 0n;
  return { promised, booked, delivered, left };
}

/**
 * How many more vouchers the member can issue: within what they promised to deliver and the
 * token's reviewed issuance ceiling, whichever is lower. Every voucher issued counts against both.
 */
export function issuerIssueRoom(snapshot: Onchain): bigint {
  const limit = serviceIssuerIssuanceLimit(snapshot.asset);
  return limit !== null && limit > snapshot.totalMinted ? limit - snapshot.totalMinted : 0n;
}

/** What the escrow still holds for the member's bookings: deposits and splits not yet moved. */
export function issuerEscrowed(snapshot: Onchain): bigint | null {
  if (!bookingsCounted(snapshot)) return null;
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

/**
 * The pool takes the token in: admitted under a holding limit, so Green Goods' side of setup is
 * done. A registered token whose cap hasn't landed is still being admitted, not delisted.
 */
export const issuerAdmitted = (snapshot: Onchain) =>
  issuerPoolStatus(snapshot.pool, snapshot.asset) === "listed";

/** The pill: where the token stands in the pool, and whether the member has paused it. */
export function issuerListing(snapshot: Onchain): IssuerListing {
  const pool = issuerPoolStatus(snapshot.pool, snapshot.asset);
  if (pool !== "listed") return pool;
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
  // While new bookings are paused the member approves none, so none is asked of them.
  const booking = snapshot.reserveEnabled
    ? snapshot.bookings.records.find((b) => b.approvalEligible)
    : undefined;
  if (booking) return { stage: "approve", booking };
  const listing = issuerListing(snapshot);
  if (listing === "setup") return { stage: issuerAdmitted(snapshot) ? "setup" : "admitting" };
  if (listing === "delisted" || listing === "paused") return { stage: listing };
  return { stage: snapshot.reserveAllowance === 0n ? "short" : "ok" };
}

export type IssuerBookingState =
  | "approve"
  | "paused"
  | "confirming"
  | "deposit"
  | "accept"
  | "active"
  | "proposed"
  | "settling"
  | "delivered"
  | "unapproved"
  | "canceled";

/**
 * One booking's state as its row tells it; a send still being checked comes first. A booking
 * asked while new bookings are paused waits for the member to resume, not for their approval.
 */
export function issuerBookingState(
  b: ServiceIssuerBooking,
  pending: ServiceIssuerAction | null,
  paused: boolean
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
  if (b.approvalEligible) return paused ? "paused" : "approve";
  if (!b.result.issuerApproved) return "unapproved";
  if (b.issuerReturnCeiling > 0n) return "proposed";
  if (b.result.phase === "active") return "active";
  return b.result.phase === "deposited" ? "accept" : "deposit";
}
