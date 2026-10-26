import {
  type ServiceAccessAction,
  type ServiceAccessSnapshot,
  type ServiceVoucherSetup,
  selectServiceAccessAction,
} from "@green-goods/shared/commitment-pooling";
import { currentVoucherSetup, SERVICE_ACCEPTANCE_WINDOW_SECONDS } from "./serviceBooking";
import type { ServiceActKind } from "./serviceBookingTypes";
import { boundVoucherSetup } from "./serviceVoucherReview";

/**
 * The next service action of a member's act, read from the latest snapshot, or null when the act
 * is done. A page act can take several writes (agreeing records consent, then the escrow setup,
 * then sends its authorization); each runs only when the shared selector offers it, and each
 * prompt is its own approval.
 */
export type ServiceActStep = (snapshot: ServiceAccessSnapshot) => ServiceAccessAction | null;

const offers = (s: ServiceAccessSnapshot, kind: ServiceAccessAction["action"]) =>
  s.availableActions.includes(kind);
const setupOffers = (row: ServiceVoucherSetup, kind: ServiceAccessAction["action"]) =>
  row.availableActions.includes(kind as ServiceVoucherSetup["availableActions"][number]);

/** Agree to these terms: the request, the escrow setup with its seven-day deadline, then its send. */
export const agreeStep: ServiceActStep = (s) => {
  const offer = s.offer;
  if (!offer) return null;
  if (offers(s, "requestClaim")) {
    // A request names the reader's garden; with none eligible there is nothing to agree to here.
    const garden = s.eligibleBuyerGardens[0];
    return garden
      ? {
          action: "requestClaim",
          expectedRevision: offer.revision,
          expectedTermsHash: offer.termsHash,
          requestNonce: s.nextRequestNonce,
          buyerGarden: garden.address,
          voucherHolder: s.capabilities.gnosisHolder ?? s.key.buyer,
        }
      : null;
  }
  if (offers(s, "prepareVoucherSetup") && s.consent && s.sourceTimestamp !== null)
    return {
      action: "prepareVoucherSetup",
      expectedRevision: offer.revision,
      expectedTermsHash: offer.termsHash,
      expectedClaimHash: s.consent.claimHash,
      expectedRequestNonce: s.consent.requestNonce,
      acceptanceDeadline: s.sourceTimestamp + SERVICE_ACCEPTANCE_WINDOW_SECONDS,
    };
  const row = currentVoucherSetup(s);
  if (
    row &&
    !row.source.authorizationDispatched &&
    row.fees.authorization !== null &&
    setupOffers(row, "dispatchVoucherSetupCommand")
  )
    return {
      ...boundVoucherSetup(row),
      action: "dispatchVoucherSetupCommand",
      kind: "authorization",
      expectedDecisionId: null,
      reviewedNativeFee: row.fees.authorization,
    };
  return null;
};

/** Deposit: allow exactly the booking's vouchers if needed, then deposit them into its escrow. */
export const depositStep: ServiceActStep = (s) => {
  const row = currentVoucherSetup(s);
  if (!row) return null;
  if (setupOffers(row, "approveVoucherAllowance"))
    return { ...boundVoucherSetup(row), action: "approveVoucherAllowance" };
  if (setupOffers(row, "presentVoucherSetup"))
    return { ...boundVoucherSetup(row), action: "presentVoucherSetup" };
  return null;
};

/** Cancel before acceptance: the source abort when the reader may decide it, then its send. */
export const cancelStep: ServiceActStep = (s) => {
  const row = currentVoucherSetup(s);
  if (!row) return null;
  if (row.source.decision === "none") {
    if (setupOffers(row, "abortVoucherSetup"))
      return { ...boundVoucherSetup(row), action: "abortVoucherSetup" };
    if (
      setupOffers(row, "requestVoucherSetupAbort") &&
      row.fees.holderAbortRequest !== null &&
      !row.destination?.holderAbortRequested
    )
      return {
        ...boundVoucherSetup(row),
        action: "requestVoucherSetupAbort",
        reviewedNativeFee: row.fees.holderAbortRequest,
      };
    return null;
  }
  if (
    row.source.decision === "abort" &&
    !row.source.decisionDispatched &&
    row.fees.decision !== null &&
    setupOffers(row, "dispatchVoucherSetupCommand")
  )
    return {
      ...boundVoucherSetup(row),
      action: "dispatchVoucherSetupCommand",
      kind: "decision",
      expectedDecisionId: row.source.decisionId,
      reviewedNativeFee: row.fees.decision,
    };
  return null;
};

