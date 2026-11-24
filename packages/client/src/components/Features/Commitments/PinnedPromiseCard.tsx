// Command surface: names the promise a flow is for while its steps scroll.
import {
  CommitmentRow,
  type CommitmentRowDirection,
} from "@green-goods/shared/components/Cards/CommitmentRow/CommitmentRow";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { useIntl } from "react-intl";

/** "Proof for" in the proof flow, "Work for" in Submit Work. */
type PinnedPromiseKind = "proof" | "work";

interface PinnedPromiseCardProps {
  kind: PinnedPromiseKind;
  /** The promise's title, on one line with the full title on hover. */
  title: string;
  /** Offer or request, when the flow knows it; a promise of either kind leads as an offer. */
  direction?: CommitmentRowDirection | null;
  /** Opens the promise in a sheet without leaving the step. */
  onOpen: () => void;
  className?: string;
}

/**
 * The promise a flow is for, named on every step (D16) as the shared commitment row: the
 * direction's icon, the title, and what the flow adds to it ("Proof for") on the detail
 * line. It follows the step's FormInfo card and pins under the top bar as the page scrolls,
 * so the heading scrolls away and the promise stays in view (O9). Tapping it opens the
 * promise in a sheet; closing the sheet returns to the same step.
 */
export function PinnedPromiseCard({
  kind,
  title,
  direction,
  onOpen,
  className,
}: PinnedPromiseCardProps) {
  const { formatMessage } = useIntl();
  const label = formatMessage({
    id: kind === "proof" ? "app.commitment.pinned.proofFor" : "app.commitment.pinned.workFor",
  });
  // The button's name replaces the row's contents, the direction's named icon with them, so
  // a promise whose direction is known says it first, as the icon leads the row.
  const directionName =
    direction === "OFFER" || direction === "REQUEST"
      ? formatMessage({
          id: direction === "REQUEST" ? "app.commitments.row.request" : "app.commitments.row.offer",
        })
      : null;
  const openLabel = directionName
    ? formatMessage(
        { id: "app.commitment.pinned.openWithDirection" },
        { direction: directionName, label, title }
      )
    : formatMessage({ id: "app.commitment.pinned.open" }, { label, title });

  return (
    <div
      className={cn(
        "sticky top-[var(--app-top-bar-height)] z-10 -mx-4 bg-bg-canvas px-4 pb-2",
        className
      )}
      data-testid="pinned-promise"
    >
      <CommitmentRow
        data-component="PinnedPromiseCard"
        direction={direction}
        title={title}
        note={label}
        onOpen={onOpen}
        openLabel={openLabel}
      />
    </div>
  );
}
