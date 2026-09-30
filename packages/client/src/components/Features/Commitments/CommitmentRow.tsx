import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type InboxCommitment } from "@green-goods/shared/commitment-pooling";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import { RiHandHeartLine, RiSeedlingLine } from "@remixicon/react";
import { useIntl } from "react-intl";

import { presentState, relationshipLabelId } from "./presentation";

export interface CommitmentRowProps {
  row: InboxCommitment;
  /** The promise's own name, once its metadata has resolved. */
  title?: string | null;
  /** This one's work gave up trying to send, so the row says so itself. */
  sendFailed?: boolean;
  /** Given a destination, the row becomes the way into the promise. */
  onOpen?: (commitmentId: bigint) => void;
}

/** The row frame the list and its loading placeholders share: 88px, whatever the words. */
const ROW_FRAME =
  "flex h-22 w-full items-start gap-3 rounded-[var(--radius-lg)] border border-s-[3px] border-stroke-soft-200 bg-bg-white-0 px-3 py-2.5 text-left";

/**
 * One promise, as a member sees it in a list: one 88px row, whatever it says
 * (D4). A 3px edge on the inline start and the tile's glyph tell its direction:
 * an offer in the primary tone with a seedling, a request in the information
 * tone with a helping hand (DL-052). The title takes two lines. Under it, the
 * state pill and one qualifier, by priority: it needs you, it didn't send, your
 * relationship to it, its units. Units and team size live on the promise.
 */
export function CommitmentRow({ row, title, sendFailed, onOpen }: CommitmentRowProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const { commitment, seat, needsYou } = row;
  const state = presentState(commitment.derivedState);
  const relationshipId = relationshipLabelId(seat, commitment.direction, {
    kept: commitment.derivedState === "FULFILLED" || commitment.derivedState === "RECONCILED",
  });
  const isRequest = commitment.direction === "REQUEST";

  const units = commitment.unitLabel
    ? formatCommitmentUnits(intl, commitment.targetUnits, commitment.unitLabel)
    : null;
  // A promise is named by its member, counted by its units. Until the name
  // resolves the units stand in, because they are the substance either way.
  const primary = title ?? units ?? formatMessage({ id: "app.commitments.row.untitled" });
  const qualifier = needsYou
    ? {
        text: formatMessage({ id: "app.commitments.row.needsYou" }),
        tone: "text-warning-dark font-medium",
      }
    : sendFailed
      ? {
          text: formatMessage({ id: "app.commitments.row.sendFailed" }),
          tone: "text-error-dark font-medium",
        }
      : relationshipId
        ? { text: formatMessage({ id: relationshipId }), tone: "text-text-sub-600" }
        : title && units
          ? { text: units, tone: "text-text-sub-600" }
          : null;

  // A row without a destination is a record, not a control, so it stays a div
  // rather than a button nothing happens behind.
  const Element = onOpen ? "button" : "div";

  return (
    <Element
      {...(onOpen
        ? {
            type: "button" as const,
            onClick: () => onOpen(commitment.commitmentId),
            "data-pressable": "card",
          }
        : {})}
      title={primary}
      className={cn(
        ROW_FRAME,
        "focus:outline-none focus-visible:shadow-button-primary-focus",
        isRequest ? "border-s-information-base" : "border-s-primary"
      )}
      data-component="CommitmentRow"
      data-direction={commitment.direction}
      data-needs-you={needsYou ? "true" : "false"}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-weak-50 text-text-sub-600"
        aria-hidden="true"
      >
        {isRequest ? (
          <RiHandHeartLine className="h-4 w-4" />
        ) : (
          <RiSeedlingLine className="h-4 w-4" />
        )}
      </span>
      <span className="flex h-full min-w-0 flex-1 flex-col justify-between">
        <span className="line-clamp-2 text-sm font-medium leading-5 text-text-strong-950">
          {primary}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          {/* Text carries the state, so the pill goes icon-free. */}
          <StatusBadge
            size="xs"
            variant={state.tone}
            showIcon={false}
            className="shrink-0 whitespace-nowrap"
          >
            {formatMessage({ id: state.labelId })}
          </StatusBadge>
          {qualifier ? (
            <span className={cn("min-w-0 truncate text-xs", qualifier.tone)}>{qualifier.text}</span>
          ) : null}
        </span>
      </span>
    </Element>
  );
}

/**
 * The row's own frame with nothing in it, for a list that is still loading: the
 * 3px edge, the 32px tile, two 20px title lines and the 22px pill, so the rows
 * that arrive land exactly where these stood (D28).
 */
export function CommitmentRowSkeleton() {
  return (
    <div className={ROW_FRAME} aria-hidden="true" data-skeleton="commitment-row">
      <span className="h-8 w-8 shrink-0 rounded-[var(--radius-md)] bg-bg-soft-200" />
      <span className="flex h-full min-w-0 flex-1 flex-col justify-between">
        <span className="block">
          <span className="flex h-5 items-center">
            <span className="h-3 w-11/12 rounded bg-bg-soft-200" />
          </span>
          <span className="flex h-5 items-center">
            <span className="h-3 w-2/3 rounded bg-bg-soft-200" />
          </span>
        </span>
        <span className="block h-[22px] w-[76px] rounded-full bg-bg-soft-200" />
      </span>
    </div>
  );
}