/** Approve the final split, then run each transfer it fixed: the return first. */
export function splitStep(split: {
  delivered: bigint;
  release: bigint;
  refund: bigint;
}): ServiceActStep {
  return (s) => {
    const row = currentVoucherSetup(s);
    const d = row?.destination;
    if (!row || !d) return null;
    if (!d.finalAllocation) {
      if (!setupOffers(row, "finalizeVoucherAllocation") || !d.result.appliedDecisionId)
        return null;
      return {
        ...boundVoucherSetup(row),
        action: "finalizeVoucherAllocation",
        expectedActivationDecisionId: d.result.appliedDecisionId,
        allocation: {
          approvedDeliveredServiceUnits: split.delivered,
          releaseVoucherUnits: split.release,
          refundVoucherUnits: split.refund,
        },
      };
    }
    return legStep(s);
  };
}

/** Each transfer runs once, and a failed one is retried for the same amount only. */
export const legStep: ServiceActStep = (s) => {
  const row = currentVoucherSetup(s);
  const final = row?.destination?.finalAllocation;
  if (!row || !final || !setupOffers(row, "executeVoucherFinalLeg")) return null;
  const leg = (["refund", "release"] as const).find(
    (name) => final[name].state === "pending" || final[name].state === "failed"
  );
  return leg
    ? {
        ...boundVoucherSetup(row),
        action: "executeVoucherFinalLeg",
        expectedDecisionId: final.decisionId,
        leg,
      }
    : null;
};

/**
 * How a member act ended. `done`: nothing left to send, or a transfer is on its way. `stopped`:
 * the reader declined a later prompt after an earlier write landed, so the page shows where the
 * act stopped and its act sends the rest. `notOffered`, `nothingSent` and `noResult`: nothing was
 * sent because nothing was offered or the reader declined, or the result is unknown.
 */
export type ServiceActEnd = "done" | "stopped" | "notOffered" | "nothingSent" | "noResult";

/** An approval the reader closed before it finished. */
const DECLINED = /reject|cancel|denied|user refused/i;
const MAX_WRITES = 6;

/**
 * Runs one member act, one write at a time, each only when the shared selector offers it and each
 * its own prompt. It stops at the acted-on booking's transfer when that hasn't arrived: a pending
 * transfer is on its way, and a failed one waits for its own Retry Transfer.
 */
export async function runServiceAct(
  snapshot: ServiceAccessSnapshot,
  step: ServiceActStep,
  send: (action: ServiceAccessAction) => Promise<{ snapshot: ServiceAccessSnapshot }>,
  offered: (s: ServiceAccessSnapshot, action: ServiceAccessAction) => boolean = (s, action) =>
    selectServiceAccessAction(s, action).allowed
): Promise<ServiceActEnd> {
  let current = snapshot;
  let landed = false;
  try {
    for (let write = 0; write < MAX_WRITES; write += 1) {
      const action = step(current);
      if (!action || !offered(current, action)) return landed ? "done" : "notOffered";
      current = (await send(action)).snapshot;
      landed = true;
      if (action.action === "executeVoucherFinalLeg") {
        const row = current.voucherSetups.find((setup) => setup.setupId === action.setupId);
        const state = row?.destination?.finalAllocation?.[action.leg].state;
        if (state !== undefined && state !== "succeeded") return "done";
      }
    }
    return "done";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!DECLINED.test(message)) return "noResult";
    return landed ? "stopped" : "nothingSent";
  }
}

/**
 * Whether the shared selector offers a page act's first write, so the bar shows only acts that
 * can run. Report a Problem and Exchange aren't service writes; their own surfaces decide.
 */
export function serviceActOffered(
  kind: ServiceActKind,
  snapshot: ServiceAccessSnapshot,
  split: { delivered: bigint; release: bigint; refund: bigint } | null
): boolean {
  if (kind === "report" || kind === "exchange") return true;
  const step =
    kind === "redeem"
      ? agreeStep
      : kind === "deposit"
        ? depositStep
        : kind === "cancel" || kind === "cancelChanged"
          ? cancelStep
          : kind === "retry"
            ? legStep
            : split
              ? splitStep(split)
              : null;
  const action = step?.(snapshot) ?? null;
  return action !== null && selectServiceAccessAction(snapshot, action).allowed;
}
