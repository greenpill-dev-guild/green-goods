/**
 * The steward's voucher console (PRD-1297 surface 6, the `SIssuer` screen of
 * PRD-1299): the voucher bookings asked in a garden's pool, the bookings under
 * way on its offers, and the issuer's own reserve, as the Promises console
 * reads them.
 *
 * A booking moves in one order: the member agrees to the exact terms, their
 * escrow setup reaches the issuer, the issuer's Safe approves that exact
 * booking, the member deposits, the deposit's result reaches Green Goods, and
 * the pool's steward accepts through `acceptServiceClaim`. Approving and
 * accepting are separate acts by separate parties, so they never share a word.
 * The acceptance checks are the ones the chain enforces
 * (`VoucherRedemptionModule.validateVoucherServiceAcceptance`), so the cockpit
 * never offers an Accept the contract would refuse.
 *
 * Amounts are the voucher token's units, a voucher being 10^decimals of them;
 * times are seconds.
 *
 * @module modules/commitment-pooling/voucher-console
 */

import { parseUnits, type Hex } from "viem";
import type { Address } from "../../types/domain";
import type { IssuerSafeThreshold } from "./service-access-wallet-types";

export interface VoucherIssuer {
  /** How members know the issuer: "Tech and Sun", "Green Goods". */
  name: string;
  /** The voucher network the issuer's token and Safe live on. */
  chainId: number;
  /** The issuer's Safe on the voucher network: it approves each booking and proposes returns. */
  safe: Address;
  /** A voucher is 10^decimals of the token's units. */
  decimals: number;
}

export interface VoucherTermsVersion {
  revision: bigint;
  termsHash: Hex;
}

export interface VoucherAskSetup {
  /** What the member deposits for the booking. */
  voucherUnits: bigint;
  /** When the issuer's Safe approved this exact booking; null until it does. */
  approvedAt: number | null;
  /** What the escrow holds for the booking now. */
  depositedUnits: bigint;
  /** The deposit's result has reached Green Goods, where acceptance reads it. */
  depositConfirmed: boolean;
  /** The last second the pool's steward can accept, in source time: 7 days from agreeing by default. */
  acceptBy: number;
}

/** One voucher booking asked on a service offer in the pool: a pending service claim. */
export interface VoucherAsk {
  commitmentId: bigint;
  /** The member who asked: the pending claim's claimant. */
  buyer: Address;
  /** The member's exact consent, which the acceptance names. */
  claimHash: Hex;
  /** The terms the member agreed to, and the offer's terms now. */
  agreed: VoucherTermsVersion;
  current: VoucherTermsVersion;
  agreedAt: number;
  issuer: VoucherIssuer;
  /** The booking's escrow setup, once it reaches the issuer; null before. */
  setup: VoucherAskSetup | null;
}

/** A visit as the steward reports it: evidence for the final split, never a transfer. */
export interface VoucherVisitReport {
  checkedIn: boolean;
  usableHours: number;
  ofHours: number;
  photos: number;
}

export type VoucherBookingService =
  | { kind: "visit"; startsAt: number; endsAt: number; report: VoucherVisitReport }
  | { kind: "access"; daysUsed: number; daysOf: number };

export type VoucherBookingStage =
  | { kind: "in-progress" }
  /** The service stopped early: the issuer proposes what comes back, within its terms. */
  | { kind: "ended-early"; returnLimit: bigint }
  /** A transfer after the final split didn't go through: anyone can retry the same one. */
  | { kind: "return-failed"; units: bigint };

/** A booking under way on one of the pool's offers. */
export interface VoucherBooking {
  commitmentId: bigint;
  holder: Address;
  setupId: Hex;
  issuer: VoucherIssuer;
  /** What the booking's escrow holds. */
  voucherUnits: bigint;
  service: VoucherBookingService;
  stage: VoucherBookingStage;
}

export type VoucherReturnBasis =
  | { kind: "usable-hours"; of: number }
  | { kind: "access-days"; of: number };

