import {
  type ServiceAccessSnapshot,
  type ServiceVoucherSetup,
  voucherStartFallbackDue,
} from "@green-goods/shared/commitment-pooling";
import type {
  ServiceActKind,
  ServiceBookingInput,
  ServiceBookingStage,
  ServicePill,
  ServiceProfile,
} from "./serviceBookingTypes";

/**
 * Where one voucher booking stands, from the reader's seat, and what each stage offers: the
 * stage itself, the acts beside it, the step it sits on, and the state word the promise's own
 * pill leaves out. `serviceBooking.ts` turns these into the page's words.
 */

export const same = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function currentVoucherSetup(s: ServiceAccessSnapshot): ServiceVoucherSetup | null {
  return s.voucherSetups.find((row) => row.setupId === s.currentVoucherSetupId) ?? null;
}

/** The stage a voucher booking is in; null when the promise has no voucher route. */
export function serviceBookingStage(
  input: Pick<ServiceBookingInput, "snapshot" | "coreState" | "held" | "acceptedAt">
): ServiceBookingStage | null {
  const { snapshot: s, coreState } = input;
  const voucher = s.offer?.route === "voucher" ? s.offer.voucher : null;
  const setup = currentVoucherSetup(s);
  if (!voucher && !setup) return null;
  const d = setup?.destination;
  const final = d?.finalAllocation ?? null;
  // A failed transfer keeps its Retry Transfer, even after the member reported a problem.
  if (final && (final.release.state === "failed" || final.refund.state === "failed"))
    return "returnFailed";
  if (coreState === "DISPUTED") return "problemReported";
  if (!setup)
    return input.held !== null && voucher && input.held < voucher.units ? "notEnough" : "open";
  if (final) return final.financiallyClosed ? "closed" : "transfersPending";
  // A recorded cancellation stays under way until it is sent to the escrow, which may hold vouchers.
  if (setup.source.decision === "abort" || d?.result.decision === "abort")
    return d?.result.phase === "aborted" || (!d && setup.source.decisionDispatched)
      ? "canceled"
      : "canceling";
  const a = setup.authorization;
  const accepted = setup.source.acceptedEver !== null;
  if (
    !accepted &&
    s.offer &&
    (s.offer.revision !== a.termsRevision || !same(s.offer.termsHash, a.termsHash))
  )
    return "termsChanged";
  if (d?.result.phase === "active") {
    // The issuer's Propose Return raises the most that can come back; nothing moves yet.
    if (d.issuerReturnCeiling !== null && d.issuerReturnCeiling > 0n) return "returnProposed";
    if (coreState === "READY_FOR_CONFIRMATION" || coreState === "EVIDENCE_SUBMITTED")
      return "readyToClose";
    return d.holderAbortRequested ? "acceptedFirst" : "inProgress";
  }
  // Accepted but not started: the steward's Accept and Start sends the start (DL-193). Once the
  // fallback is due, Start the Booking records the activation and sends it. A cancellation that
  // lost the race says so once the booking has started.
  if (accepted) {
    if (setup.source.decisionDispatched) return "activationInTransit";
    return voucherStartFallbackDue(input.acceptedAt, s.sourceTimestamp)
      ? "starting"
      : "stewardStarting";
  }
  if (!setup.source.authorizationDispatched) return "requestNotSent";
  if (!d || d.result.phase === "none") return "requestInTransit";
  if (d.result.phase === "authorized")
    return d?.result.issuerApproved ? "readyToDeposit" : "waitingApproval";
  return setup.source.setupResult?.depositedUnits === a.voucherUnits
    ? "waitingAcceptance"
    : "confirmingDeposit";
}

const NEEDS_YOU = new Set<ServiceBookingStage>([
  "requestNotSent",
  "readyToDeposit",
  // The steward's start didn't go, so its fallback, Start the Booking, is the member's (DL-193).
  "starting",
  "readyToClose",
  "returnProposed",
  "termsChanged",
  "returnFailed",
]);

export const WAITING = new Set<ServiceBookingStage>([
  "open",
  "notEnough",
  "requestInTransit",
  "stewardStarting",
  "activationInTransit",
  "waitingApproval",
  "confirmingDeposit",
  "waitingAcceptance",
  "transfersPending",
  "canceling",
]);

/**
 * The page's acts per stage: one primary and at most one secondary. Short of vouchers, the one
 * next step is the exchange; the terms stay a step back, since agreeing to them needs nothing yet.
 */
export const ACTS: Partial<
  Record<ServiceBookingStage, [ServiceActKind | null, ServiceActKind | null]>
> = {
  open: ["redeem", null],
  notEnough: ["exchange", "redeem"],
  requestNotSent: ["redeem", "cancel"],
  requestInTransit: [null, "cancel"],
  waitingApproval: [null, "cancel"],
  readyToDeposit: ["deposit", "cancel"],
  confirmingDeposit: [null, "cancel"],
  waitingAcceptance: [null, "cancel"],
  starting: ["activate", null],
  inProgress: [null, "report"],
  readyToClose: ["close", "report"],
  returnProposed: ["review", "report"],
  returnFailed: ["retry", null],
  acceptedFirst: [null, "report"],
  termsChanged: ["cancelChanged", null],
};

