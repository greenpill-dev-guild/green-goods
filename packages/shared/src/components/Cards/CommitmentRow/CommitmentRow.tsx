/**
 * CommitmentRow — one promise in a list, the same on the installed app and the cockpit.
 *
 * It is the shared item row led by the promise's direction: a seedling for an offer, a
 * helping hand for a request, named for screen readers, so no detail repeats it. Copies made
 * together are one row, their number marked on the tile. The row's one pill is its state in
 * the surface's own words, and a queue or act state replaces it while it lasts: "Confirming…"
 * while an act is on its way, "Not sent" while it waits on this device, "Didn't send" once its
 * send gave up. The 2px edge follows the pill. The detail line gives the due date, then the
 * other person, named as the shared address display names them; a queue or act state's own
 * words lead the line instead, and a group gives its counts in the person's place. A service
 * offer says what booking takes first, then who promises delivery (PRD-1299). A promise
 * still on the device has no page yet to show its units, so they lead its line, unless
 * something stops its send: then what stops it leads and the units follow.
 *
 * What only commitments have stays with them: each surface's state words, the act phase
 * line, the queue's recovery, and who a promise is between.
 *
 * @module components/Cards/CommitmentRow
 */
import { RiHandHeartLine, RiSeedlingLine } from "@remixicon/react";
import * as React from "react";
import { useIntl } from "react-intl";
import { useAddressDisplayName } from "../../../hooks/ens/useAddressDisplayName";
import {
  type CommitmentSeat,
  selectCommitmentOtherParty,
} from "../../../modules/commitment-pooling/selectors";
import type { CommitmentReadModel } from "../../../modules/commitment-pooling/types-core";
import {
  ItemRow,
  type ItemRowDetail,
  type ItemRowProps,
  type ItemRowTone,
} from "../ItemRow/ItemRow";

/** The record's direction; anything but an offer or a request reads as not known yet. */
export type CommitmentRowDirection = NonNullable<CommitmentReadModel["direction"]>;

/** A queue or act state that replaces the row's status while it lasts. */
export type CommitmentRowPending = "confirming" | "notSent" | "sendFailed";

const PENDING: Record<CommitmentRowPending, { id: string; tone: ItemRowTone }> = {
  confirming: { id: "app.commitments.row.confirming", tone: "info" },
  notSent: { id: "app.pool.queued.notSent", tone: "warning" },
  sendFailed: { id: "app.commitments.row.sendFailed", tone: "error" },
};

export interface CommitmentRowProps
  extends Omit<ItemRowProps, "lead" | "edge" | "details" | "status"> {
  /** Offer or request; a record not read yet shows the offer's icon, unnamed. */
  direction: CommitmentRowDirection | null | undefined;
  /** The promise's state, in the surface's own words. */
  status?: { label: string; tone: ItemRowTone };
  /** A queue or act state, which takes the pill's place while it lasts. */
  pending?: CommitmentRowPending | null;
  /** When it is due, as the surface writes a due date. */
  due?: ItemRowDetail | null;
  /**
   * Who the promise is between, read from the reader's seat (none in a steward's list): the
   * row names the other person as the shared address display names them.
   */
  party?: {
    commitment: Pick<
      CommitmentReadModel,
      "creator" | "leadProvider" | "counterparty" | "direction"
    >;
    seat?: CommitmentSeat | null;
  } | null;
  /**
   * What the row has to say first, in the due date's place at the head of the line: a queue
   * or act state's words while it lasts, or what kind of ask the row is. The due date follows.
   */
  note?: ItemRowDetail | null;
  /**
   * How much a promise still on the device promises, when its title does not already say: it
   * has no page yet to show them, so they lead the line and the note or the due date follows.
   */
  units?: ItemRowDetail | null;
  /**
   * Something stops the send as it stands (a failed send, the garden membership it waits for,
   * a reward that cannot be sent yet, a send that may already have gone). The note says what,
   * so it leads the line, ahead of the units: the line keeps one row and drops from its end.
   */
  blocked?: boolean;
  /** Copies made together: how many, marked on the tile, and their counts in the person's place. */
  group?: { size: number; counts: ItemRowDetail } | null;
  /**
   * A service offer (PRD-1299, surface 5): what booking it takes first ("You hold 9", "Exchange
   * first") leads the line in the due date's place, as what kind of ask a row is does, and who
   * promises delivery follows in the person's place. A queue or act state's note still leads.
   */
  service?: { booking: ItemRowDetail; promisedBy: string } | null;
}

type Detail = ItemRowDetail | null | undefined;

/** The line's two details, most important first; a missing one leaves the other alone. */
function detailLine(first: Detail, second: Detail): ItemRowProps["details"] {
  if (first && second) return [first, second];
  const only = first || second;
  return only ? [only] : undefined;
}

/** Whether the line has room for the other person: their place is taken by anything else. */
function lineNamesPerson({
  note,
  units,
  group,
  service,
}: Pick<CommitmentRowProps, "note" | "units" | "group" | "service">): boolean {
  return !note && !units && !group && !service;
}

type RowViewProps = Omit<CommitmentRowProps, "party"> & {
  /** The other person's name, once the row has someone to name. */
  personName: string | null;
};

const RowView = React.forwardRef<HTMLElement, RowViewProps>(function RowView(
  { direction, status, pending, due, personName, note, units, blocked, group, service, ...rest },
  ref
) {
  const { formatMessage } = useIntl();
  const isRequest = direction === "REQUEST";
  const pill = pending
    ? { label: formatMessage({ id: PENDING[pending].id }), tone: PENDING[pending].tone }
    : status;
  const count = group ? Math.max(group.size, 0) : 0;
  const noteLeads = Boolean(note) && (blocked || !units);
  const details = noteLeads
    ? detailLine(note, units ?? service?.booking ?? due)
    : units
      ? detailLine(units, note ?? due)
      : service
        ? detailLine(service.booking, service.promisedBy)
        : detailLine(due, group ? group.counts : personName);

  return (
    <ItemRow
      ref={ref}
      data-component="CommitmentRow"
      data-direction={direction ?? undefined}
      data-pending={pending ?? undefined}
      data-service={service ? "offer" : undefined}
      {...rest}
      lead={{
        kind: "icon",
        icon: isRequest ? <RiHandHeartLine /> : <RiSeedlingLine />,
        // A record not read yet leads as an offer did before, without claiming to be one.
        label:
          direction === "OFFER" || direction === "REQUEST"
            ? formatMessage({
                id: isRequest ? "app.commitments.row.request" : "app.commitments.row.offer",
              })
            : undefined,
        mark: group ? (
          <>
            <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
            <span className="sr-only">
              {formatMessage({ id: "app.pool.group.row.name" }, { count })}
            </span>
          </>
        ) : undefined,
      }}
      status={pill}
      edge={pill?.tone}
      details={details}
    />
  );
});

export const CommitmentRow = React.forwardRef<HTMLElement, CommitmentRowProps>(
  function CommitmentRow({ party, ...props }, ref) {
    // Only a row whose line names someone looks a name up: a row with nobody yet (a promise
    // still on this device, a pinned promise), or whose line gives the person's place to
    // something else, reads none. The row is one component either way, so a promise someone
    // takes up keeps its row, and the reader's focus with it. A list's rows read their names
    // together, in one batch.
    const person = party && lineNamesPerson(props) ? selectCommitmentOtherParty(party) : null;
    const { display } = useAddressDisplayName(person, { list: true });
    return <RowView ref={ref} {...props} personName={person ? display : null} />;
  }
);

CommitmentRow.displayName = "CommitmentRow";
