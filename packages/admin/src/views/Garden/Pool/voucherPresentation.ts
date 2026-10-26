import type { IssuerSafeThreshold } from "@green-goods/shared/commitment-pooling";
import type {
  ItemRowDetail,
  ItemRowTone,
} from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import type { VoucherConsoleView } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import {
  selectVoucherAskStage,
  type VoucherAsk,
  type VoucherAskStage,
  type VoucherBooking,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { IntlShape } from "react-intl";
import { formatUnits } from "viem";
import { clockTime, dayText, dueDateText, exactTime, isoTime } from "./poolTime";

type Intl = Pick<IntlShape, "formatMessage" | "formatDate" | "formatTime" | "formatDateToParts">;
type FormatMessage = IntlShape["formatMessage"];

/**
 * How the voucher console says what it reads (PRD-1297 surface 6, the copy's
 * `is.` keys): an ask's pill and detail line in Review Promises, a booking's
 * words on its Offers row, a voucher count, and the issuer Safe's signature
 * note. The Safe's count always comes from the read, never from the copy.
 */

/** A count of vouchers from token units, for a plural message's `#`. */
export function voucherCount(units: bigint, decimals: number): number {
  return Number(formatUnits(units, decimals));
}

/** An ask's pill: what the booking waits on now. */
export function voucherAskTag(
  stage: VoucherAskStage,
  formatMessage: FormatMessage
): { label: string; tone: ItemRowTone } {
  switch (stage) {
    case "needs-approval":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.voucher.tag.needsApproval",
          defaultMessage: "Needs your approval",
        }),
        tone: "warning",
      };
    case "waiting-for-deposit":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.voucher.tag.waitingDeposit",
          defaultMessage: "Waiting for the deposit",
        }),
        tone: "info",
      };
    case "ready":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.voucher.tag.depositConfirmed",
          defaultMessage: "Deposit confirmed",
        }),
        tone: "success",
      };
    case "setting-up":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.voucher.tag.settingUp",
          defaultMessage: "Being set up",
        }),
        tone: "neutral",
      };
    case "terms-changed":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.voucher.tag.termsChanged",
          defaultMessage: "Terms changed",
        }),
        tone: "error",
      };
    case "past-deadline":
      return {
        label: formatMessage({
          id: "cockpit.garden.pool.voucher.tag.pastDeadline",
          defaultMessage: "Deadline passed",
        }),
        tone: "error",
      };
  }
}

/** The line under an ask's pill: when the member agreed, what the escrow holds, and the deadline. */
export function voucherAskDetail(
  ask: VoucherAsk,
  stage: VoucherAskStage,
  intl: Intl,
  nowMs: number
): string {
  const { formatMessage } = intl;
  const agreed = dayText(intl, ask.agreedAt * 1000, nowMs);
  const { setup } = ask;
  if (stage === "terms-changed") {
    return formatMessage(
      {
        id: "cockpit.garden.pool.voucher.ask.termsChanged",
        defaultMessage: "Agreed to version {agreed}; the offer is now version {current}",
      },
      { agreed: ask.agreed.revision.toString(), current: ask.current.revision.toString() }
    );
  }
  if (setup === null) {
    return formatMessage(
      {
        id: "cockpit.garden.pool.voucher.ask.settingUp",
        defaultMessage: "Agreed {date} · not with the issuer yet",
      },
      { date: agreed }
    );
  }
  const due = dueDateText(intl, setup.acceptBy * 1000, nowMs);
  const count = voucherCount(setup.voucherUnits, ask.issuer.decimals);
  switch (stage) {
    case "past-deadline":
      return formatMessage(
        {
          id: "cockpit.garden.pool.voucher.ask.pastDeadline",
          defaultMessage: "Not accepted by {due} · the deposit goes back",
        },
        { due }
      );
    case "needs-approval":
      return formatMessage(
        {
          id: "cockpit.garden.pool.voucher.ask.agreed",
          defaultMessage:
            "Agreed {date} · {count, plural, one {# voucher} other {# vouchers}} · accept by {due}",
        },
        { date: agreed, count, due }
      );
    case "waiting-for-deposit":
      return formatMessage(
        {
          id: "cockpit.garden.pool.voucher.ask.approved",
          defaultMessage: "Approved {date} · accept by {due}",
        },
        { date: dayText(intl, (setup.approvedAt ?? ask.agreedAt) * 1000, nowMs), due }
      );
    default:
      return formatMessage(
        {
          id: "cockpit.garden.pool.voucher.ask.inEscrow",
          defaultMessage:
            "{count, plural, one {# voucher} other {# vouchers}} in escrow · accept by {due}",
        },
        { count, due }
      );
  }
}