/**
 * A step only some bookings at a stage still need from the reader: a transfer the split fixed
 * that nobody sent (its prompt was declined), a deposit's confirmation that didn't reach the
 * source, or a recorded cancellation not yet sent to the escrow.
 */
export function recoveryAct(
  stage: ServiceBookingStage,
  setup: ServiceVoucherSetup | null
): ServiceActKind | null {
  const final = setup?.destination?.finalAllocation;
  if (
    stage === "transfersPending" &&
    final &&
    [final.refund, final.release].some((leg) => leg.state === "pending" && leg.attempts === 0n)
  )
    return "send";
  if (stage === "confirmingDeposit" && setup?.acknowledgments.setup.pending) return "retryConfirm";
  if (stage === "canceling" && setup && !setup.source.decisionDispatched) return "cancel";
  return null;
}

/** Whether any of the booking's vouchers reached its escrow: what a cancellation sends back. */
export function bookingDeposited(setup: ServiceVoucherSetup | null): boolean {
  return (setup?.destination?.result.depositedUnits ?? 0n) > 0n;
}

/**
 * Whether the booking waits on the reader: its own step (deposit, the split, a changed offer, a
 * failed transfer), or an act of theirs that stopped partway. The page's band and every list row
 * that shows the booking ask this one question.
 */
export function bookingNeedsYou(
  stage: ServiceBookingStage,
  setup: ServiceVoucherSetup | null
): boolean {
  return NEEDS_YOU.has(stage) || recoveryAct(stage, setup) !== null;
}

const pill = (id: string, tone: ServicePill["tone"]): ServicePill => ({
  labelId: `app.voucher.pp.chip.${id}`,
  tone,
});

/**
 * The page's one pill per stage, in the member's words. The promise reads "Offered" through the
 * whole deposit and "Awaiting confirmation" while a split settles, so the booking speaks instead;
 * a request or a start on its way reads as the wait it is part of.
 */
const PILL: Partial<Record<ServiceBookingStage, ServicePill>> = {
  open: pill("open", "info"),
  notEnough: pill("open", "info"),
  requestNotSent: pill("requestNotSent", "warning"),
  requestInTransit: pill("waitingApproval", "neutral"),
  waitingApproval: pill("waitingApproval", "neutral"),
  readyToDeposit: pill("readyToDeposit", "warning"),
  confirmingDeposit: pill("waitingAcceptance", "neutral"),
  waitingAcceptance: pill("waitingAcceptance", "neutral"),
  termsChanged: pill("termsChanged", "warning"),
  stewardStarting: pill("accepted", "info"),
  starting: pill("accepted", "info"),
  activationInTransit: pill("accepted", "info"),
  inProgress: pill("booked", "success"),
  acceptedFirst: pill("booked", "success"),
  readyToClose: pill("readyToClose", "warning"),
  returnProposed: pill("readyToClose", "warning"),
  transfersPending: pill("transfersPending", "info"),
  returnFailed: pill("returnFailed", "error"),
  canceling: pill("canceling", "neutral"),
  canceled: pill("canceled", "neutral"),
};

/**
 * The booking's pill, or null where the promise's own says it: Kept, and a reported problem's
 * Disputed. A booking settled before the promise closes is still Closing; a hub day's delivery is
 * the visit.
 */
export function bookingPill(
  stage: ServiceBookingStage,
  profile: ServiceProfile,
  closed: { kept: boolean; endedEarly: boolean }
): ServicePill | null {
  if (stage === "closed")
    return closed.kept
      ? null
      : closed.endedEarly
        ? { labelId: "app.voucher.pp.st.endedEarly", tone: "neutral" }
        : pill("transfersPending", "info");
  if (profile === "hubDay" && (stage === "readyToClose" || stage === "returnProposed"))
    return pill("visitReported", "warning");
  return PILL[stage] ?? null;
}

/**
 * Before the deposit, the reader's own vouchers are what the offer or booking still rests on, so a
 * wallet read that fails there is said in the door's place; after it, the escrow holds them.
 */
export const HOLDINGS_MATTER: ReadonlySet<ServiceBookingStage> = new Set<ServiceBookingStage>([
  "open",
  "notEnough",
  "requestNotSent",
  "requestInTransit",
  "waitingApproval",
  "readyToDeposit",
  "termsChanged",
]);

/** Where each stage sits on the booking's way, for the steps' done and now. */
export const POSITION: Record<ServiceBookingStage, number> = {
  open: -1,
  notEnough: -1,
  requestNotSent: -1,
  requestInTransit: -1,
  waitingApproval: 0,
  readyToDeposit: 1,
  confirmingDeposit: 2,
  waitingAcceptance: 3,
  termsChanged: 3,
  canceling: 3,
  canceled: 3,
  stewardStarting: 4,
  starting: 4,
  activationInTransit: 4,
  inProgress: 5,
  acceptedFirst: 5,
  problemReported: 5,
  readyToClose: 6,
  returnProposed: 6,
  transfersPending: 7,
  returnFailed: 7,
  closed: 8,
};