/** The issuer's own reserve, kept apart from bookings: what its promised rewards draw on. */
export interface VoucherIssuerReserve {
  issuer: VoucherIssuer;
  inReserve: bigint;
  /** Rewards promised from the reserve and not yet sent; they set no vouchers aside. */
  promised: bigint;
  /** The garden whose promised rewards draw on the reserve, and how much it may still draw. */
  allowance: { garden: string; limit: bigint; left: bigint };
  openBookings: number;
  terms: { version: bigint; returns: VoucherReturnBasis };
  /** The issuer's published ceiling: monitored policy, not enforced on chain. */
  cap: { issued: bigint; ceiling: bigint };
  /** A promised reward the allowance can't cover now: it waits, it isn't lost. */
  waitingReward: { recipient: Address; units: bigint; title: string } | null;
}

/**
 * An issuer Safe's signature rule, read from the Safe and never written into
 * copy (PRD-1297 task 13). The shared voucher read owns this shape; the console
 * reads it through `useIssuerSafeThreshold`.
 */
export type { IssuerSafeThreshold } from "./service-access-wallet-types";

export interface VoucherConsoleSnapshot {
  /** Unavailable until the voucher pilot deployment is adopted and its reads are wired. */
  status: "observed" | "unavailable";
  /** The source time the read was taken at; checks never trust a device clock alone. */
  observedAt: number;
  asks: readonly VoucherAsk[];
  bookings: readonly VoucherBooking[];
  /** The garden's own voucher issuer, whose Safe approves its bookings; null if it issues none. */
  issuer: VoucherIssuer | null;
  /** The garden's own issuer reserve, when the garden issues vouchers. */
  reserve: VoucherIssuerReserve | null;
}

export const UNAVAILABLE_VOUCHER_CONSOLE: VoucherConsoleSnapshot = {
  status: "unavailable",
  observedAt: 0,
  asks: [],
  bookings: [],
  issuer: null,
  reserve: null,
};

const HASH = /^0x[0-9a-f]{64}$/i;
const ZERO_HASH = /^0x0{64}$/i;

function sameTerms({ agreed, current }: VoucherAsk): boolean {
  return (
    agreed.revision === current.revision &&
    agreed.termsHash.toLowerCase() === current.termsHash.toLowerCase()
  );
}

/** The ask carries a consent the acceptance can name; without one the contract refuses it. */
function namedConsent({ claimHash }: VoucherAsk): boolean {
  return HASH.test(claimHash) && !ZERO_HASH.test(claimHash);
}

const sameAddress = (a: Address, b: Address) => a.toLowerCase() === b.toLowerCase();

/** The whole booking is in escrow, and the deposit's result has reached Green Goods. */
function depositHolds(setup: VoucherAskSetup): boolean {
  return (
    setup.depositConfirmed && setup.voucherUnits > 0n && setup.depositedUnits === setup.voucherUnits
  );
}

export interface VoucherAcceptanceChecks {
  /** The member agreed to the offer's terms as they stand, and their consent can be named. */
  consent: boolean;
  /** The issuer's Safe approved this exact booking. */
  approval: boolean;
  /** The whole deposit is in escrow, and its result has reached Green Goods. */
  deposit: boolean;
  /** The acceptance deadline hasn't passed. */
  deadline: boolean;
  /** Every check holds: the only state in which the steward may accept. */
  ready: boolean;
}

/**
 * What `acceptServiceClaim` requires, read against `now`. The contract refuses
 * only after the deadline, so the deadline's own second still counts.
 */
export function selectVoucherAcceptanceChecks(
  ask: VoucherAsk,
  now: number
): VoucherAcceptanceChecks {
  const { setup } = ask;
  const consent = sameTerms(ask) && namedConsent(ask);
  const approval = setup !== null && setup.approvedAt !== null;
  const deposit = setup !== null && depositHolds(setup);
  const deadline = setup !== null && now <= setup.acceptBy;
  return {
    consent,
    approval,
    deposit,
    deadline,
    ready: consent && approval && deposit && deadline,
  };
}

