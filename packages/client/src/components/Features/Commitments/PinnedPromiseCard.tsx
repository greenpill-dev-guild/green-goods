// Command surface: names the promise a flow is for while its steps scroll.
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiArrowRightSLine, RiHandHeartLine } from "@remixicon/react";
import { useIntl } from "react-intl";

/** "Proof for" in the proof flow, "Work for" in Submit Work. */
type PinnedPromiseKind = "proof" | "work";

interface PinnedPromiseCardProps {
  kind: PinnedPromiseKind;
  /** The promise's title, clamped to two lines. */
  title: string;
  /** Opens the promise in a sheet without leaving the step. */
  onOpen: () => void;
  className?: string;
}

/**
 * The promise a flow is for, named on every step (D16). It follows the step's
 * FormInfo card and pins under the 80px top bar as the page scrolls, so the
 * heading scrolls away and the promise stays in view (O9). Tapping it opens the
 * promise in a sheet; closing the sheet returns to the same step.
 */
export function PinnedPromiseCard({ kind, title, onOpen, className }: PinnedPromiseCardProps) {
  const { formatMessage } = useIntl();
  const label = formatMessage({
    id: kind === "proof" ? "app.commitment.pinned.proofFor" : "app.commitment.pinned.workFor",
  });

  return (
    <div
      className={cn("sticky top-20 z-10 -mx-4 bg-bg-white-0 px-4 pb-2", className)}
      data-testid="pinned-promise"
    >
      <button
        type="button"
        data-pressable="card"
        onClick={onOpen}
        aria-label={formatMessage({ id: "app.commitment.pinned.open" }, { label, title })}
        className="flex w-full min-w-0 items-center gap-2 rounded-[var(--radius-lg)] border border-primary-alpha-24 bg-primary-alpha-10 p-3 text-left"
      >
        <RiHandHeartLine aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-text-sub-600">{label}</span>
          <span
            className="line-clamp-2 block text-sm font-medium text-text-strong-950"
            title={title}
          >
            {title}
          </span>
        </span>
        <RiArrowRightSLine aria-hidden="true" className="h-5 w-5 shrink-0 text-text-soft-400" />
      </button>
    </div>
  );
}
