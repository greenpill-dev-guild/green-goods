import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import type { ServiceAsset } from "./service-access-types";

/**
 * Where an issuer stands for new business, read as the member's own Service Assets reads it: from
 * the issuer's reserve and its token's place in the shared pool. A paused issuer, its reserve
 * disabled after setup, takes no new bookings, while booked ones go ahead. A delisted token,
 * admitted with a zero pool holding limit, can't be exchanged for, while holders keep their
 * vouchers and terms. Neither moves a balance or a booking.
 */
export interface VoucherIssuerStanding {
  bookings: "open" | "paused";
  exchange: "listed" | "delisted";
}

/** A service voucher issuer: a collective's Safe or, from slice 2, a member's own account. */
export interface VoucherIssuer {
  /** The account that approves each booking and holds the reserve. */
  account: Address;
  kind: "collective" | "individual";
  /** The name from the issuer's reviewed metadata. */
  name: string;
  /** Grammatical gender of the name, for phrases that agree with it ("vales da Tech and Sun"). */
  gender: "feminine" | "masculine" | null;
  asset: ServiceAsset;
  /** The garden whose promises list this issuer's services. */
  garden: Address;
  standing: VoucherIssuerStanding;
}

/**
 * How many signatures an issuer's approval takes, read from the issuer itself so copy never
 * states a count. A Safe can change its threshold; Tech and Sun's starts at one and moves to two.
 */
export type VoucherIssuerApproval =
  | { kind: "safe"; evidence: "onchain" | "local-rehearsal"; threshold: number; owners: number }
  | { kind: "account"; evidence: "onchain" | "local-rehearsal" }
  | { kind: "unavailable"; reason: "unconfigured" | "read-failed" };

/**
 * An issuer Safe's signature rule (task 13), read from the Safe and never written into copy. The
 * stewards' console and the promise page share it. `unavailable` means the read failed or the Safe
 * could not be read; copy then says so instead of naming a number.
 */
export interface IssuerSafeThreshold {
  safe: Address;
  status: "observed" | "unavailable";
  threshold: number | null;
  owners: number | null;
  /**
   * The Safe's owners, read with the count, so the console offers the Safe's own acts only to
   * someone who can sign them. Null when they aren't known: a failed read, or the DEV rehearsal.
   */
  signers: readonly Address[] | null;
}

/** Where a booking lives, so a wallet row can open it whatever garden is active. */
export interface VoucherBookingRef {
  sourceChainId: number;
  coreModule: Address;
  commitmentId: bigint;
  garden: Address;
  setupId: Hex;
}

/**
 * What one booking's escrow holds for its holder. Approval and acceptance sit on either side of
 * the deposit; after a final split, a transfer still on its way counts as held until it arrives.
 */
export interface VoucherBookingEscrow {
  booking: VoucherBookingRef;
  issuer: Address;
  asset: ServiceAsset;
  /** The vouchers the booking takes, fixed when the holder agreed. */
  agreed: bigint;
  held: bigint;
  stage: "awaiting-approval" | "awaiting-deposit" | "held" | "settling" | "returning" | "closed";
}

/** A return on its way back to the holder: pending until its transfer arrives. */
export interface VoucherPendingReturn {
  booking: VoucherBookingRef;
  issuer: Address;
  asset: ServiceAsset;
  amount: bigint;
  /** A final split's refund, or a cancellation before acceptance. */
  cause: "split" | "cancellation";
  /** A failed transfer can be retried, for the same amount only. */
  state: "pending" | "failed";
  /**
   * How many times a split's refund was sent. Null for a cancellation: its refund runs as the
   * escrow's setup action, which keeps only its last outcome and counts no attempts.
   */
  attempts: bigint | null;
}

/** Vouchers in the holder's account now, per issuer token. */
export interface VoucherHolding {
  issuer: VoucherIssuer;
  available: bigint;
}

export type VoucherWalletUnavailableReason = "routes-unconfigured" | "projection-unregistered";

/** One account's vouchers across gardens: what it holds, what bookings hold, what is coming back. */
export interface VoucherWalletSnapshot {
  account: Address;
  evidence: "onchain" | "local-rehearsal" | "unavailable";
  /** False while a booking or a return could be missed; a list is never presented as all of them. */
  complete: boolean;
  reason: VoucherWalletUnavailableReason | null;
  issuers: readonly VoucherIssuer[];
  holdings: readonly VoucherHolding[];
  bookings: readonly VoucherBookingEscrow[];
  returns: readonly VoucherPendingReturn[];
}

export interface VoucherWalletScope {
  sourceChainId: number;
  coreModule: Address;
  account: Address;
}

/**
 * One reward of a request. Vouchers and G$ arrive on their own, each with its own receipt, and
 * never wait for each other; a short reserve or used-up allowance leaves the reward unchanged.
 */
export interface RequestRewardDelivery {
  id: Hex;
  kind: "voucher" | "gd";
  asset: ServiceAsset;
  amount: bigint;
  /** The issuer whose reserve pays a voucher reward, or the account paying G$. */
  funder: Address;
  status: "after-work" | "on-the-way" | "waiting" | "delayed" | "received";
  /** What a waiting voucher reward needs topped up or raised. */
  shortOf: "reserve" | "allowance" | null;
  receipt: string | null;
  attempts: bigint;
}
