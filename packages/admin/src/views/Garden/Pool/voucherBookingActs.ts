import type { VoucherBooking } from "@green-goods/shared/modules/commitment-pooling/pool-console";

/** What a booking under way can ask of the steward. */
export type VoucherBookingAct = "report" | "propose" | "retry";

/**
 * The act a booking under way waits on the steward for, in Review Promises: the same transfer
 * again after a return failed, a proposed return once the service stopped early, and a visit's
 * report once the visit has begun. `now` is the chain's time, in seconds.
 */
export function voucherBookingAct(booking: VoucherBooking, now: number): VoucherBookingAct | null {
  const { service, stage } = booking;
  if (
    stage.kind === "return-failed" ||
    stage.kind === "transfer-failed" ||
    stage.kind === "transfer-pending"
  )
    return "retry";
  // Once a return is proposed the booking waits on its holder's split, not on the steward.
  if (stage.kind === "ended-early") return stage.returnCeiling === 0n ? "propose" : null;
  return service.kind === "visit" && now >= service.startsAt ? "report" : null;
}

/**
 * A return the issuer may propose while a units booking still runs (the live read gives each one
 * a ceiling before the final split): optional, so it waits on no one and stays on the offer's row.
 */
export function voucherBookingOptionalAct(booking: VoucherBooking): "propose" | null {
  const { service, stage } = booking;
  // A return already proposed on a booking that ended early can still be raised to its limit.
  if (stage.kind === "ended-early")
    return stage.returnCeiling > 0n && stage.returnCeiling < stage.returnLimit ? "propose" : null;
  return stage.kind === "in-progress" && service.kind === "units" && service.returnLimit !== null
    ? "propose"
    : null;
}
