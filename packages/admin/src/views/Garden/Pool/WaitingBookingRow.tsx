import { useAddressDisplayName } from "@green-goods/shared/hooks/ens/useAddressDisplayName";
import type { VoucherBooking } from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { PersonName } from "@/components/PersonName";
import { clockTime, dayText } from "./poolTime";
import type { QueueBookingTag } from "./voucherQueue";
import {
  ClosedBadge,
  NewMarker,
  OutcomeBadge,
  QueueMoment,
  QueueRowFrame,
} from "./WaitingForApprovalRow";

/** Where a booking's row stands this visit. */
type WaitingBookingState =
  /** It waits on the steward's act, which takes the right slot. */
  | { status: "waiting"; act: ReactNode }
  /** The steward's act went out from this row this visit, and the row keeps its outcome. */
  | { status: "done"; label: string; at: number }
  /** It stopped waiting on the steward without an act here: settled elsewhere. */
  | { status: "gone" };

export interface WaitingBookingRowProps {
  booking: VoucherBooking;
  /** The offer the booking is for. */
  title: string;
  /** It came due after the visit's first read. */
  isNew: boolean;
  state: WaitingBookingState;
  /** What it waits for, or who it waits on once done, given the holder's name; null for none. */
  tagFor: (name: string) => QueueBookingTag | null;
  nowMs: number;
  /** Open the booking's promise. */
  onOpen?: () => void;
}

/**
 * A booking under way in Review Promises, on the asks' own row: the member who holds it and,
 * for a visit, its day; "Booking · title" under them; the one act it waits for on the right,
 * where Approve… and Accept… sit on an ask; then its pill and line across the row. A booking is
 * the member's already, so there is nothing to decline. Once the act goes out, the row keeps
 * its outcome for the visit (DL-067).
 */
export function WaitingBookingRow({
  booking,
  title,
  isNew,
  state,
  tagFor,
  nowMs,
  onOpen,
}: WaitingBookingRowProps) {
  const intl = useIntl();
  const { display: name } = useAddressDisplayName(booking.holder, { list: true });
  const { formatMessage } = intl;
  const waiting = state.status === "waiting";
  const visit = booking.service.kind === "visit" ? booking.service.startsAt * 1000 : null;
  const when =
    state.status === "done" ? (
      <QueueMoment ms={state.at} text={clockTime(intl, state.at)} />
    ) : visit !== null ? (
      <QueueMoment ms={visit} text={dayText(intl, visit, nowMs)} />
    ) : null;
  const action =
    state.status === "waiting" ? (
      state.act
    ) : state.status === "done" ? (
      <OutcomeBadge label={state.label} />
    ) : (
      <ClosedBadge
        label={formatMessage({
          id: "hub.garden.pool.approvals.gone",
          defaultMessage: "No longer waiting",
        })}
      />
    );
  return (
    <QueueRowFrame
      direction="OFFER"
      isNew={waiting && isNew}
      testId={`pool-booking-${booking.commitmentId.toString()}`}
      state={state.status}
      onOpen={onOpen}
      who={
        <PersonName
          address={booking.holder}
          className={waiting ? undefined : "font-medium text-text-sub"}
        />
      }
      marker={waiting && isNew ? <NewMarker /> : null}
      when={when}
      line={formatMessage(
        { id: "hub.garden.pool.voucher.ask.what", defaultMessage: "Booking · {title}" },
        { title }
      )}
      action={action}
      tag={state.status === "gone" ? null : tagFor(name)}
    />
  );
}
