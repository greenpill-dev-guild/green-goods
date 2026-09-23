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
   * A rarer act that belongs to the same seat, on its own row beneath the
   * primary: every act lives in the bar, and two rows is not three buttons on
   * one line.
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
 * The act is the page's primary (the error fill when destructive) and the rarer
 * act its secondary, both at the page-level lg size (DL-023, DL-026).
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
      <Button
        type="button"
        size="lg"
        tone={act.destructive ? "danger" : "default"}
        onClick={onRun}
        loading={isPending}
        disabled={unavailable}
        data-component="CommitmentActionBar"
        data-act={act.kind}
        className="w-full"
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
          className="mt-2 w-full"
        >
          {formatMessage({ id: secondary.labelId })}
        </Button>
      ) : null}
    </div>
  );
}
