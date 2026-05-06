import { DEFAULT_CHAIN_ID, DialogShell, type MintingState } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { MintProgress } from "./Steps/MintProgress";

interface MintingDialogProps {
  /** Current minting state from the wizard store */
  mintingState: MintingState;
  /** Chain ID for block explorer links */
  chainId?: number;
  /** Called when user explicitly cancels (only available when failed) */
  onCancel?: () => void;
  /** Called when user clicks retry (only available when failed) */
  onRetry?: () => void;
}

export function MintingDialog({
  mintingState,
  chainId = DEFAULT_CHAIN_ID,
  onCancel,
  onRetry,
}: MintingDialogProps) {
  const { formatMessage } = useIntl();

  const isActive = mintingState.status !== "idle" && mintingState.status !== "confirmed";
  const isFailed = mintingState.status === "failed";
  const isInProgress = isActive && !isFailed && mintingState.status !== "confirmed";

  return (
    <DialogShell
      open={isActive}
      onOpenChange={(open) => {
        if (!open && isFailed && onCancel) onCancel();
      }}
      size="lg"
      title={formatMessage({ id: "app.hypercerts.mint.dialog.title" })}
      preventClose={isInProgress}
      hideCloseButton={!isFailed}
    >
      <MintProgress state={mintingState} chainId={chainId} />

      {isFailed && (
        <div className="flex gap-3 border-t border-stroke-soft pt-4 mt-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-full bg-bg-weak px-4 py-3 text-sm font-medium text-text-strong transition hover:bg-bg-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-light"
            >
              {formatMessage({ id: "app.common.cancel" })}
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex-1 rounded-full bg-[rgb(var(--tone-action,var(--primary-action)))] px-4 py-3 text-sm font-medium text-[rgb(var(--tone-on-action,var(--primary-action-foreground)))] transition hover:bg-[rgb(var(--tone-action-hover,var(--primary-action-hover)))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-action,var(--primary-action)))]"
            >
              {formatMessage({ id: "app.hypercerts.mint.retry" })}
            </button>
          )}
        </div>
      )}
    </DialogShell>
  );
}