/** Where a booking asked in the pool stands, from the steward's seat. */
export type VoucherAskStage =
  /** The offer changed since the member agreed: they cancel and book again. */
  | "terms-changed"
  /** The ask carries no consent the acceptance can name, so it can't be accepted: they book again. */
  | "consent-missing"
  /** The member agreed; their escrow setup hasn't reached the issuer yet. */
  | "setting-up"
  /**
   * The deadline passed before acceptance. The deposit comes back once the booking is canceled,
   * which anyone may now do; the escrow never refunds on a timeout of its own.
   */
  | "past-deadline"
  /** The issuer's Safe approves this exact booking next. */
  | "needs-approval"
  /** Approved: the member deposits next, and its result reaches Green Goods. */
  | "waiting-for-deposit"
  /** The pool's steward can accept. */
  | "ready";

export function selectVoucherAskStage(ask: VoucherAsk, now: number): VoucherAskStage {
  if (!sameTerms(ask)) return "terms-changed";
  if (!namedConsent(ask)) return "consent-missing";
  if (ask.setup === null) return "setting-up";
  if (now > ask.setup.acceptBy) return "past-deadline";
  if (ask.setup.approvedAt === null) return "needs-approval";
  return depositHolds(ask.setup) ? "ready" : "waiting-for-deposit";
}

/**
 * Whether the viewer can approve a booking (`approveSetupAuthorization`, the
 * issuer's Safe): the booking is the garden's own issuer's, whose Safe the
 * console reads, and the viewer is one of that Safe's owners. Anyone else sees
 * the booking wait for its issuer; a Safe whose owners can't be read approves
 * nothing here.
 */
export function selectCanApproveBooking(input: {
  ask: Pick<VoucherAsk, "issuer">;
  /** The garden's own issuer (`VoucherConsoleSnapshot.issuer`). */
  issuer: VoucherIssuer | null;
  /** That issuer's Safe, as read. */
  safe: IssuerSafeThreshold | undefined;
  viewer: Address | undefined;
}): boolean {
  const { ask, issuer, safe, viewer } = input;
  if (!issuer || !viewer || safe?.status !== "observed" || !safe.signers) return false;
  return (
    ask.issuer.chainId === issuer.chainId &&
    sameAddress(ask.issuer.safe, issuer.safe) &&
    sameAddress(safe.safe, issuer.safe) &&
    safe.signers.some((signer) => sameAddress(signer, viewer))
  );
}

/**
 * A return the issuer proposes for a booking that ended early: what goes back
 * to the holder and what is released to the issuer's reserve. The contract
 * stores only a ceiling; the limit is the issuer's published terms, so a
 * return above it is refused here.
 */
export function selectReturnProposal(
  booking: { voucherUnits: bigint; returnLimit: bigint },
  refund: bigint
): { refund: bigint; release: bigint; aboveTerms: boolean; valid: boolean } {
  const aboveTerms = refund > booking.returnLimit;
  const fits = refund <= booking.voucherUnits;
  return {
    refund,
    release: fits ? booking.voucherUnits - refund : 0n,
    aboveTerms,
    valid: refund > 0n && fits && !aboveTerms,
  };
}

/** A raised allowance has to give the garden's rewards more to draw than is left now. */
export function selectAllowanceRaise(
  reserve: { allowance: { left: bigint } },
  allowance: bigint
): { valid: boolean } {
  return { valid: allowance > 0n && allowance > reserve.allowance.left };
}

/**
 * A steward's entry of a voucher amount, in token units: a plain decimal with
 * no more places than the token has. Anything else is no amount at all.
 */
export function parseVoucherAmount(text: string, decimals: number): bigint | null {
  const entry = text.trim();
  const [, fraction = ""] = entry.split(".");
  if (!/^\d+(\.\d+)?$/.test(entry) || fraction.length > decimals) return null;
  return parseUnits(entry, decimals);
}
