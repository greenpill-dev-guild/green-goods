import type {
  ServiceAccessSnapshot,
  ServiceVoucherSetup,
} from "@green-goods/shared/commitment-pooling";
import type {
  ServiceActKind,
  ServiceBookingInput,
  ServiceBookingStage,
  ServiceBookingView,
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
  input: Pick<ServiceBookingInput, "snapshot" | "coreState" | "held">
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
  // Accepted but not started: Start the Booking records the activation and sends it. A
  // cancellation that lost the race says so once the booking has started.
  if (accepted) return setup.source.decisionDispatched ? "activationInTransit" : "starting";
  if (!setup.source.authorizationDispatched) return "requestNotSent";
  if (!d || d.result.phase === "none") return "requestInTransit";
  if (d.result.phase === "authorized")
    return d?.result.issuerApproved ? "readyToDeposit" : "waitingApproval";
  return setup.source.setupResult?.depositedUnits === a.voucherUnits
    ? "waitingAcceptance"
    : "confirmingDeposit";
}

export const NEEDS_YOU = new Set<ServiceBookingStage>([
  "readyToDeposit",
  "readyToClose",
  "returnProposed",
  "termsChanged",
  "returnFailed",
]);

export const WAITING = new Set<ServiceBookingStage>([
  "open",
  "notEnough",
  "requestInTransit",
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

/**
 * The booking's own state beside the promise's pill, where that pill alone would mislead: the
 * promise reads "Offered" through the whole deposit, a cancellation and a changed offer, and
 * "Awaiting confirmation" while a split's transfers are still on their way.
 */
export const CHIP: Partial<
  Record<ServiceBookingStage, NonNullable<ServiceBookingView["band"]["chip"]>["tone"]>
> = {
  requestNotSent: "neutral",
  waitingApproval: "info",
  readyToDeposit: "warning",
  confirmingDeposit: "info",
  waitingAcceptance: "info",
  termsChanged: "warning",
  readyToClose: "warning",
  returnProposed: "warning",
  transfersPending: "info",
  returnFailed: "error",
  canceling: "neutral",
  canceled: "success",
};

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
