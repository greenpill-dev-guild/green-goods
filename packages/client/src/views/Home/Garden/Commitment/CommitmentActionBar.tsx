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
}

/**
 * The screen's one act, in a fixed bar.
 *
 * Only a seat that can actually perform something reaches this component, so
 * there is no disabled-for-your-seat state to draw: a bar that cannot be used
 * answers a question its reader did not ask. The disabling here is for an act
 * already in flight, for the one act that genuinely needs the network, and for
 * a queue the phone cannot read, which is not the same as an empty one.
 */
export function CommitmentActionBar({
  act,
  isPending,
  isOnline,
  blockedReasonId = null,
  onRun,
}: CommitmentActionBarProps) {
  const { formatMessage } = useIntl();
  // Withdrawing is an immediate contract call rather than a queued job, so it
  // is the one act that cannot be taken offline. Everything else queues.
  const needsNetwork = act.kind === "withdraw";
  const reasonId =
    blockedReasonId ?? (needsNetwork && !isOnline ? "app.commitment.act.needsNetwork" : null);
  const blocked = isPending || reasonId !== null;

  return (
    <div className="shrink-0 border-t border-stroke-soft-200 bg-bg-white-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {reasonId ? (
        <p className="mb-2 text-xs text-text-sub-600" role="status">
          {formatMessage({ id: reasonId })}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onRun}
        disabled={blocked}
        aria-busy={isPending}
        data-component="CommitmentActionBar"
        data-act={act.kind}
        className={
          act.destructive
            ? "w-full rounded-[var(--radius-lg)] border border-error-base px-4 py-3 text-sm font-medium text-error-base tap-target-lg disabled:opacity-60"
            : "w-full rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg disabled:opacity-60"
        }
      >
        {formatMessage({ id: act.labelId })}
      </button>
    </div>
  );
}
