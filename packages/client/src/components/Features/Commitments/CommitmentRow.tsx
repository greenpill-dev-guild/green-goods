import { StatusBadge, type InboxCommitment } from "@green-goods/shared";
import { RiSeedlingLine } from "@remixicon/react";
import { useIntl } from "react-intl";

import { presentState, relationshipLabelId } from "./presentation";

export interface CommitmentRowProps {
  row: InboxCommitment;
  /** The commitment's own name, once its metadata has resolved. */
  title?: string | null;
  /** This one's work gave up trying to send, so the row says so itself. */
  sendFailed?: boolean;
  /** Given a destination, the row becomes the way into the commitment. */
  onOpen?: (commitmentId: bigint) => void;
}

/**
 * One commitment, as a member sees it in their own list.
 *
 * The title lives in off-chain metadata that nothing in the app resolves yet,
 * so the row leads with what the commitment actually is: its unit label and
 * count, which the spec already requires to stay in exact labels and never be
 * added across unlike units.
 */
export function CommitmentRow({ row, title, sendFailed, onOpen }: CommitmentRowProps) {
  const { formatMessage } = useIntl();
  const { commitment, seat, needsYou } = row;
  const state = presentState(commitment.derivedState);
  const relationshipId = relationshipLabelId(seat, commitment.direction);

  const units = commitment.unitLabel
    ? formatMessage(
        { id: "app.commitments.row.units" },
        { count: commitment.targetUnits.toString(), unit: commitment.unitLabel }
      )
    : null;
  // A commitment is named by its member, counted by its units. Until the name
  // resolves the units stand in, because they are the substance either way.
  const primary = title ?? units ?? formatMessage({ id: "app.commitments.row.untitled" });
  const secondary = title ? units : null;

  // A row without a destination is a record, not a control, so it stays a div
  // rather than a button nothing happens behind.
  const Element = onOpen ? "button" : "div";

  return (
    <Element
      {...(onOpen
        ? { type: "button" as const, onClick: () => onOpen(commitment.commitmentId) }
        : {})}
      className="flex w-full items-start gap-3 rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-3 text-left"
      data-component="CommitmentRow"
      data-needs-you={needsYou ? "true" : "false"}
    >
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-weak-50 text-text-sub-600"
        aria-hidden="true"
      >
        <RiSeedlingLine className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-strong-950" title={primary}>
          {primary}
        </p>
        {secondary ? (
          <p className="mt-0.5 truncate text-xs text-text-sub-600">{secondary}</p>
        ) : null}
        {commitment.direction === "OFFER" || commitment.direction === "REQUEST" ? (
          <p className="mt-0.5 text-xs text-text-soft-400">
            {formatMessage({
              id:
                commitment.direction === "OFFER"
                  ? "app.commitments.direction.offer"
                  : "app.commitments.direction.request",
            })}
          </p>
        ) : null}
        {relationshipId ? (
          <p className="mt-0.5 truncate text-xs text-text-sub-600">
            {formatMessage({ id: relationshipId })}
          </p>
        ) : null}
        {commitment.contributorCount > 1 ? (
          <p className="mt-0.5 text-xs text-text-soft-400">
            {formatMessage(
              { id: "app.commitments.row.team" },
              { count: commitment.contributorCount }
            )}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge size="sm" variant={state.tone}>
          {formatMessage({ id: state.labelId })}
        </StatusBadge>
        {sendFailed ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-error-base">
            {formatMessage({ id: "app.commitments.row.sendFailed" })}
          </span>
        ) : needsYou ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-warning-base">
            {formatMessage({ id: "app.commitments.row.needsYou" })}
          </span>
        ) : null}
      </div>
    </Element>
  );
}
