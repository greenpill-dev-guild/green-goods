import type {
  ServiceAccessAction,
  ServiceAccessSnapshot,
} from "@green-goods/shared/commitment-pooling";
import en from "@green-goods/shared/i18n/en";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";
import {
  type BookingStoryStage,
  bookingStoryCoreState,
  bookingStorySnapshot,
} from "../../../../shared/.storybook/voucherBookingFixtures";
import {
  VOUCHER_STORY_APPROVALS,
  VOUCHER_STORY_ISSUERS,
  vouchers,
} from "../../../../shared/.storybook/voucherPilotFixtures";
import {
  cancelStep,
  depositStep,
  runServiceAct,
  serviceActOffered,
} from "../../views/Home/Garden/Commitment/serviceActs";
import { serviceBookingView } from "../../views/Home/Garden/Commitment/serviceBooking";

/**
 * A booking act that stopped partway leaves the booking at a stage whose own act is done: the
 * page keeps a way to finish it for as long as the shared selector offers the rest.
 */
const intl = createIntl({ locale: "en", messages: en as Record<string, string> });

function view(snapshot: ServiceAccessSnapshot, stage: BookingStoryStage) {
  const booking = serviceBookingView(
    {
      snapshot,
      coreState: bookingStoryCoreState("hubDay", stage),
      issuer: VOUCHER_STORY_ISSUERS.techAndSun,
      approval: VOUCHER_STORY_APPROVALS.techAndSunBootstrap,
      held: vouchers(9),
    },
    intl
  );
  if (!booking) throw new Error(`No hub day booking at ${stage}`);
  return booking;
}

describe("a voucher booking's unfinished acts", () => {
  it("keeps Close the Booking until every transfer of an approved split is sent", () => {
    // The member approved the split, then declined the transfer's prompt.
    const unsent = bookingStorySnapshot("hubDay", "transfersPending", { legsSent: false });
    expect(view(unsent, "transfersPending").primary).toEqual({
      kind: "send",
      label: "Close the Booking",
    });
    expect(serviceActOffered("send", unsent, null)).toBe(true);
    // It waits on the reader now, so the band says so.
    expect(view(unsent, "transfersPending").band).toMatchObject({
      needsYou: true,
      tone: "attention",
    });
    // Once sent, the transfer shows as pending until it arrives, with nothing left to do.
    const sent = bookingStorySnapshot("hubDay", "transfersPending");
    expect(view(sent, "transfersPending").primary).toBeNull();
    expect(view(sent, "transfersPending").band.needsYou).toBe(false);
  });

  it("keeps a recorded cancellation resumable until it is sent to the escrow", () => {
    const recorded = bookingStorySnapshot("hubDay", "canceling", { cancelSent: false });
    const booking = view(recorded, "canceling");
    expect(booking.stage).toBe("canceling");
    expect(booking.primary?.label).toBe("Cancel Booking");
    expect(booking.band.needsYou).toBe(true);
    expect(serviceActOffered("cancel", recorded, null)).toBe(true);
    expect(cancelStep(recorded)).toMatchObject({
      action: "dispatchVoucherSetupCommand",
      kind: "decision",
    });
    expect(view(bookingStorySnapshot("hubDay", "canceling"), "canceling").primary).toBeNull();
  });

  it("retries a deposit the escrow kept, through the stored retry instead of an inert Deposit", async () => {
    const kept = bookingStorySnapshot("hubDay", "readyToDeposit", { depositRetry: true });
    expect(depositStep(kept)).toMatchObject({
      action: "retryVoucherSetupAction",
      setupId: kept.currentVoucherSetupId,
    });
    expect(serviceActOffered("deposit", kept, null)).toBe(true);
    const sent: ServiceAccessAction[] = [];
    const retried = bookingStorySnapshot("hubDay", "confirmingDeposit");
    const end = await runServiceAct(kept, depositStep, async (action) => {
      sent.push(action);
      return { snapshot: retried };
    });
    expect(end).toBe("done");
    expect(sent.map((action) => action.action)).toEqual(["retryVoucherSetupAction"]);
  });

  it("offers the deposit's confirmation again only when it didn't reach the source", () => {
    const stuck = bookingStorySnapshot("hubDay", "confirmingDeposit", { ackStuck: true });
    const booking = view(stuck, "confirmingDeposit");
    expect(booking.primary).toEqual({ kind: "retryConfirm", label: "Retry Confirmation" });
    expect(booking.band.needsYou).toBe(true);
    expect(booking.secondary?.label).toBe("Cancel Booking");
    expect(serviceActOffered("retryConfirm", stuck, null)).toBe(true);
    const confirming = bookingStorySnapshot("hubDay", "confirmingDeposit");
    expect(view(confirming, "confirmingDeposit").primary).toBeNull();
    expect(serviceActOffered("retryConfirm", confirming, null)).toBe(false);
  });
});