/** The ask's one act: the issuer's approval first, the pool steward's acceptance once deposited. */
export function voucherAskAct(stage: VoucherAskStage): "approve" | "accept" | null {
  if (stage === "needs-approval") return "approve";
  if (stage === "ready") return "accept";
  return null;
}

interface VoucherBookingRowView {
  /** What leads the row's detail line, in the due date's place. */
  note: ItemRowDetail;
  /** A pill that replaces the promise's state while the booking needs someone. */
  status: { label: string; tone: ItemRowTone } | null;
  act: "report" | "propose" | "retry" | null;
}

/** How a booking under way reads on its offer's row, and the act it offers there. */
function voucherBookingRow(
  booking: VoucherBooking,
  intl: Intl,
  nowMs: number
): VoucherBookingRowView {
  const { formatMessage } = intl;
  const { service, stage } = booking;
  if (stage.kind === "return-failed") {
    return {
      note: {
        text: formatMessage({
          id: "cockpit.garden.pool.voucher.row.returnFailed",
          defaultMessage: "Return didn’t go through",
        }),
        tone: "error",
      },
      status: {
        label: formatMessage({
          id: "cockpit.garden.pool.summary.recovery",
          defaultMessage: "Needs recovery",
        }),
        tone: "error",
      },
      act: "retry",
    };
  }
  if (service.kind === "visit") {
    const start = service.startsAt * 1000;
    return {
      note: {
        text: formatMessage(
          {
            id: "cockpit.garden.pool.voucher.row.visit",
            defaultMessage: "Visit {date}, {start} to {end}",
          },
          {
            date: dayText(intl, start, nowMs),
            start: clockTime(intl, start),
            end: clockTime(intl, service.endsAt * 1000),
          }
        ),
        dateTime: isoTime(start),
        title: exactTime(intl, start),
      },
      status: null,
      act: stage.kind === "in-progress" ? "report" : null,
    };
  }
  if (stage.kind === "ended-early") {
    return {
      note: formatMessage(
        {
          id: "cockpit.garden.pool.voucher.row.endedEarly",
          defaultMessage: "Ended early · {done} of {of} days",
        },
        { done: service.daysUsed, of: service.daysOf }
      ),
      status: {
        label: formatMessage({ id: "app.commitments.row.needsYou", defaultMessage: "Needs you" }),
        tone: "warning",
      },
      act: "propose",
    };
  }
  return {
    note: formatMessage(
      { id: "cockpit.garden.pool.voucher.row.day", defaultMessage: "Day {done} of {of}" },
      { done: service.daysUsed, of: service.daysOf }
    ),
    status: null,
    act: null,
  };
}

/**
 * How a voucher offer's row in Offers and Requests reads: its booking under
 * way, else how far the bookings asked on it have come. Null for a promise
 * that isn't a voucher offer, which keeps its ordinary row.
 */
export function voucherOfferRow(
  commitmentId: bigint,
  vouchers: Pick<VoucherConsoleView, "bookingFor" | "snapshot" | "now">,
  intl: Intl,
  nowMs: number
): (VoucherBookingRowView & { booking: VoucherBooking | null }) | null {
  const booking = vouchers.bookingFor(commitmentId);
  if (booking) return { ...voucherBookingRow(booking, intl, nowMs), booking };
  const asks = vouchers.snapshot.asks.filter((ask) => ask.commitmentId === commitmentId);
  if (asks.length === 0) return null;
  const deposited = asks.some((ask) => selectVoucherAskStage(ask, vouchers.now) === "ready");
  return {
    note: deposited
      ? intl.formatMessage({
          id: "cockpit.garden.pool.voucher.row.booked",
          defaultMessage: "Booking: deposit confirmed",
        })
      : intl.formatMessage({
          id: "cockpit.garden.pool.voucher.row.asked",
          defaultMessage: "Booking asked",
        }),
    status: null,
    act: null,
    booking: null,
  };
}

/** The issuer Safe's signature rule, closing a Safe write's dialog as the shipped dialogs say their prompts. */
export function voucherSafeNote(
  safe: IssuerSafeThreshold | undefined,
  formatMessage: FormatMessage
): string {
  if (safe?.status !== "observed" || safe.threshold === null || safe.owners === null) {
    return formatMessage({
      id: "cockpit.garden.pool.voucher.safe.unread",
      defaultMessage: "Your Safe signs this. Its signature count can’t be read right now.",
    });
  }
  return formatMessage(
    {
      id: "cockpit.garden.pool.voucher.safe.needs",
      defaultMessage:
        "{threshold, plural, one {Your Safe needs # signature.} other {Your Safe needs # of {owners} signatures.}}",
    },
    { threshold: safe.threshold, owners: safe.owners }
  );
}
