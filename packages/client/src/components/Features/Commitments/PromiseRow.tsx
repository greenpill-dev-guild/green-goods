import {
  CommitmentRow,
  type CommitmentRowProps,
} from "@green-goods/shared/components/Cards/CommitmentRow/CommitmentRow";
import { ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import type { InboxCommitment } from "@green-goods/shared/commitment-pooling";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import { useIntl } from "react-intl";

import { presentState, promiseDueDetail } from "./presentation";

export interface PromiseRowProps {
  row: InboxCommitment;
  /** The promise's own name, once its metadata has resolved. */
  title?: string | null;
  /** This one's work gave up trying to send, so the row says so itself. */
  sendFailed?: boolean;
  /** What kind of ask it is, leading the details: the garden's To confirm names it. */
  kind?: string | null;
  /** A service offer's line: what booking takes first, then who promises it (PRD-1299). */
  service?: CommitmentRowProps["service"];
  /** Identical open copies standing behind this row: their number marks the tile (DL-150). */
  copies?: number;
  /** Given a destination, the row becomes the way into the promise. */
  onOpen?: (commitmentId: bigint) => void;
}

/**
 * One promise, as a member sees it in a list: the shared commitment row (F7), in the
 * member's words. The offer or request icon leads; the one pill says where it stands, or
 * that it needs the reader ("Needs you"), or that its work didn't send, which outranks both.
 * The details give the due date, then the other person from the reader's side; how the
 * reader is involved, its units and its team live on the promise.
 */
export function PromiseRow({
  row,
  title,
  sendFailed,
  kind,
  service,
  copies,
  onOpen,
}: PromiseRowProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const { commitment, seat, needsYou } = row;
  const state = presentState(commitment.derivedState);
  const units = commitment.unitLabel
    ? formatCommitmentUnits(intl, commitment.targetUnits, commitment.unitLabel)
    : null;
  // A promise is named by its member, counted by its units. Until the name
  // resolves the units stand in, because they are the substance either way.
  const primary = title ?? units ?? formatMessage({ id: "app.commitments.row.untitled" });

  return (
    <CommitmentRow
      data-needs-you={needsYou ? "true" : "false"}
      direction={commitment.direction}
      title={primary}
      status={
        needsYou
          ? { label: formatMessage({ id: "app.commitments.row.needsYou" }), tone: "warning" }
          : { label: formatMessage({ id: state.labelId }), tone: state.tone }
      }
      pending={sendFailed ? "sendFailed" : null}
      note={kind}
      service={service}
      due={promiseDueDetail(intl, commitment.dueDate)}
      party={{ commitment, seat }}
      group={copies ? { size: copies, counts: "" } : null}
      // A row without a destination is a record, not a control.
      onOpen={onOpen ? () => onOpen(commitment.commitmentId) : undefined}
    />
  );
}

/** The row's own frame with nothing in it, for a list that is still loading (DL-056). */
export function PromiseRowSkeleton() {
  return <ItemRowSkeleton lead="icon" />;
}
