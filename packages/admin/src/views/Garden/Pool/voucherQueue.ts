import type { ItemRowTone } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import type { VoucherConsoleView } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { claimRowKey } from "@green-goods/shared/hooks/admin-ui/pool/useWaitingForApproval";
import type { VoucherBooking } from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { PoolClaimRequestRow } from "@green-goods/shared/modules/commitment-pooling/types-core";
import type { IntlShape } from "react-intl";
import { dayText } from "./poolTime";
import {
  voucherAmountWords,
  voucherBookingAct,
  voucherCount,
  voucherOfferRow,
} from "./voucherPresentation";

type Intl = Pick<IntlShape, "formatMessage" | "formatDate" | "formatTime" | "formatDateToParts">;

/**
 * Review Promises as the one queue for every booking act (decision 1 of the hub-day review,
 * 18 November 2026): beside the asks, each booking under way that waits on the steward, with
 * the act it waits for, held for the visit as the asks are (PRD-1025 rule 4, DL-067). And how
 * Offers and Asks names a voucher offer once its acts left for the queue (decision 2): what one
 * booking takes.
 */

/** A booking's act in the queue. */
export type QueueBookingAct = NonNullable<ReturnType<typeof voucherBookingAct>>;

/** An act the steward sent from the queue this visit, which the row keeps as its outcome. */
export interface QueueDone {
  act: "approve" | Exclude<QueueBookingAct, "retry">;
  /** When it landed, in milliseconds. */
  at: number;
  /** The consent an approval answered: the same person asking afresh is a new ask. */
  claimHash?: string;
}

export interface QueueVisit {
  /** The pool the visit is in: `chain:garden`. */
  pool: string;
  /** The first voucher read is in: bookings due after it join marked New. */
  started: boolean;
  /** Every row key seen this visit, in the order first seen. */
  order: readonly string[];
  /** Bookings that came due after the visit started. */
  arrived: ReadonlySet<string>;
  /** Each booking that came due this visit, as last read, so its row outlives the read. */
  bookings: ReadonlyMap<string, VoucherBooking>;
  done: ReadonlyMap<string, QueueDone>;
}

export function emptyQueueVisit(pool: string): QueueVisit {
  return {
    pool,
    started: false,
    order: [],
    arrived: new Set(),
    bookings: new Map(),
    done: new Map(),
  };
}

/** A booking's row goes by its person and promise, as their ask did, so one person keeps one row. */
export function bookingRowKey(booking: Pick<VoucherBooking, "commitmentId" | "holder">): string {
  // The ask's key reads only the promise and the person, which a booking names too.
  const claim = { commitmentId: booking.commitmentId, claimant: booking.holder };
  return claimRowKey({ claim } as PoolClaimRequestRow);
}

/**
 * The visit after a read: asks and due bookings not seen before join the end, a booking that
 * comes due after the first voucher read joins marked New, and a known booking keeps its latest
 * read. The same visit comes back when nothing changed, so a render can call this safely.
 */
export function reconcileQueueVisit(
  visit: QueueVisit,
  input: {
    pool: string;
    askKeys: readonly string[];
    /** The voucher read is in; null until it is. */
    vouchers: Pick<VoucherConsoleView, "snapshot" | "now"> | null;
  }
): QueueVisit {
  const from = visit.pool === input.pool ? visit : emptyQueueVisit(input.pool);
  const order = [...from.order];
  const known = new Set(order);
  const arrived = new Set(from.arrived);
  const bookings = new Map(from.bookings);
  let changed = from !== visit;
  for (const key of input.askKeys) {
    if (known.has(key)) continue;
    order.push(key);
    known.add(key);
    changed = true;
  }
  const read = input.vouchers?.snapshot.status === "observed" ? input.vouchers : null;
  for (const booking of read?.snapshot.bookings ?? []) {
    const key = bookingRowKey(booking);
    const tracked = bookings.has(key);
    if (!tracked && voucherBookingAct(booking, read!.now) === null) continue;
    if (bookings.get(key) !== booking) {
      bookings.set(key, booking);
      changed = true;
    }
    if (known.has(key)) continue;
    order.push(key);
    known.add(key);
    if (from.started) arrived.add(key);
    changed = true;
  }
  const started = from.started || read !== null;
  if (!changed && started === from.started) return visit;
  return { ...from, started, order, arrived, bookings };
}

/**
 * How many bookings under way wait on the steward's act now, for What needs you's To review. A
 * booking whose ask the pool still lists is that ask's row in the queue, so it counts once, with
 * the asks (`pendingAsks`).
 */
export function queueBookingsDue(
  vouchers: Pick<VoucherConsoleView, "snapshot" | "now">,
  pendingAsks: readonly PoolClaimRequestRow[] = []
): number {
  if (vouchers.snapshot.status !== "observed") return 0;
  const asked = new Set(pendingAsks.map(claimRowKey));
  return vouchers.snapshot.bookings.filter(
    (booking) =>
      voucherBookingAct(booking, vouchers.now) !== null && !asked.has(bookingRowKey(booking))
  ).length;
}

/** The visit with the steward's own act on one row, which the row keeps as its outcome. */
export function recordQueueDone(visit: QueueVisit, key: string, done: QueueDone): QueueVisit {
  return { ...visit, done: new Map(visit.done).set(key, done) };
}

/** What a booking row's pill and line say: what it waits for, or who it waits on once done. */
export interface QueueBookingTag {
  tag: { label: string; tone: ItemRowTone };
  detail: string;
}

const noteText = (note: NonNullable<ReturnType<typeof voucherOfferRow>>["note"]) =>
  typeof note === "string" ? note : note.text;

