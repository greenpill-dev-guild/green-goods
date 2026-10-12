import { Button } from "@green-goods/shared/components/Button";
import { useIntl } from "react-intl";

import type { CommitmentAct } from "./commitmentActions";

export interface CommitmentActionBarProps {
  act: CommitmentAct;
  isPending: boolean;
  isOnline: boolean;
  /**
   * Why the act cannot be offered right now, when the reason is outside the
   * act itself. The bar stays on screen so the reader knows the act exists,
   * and says what is stopping it.
   */
  blockedReasonId?: string | null;
  onRun: () => void;
  /**
   * A second act that belongs to the same seat (optional proof beside required work). The
   * two share one row, the primary rightmost; only this pair ever shares the bar.
   */
  secondary?: { labelId: string; onRun: () => void; disabled?: boolean } | null;
}

/**
 * The screen's one act, in a fixed bar.
 *
 * Only a seat that can actually perform something reaches this component, so
 * there is no disabled-for-your-seat state to draw: a bar that cannot be used
 * answers a question its reader did not ask. The disabling here is for an act
 * already in flight, for the one act that genuinely needs the network, and for
 * a queue the phone cannot read, which is not the same as an empty one.
 *
 * The act is the page's primary (the error fill when destructive) and the second
 * act its secondary, both at the page-level lg size (DL-023, DL-026). Paired,
 * they share one row with the primary on the right, DL-016's order (D11). Each
 * starts at half the row and never shrinks below its label, so when a label
 * doesn't fit (Portuguese on a 360px phone) both take full rows, the primary on
 * top. The primary comes first in the markup, so it is also read first.
 */
export function CommitmentActionBar({
  act,
  isPending,
  isOnline,
  blockedReasonId = null,
  onRun,
  secondary = null,
}: CommitmentActionBarProps) {
  const { formatMessage } = useIntl();
  // Withdrawing is an immediate contract call rather than a queued job, so it
  // is the one act that cannot be taken offline. Everything else queues.
  const needsNetwork = act.kind === "withdraw";
  const reasonId =
    blockedReasonId ?? (needsNetwork && !isOnline ? "app.commitment.act.needsNetwork" : null);
  const unavailable = reasonId !== null;

  return (
    <div className="shrink-0 border-t border-stroke-soft-200 bg-bg-white-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {reasonId ? (
        <p className="mb-2 text-xs text-text-sub-600" role="status">
          {formatMessage({ id: reasonId })}
        </p>
      ) : null}
      <div
        className="flex flex-row-reverse flex-wrap gap-2"
        data-component="CommitmentActionBarRow"
      >
        <Button
          type="button"
          size="lg"
          tone={act.destructive ? "danger" : "default"}
          onClick={onRun}
          loading={isPending}
          disabled={unavailable}
          data-component="CommitmentActionBar"
          data-act={act.kind}
          className={secondary ? "min-w-max grow basis-[calc(50%-0.25rem)]" : "w-full"}
        >
          {formatMessage({ id: act.labelId })}
        </Button>
        {secondary ? (
          <Button
            type="button"
            emphasis="secondary"
            size="lg"
            onClick={secondary.onRun}
            disabled={isPending || unavailable || secondary.disabled}
            data-component="CommitmentActionBarSecondary"
            className="min-w-max grow basis-[calc(50%-0.25rem)]"
          >
            {formatMessage({ id: secondary.labelId })}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