/** The pill and line of a booking that waits on the steward's act. */
export function queueBookingTag(
  booking: VoucherBooking,
  act: QueueBookingAct,
  vouchers: Pick<VoucherConsoleView, "bookingFor" | "snapshot" | "now">,
  intl: Intl,
  nowMs: number
): QueueBookingTag {
  const { formatMessage } = intl;
  const note = voucherOfferRow(booking.commitmentId, vouchers, intl, nowMs)?.note;
  const detail = note ? noteText(note) : "";
  if (act === "report" && booking.service.kind === "visit") {
    return {
      tag: {
        label: formatMessage({
          id: "hub.garden.pool.voucher.queue.visitToReport",
          defaultMessage: "Visit to report",
        }),
        tone: "warning",
      },
      detail: formatMessage(
        {
          id: "hub.garden.pool.voucher.queue.visited",
          defaultMessage:
            "Visited {date} · {count, plural, one {# voucher} other {# vouchers}} held",
        },
        {
          date: dayText(intl, booking.service.startsAt * 1000, nowMs),
          count: voucherCount(booking.voucherUnits, booking.issuer.decimals),
        }
      ),
    };
  }
  if (act === "propose") {
    return {
      tag: {
        label: formatMessage({
          id: "hub.garden.pool.voucher.queue.returnToPropose",
          defaultMessage: "Return to propose",
        }),
        tone: "warning",
      },
      detail,
    };
  }
  return {
    tag: {
      label: formatMessage({
        id: "hub.garden.pool.summary.recovery",
        defaultMessage: "Needs recovery",
      }),
      tone: "error",
    },
    detail,
  };
}

/** Who a booking waits on once the steward's act went out, or null when it waits on no one. */
export function queueDoneTag(
  booking: VoucherBooking,
  act: QueueDone["act"],
  name: string,
  formatMessage: IntlShape["formatMessage"]
): QueueBookingTag | null {
  if (act === "report") {
    const hours =
      booking.service.kind === "visit"
        ? formatMessage(
            {
              id: "hub.garden.pool.voucher.queue.hoursReported",
              defaultMessage: "{used} of {of} hours reported",
            },
            { used: booking.service.report.usableHours, of: booking.service.report.ofHours }
          )
        : "";
    return {
      tag: {
        label: formatMessage(
          {
            id: "hub.garden.pool.voucher.queue.waitingConfirm",
            defaultMessage: "Waiting for {name} to confirm",
          },
          { name }
        ),
        tone: "neutral",
      },
      detail: hours,
    };
  }
  if (act === "propose") {
    return {
      tag: {
        label: formatMessage(
          {
            id: "hub.garden.pool.voucher.queue.waitingSplit",
            defaultMessage: "Waiting for {name} to approve the split",
          },
          { name }
        ),
        tone: "neutral",
      },
      detail: "",
    };
  }
  return null;
}

/** A booking's pill and line once it is under way and waits on no one: booked, and when. */
export function queueBookedTag(
  booking: VoucherBooking,
  vouchers: Pick<VoucherConsoleView, "bookingFor" | "snapshot" | "now">,
  intl: Intl,
  nowMs: number
): QueueBookingTag {
  const note = voucherOfferRow(booking.commitmentId, vouchers, intl, nowMs)?.note;
  return {
    tag: {
      label: intl.formatMessage({
        id: "hub.garden.pool.voucher.queue.booked",
        defaultMessage: "Booked",
      }),
      tone: "success",
    },
    detail: note ? noteText(note) : "",
  };
}

/** The outcome a row keeps for the visit once the steward's act went out. */
export function queueDoneLabel(
  act: QueueDone["act"],
  formatMessage: IntlShape["formatMessage"]
): string {
  switch (act) {
    case "approve":
      return formatMessage({
        id: "hub.garden.pool.approvals.approved",
        defaultMessage: "Approved",
      });
    case "report":
      return formatMessage({
        id: "hub.garden.pool.voucher.queue.reported",
        defaultMessage: "Reported",
      });
    case "propose":
      return formatMessage({
        id: "hub.garden.pool.voucher.queue.returnProposed",
        defaultMessage: "Return proposed",
      });
  }
}

type VoucherReads = Pick<VoucherConsoleView, "bookingFor" | "snapshot">;

/** Whether the voucher read knows any of these promises: a booking under way, or one asked. */
export function isVoucherOffer(commitmentIds: readonly bigint[], vouchers: VoucherReads): boolean {
  return commitmentIds.some(
    (id) =>
      vouchers.bookingFor(id) !== undefined ||
      vouchers.snapshot.asks.some((ask) => ask.commitmentId === id)
  );
}

/**
 * What one booking of a voucher offer takes, from a booking under way or an ask that reached
 * its issuer: "Takes 1 Tech and Sun voucher". Null while no read says.
 */
export function voucherOfferTakes(
  commitmentIds: readonly bigint[],
  vouchers: VoucherReads,
  formatMessage: IntlShape["formatMessage"]
): string | null {
  for (const id of commitmentIds) {
    const booking = vouchers.bookingFor(id);
    const ask = vouchers.snapshot.asks.find((entry) => entry.commitmentId === id && entry.setup);
    const source = booking
      ? { units: booking.voucherUnits, issuer: booking.issuer }
      : ask?.setup
        ? { units: ask.setup.voucherUnits, issuer: ask.issuer }
        : null;
    if (!source) continue;
    return formatMessage(
      { id: "hub.garden.pool.voucher.row.takes", defaultMessage: "Takes {vouchers}" },
      {
        vouchers: voucherAmountWords(
          formatMessage,
          source.units,
          source.issuer.decimals,
          source.issuer.name
        ),
      }
    );
  }
  return null;
}
