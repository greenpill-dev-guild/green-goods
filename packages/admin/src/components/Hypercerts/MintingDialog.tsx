import { DEFAULT_CHAIN_ID, type MintingState } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { AdminDialog } from "../AdminDialog";
import { AdminButton } from "../AdminButton";
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
    <AdminDialog
      open={isActive}
      onOpenChange={(open) => {
        if (!open && isFailed && onCancel) onCancel();
      }}
      size="lg"
      title={formatMessage({ id: "app.hypercerts.mint.dialog.title" })}
      preventClose={isInProgress}
      hideCloseButton={!isFailed}
      actions={
        isFailed ? (
          <>
            {onCancel && (
              <AdminButton type="button" onClick={onCancel} variant="text">
                {formatMessage({ id: "app.common.cancel" })}
              </AdminButton>
            )}
            {onRetry && (
              <AdminButton type="button" onClick={onRetry}>
                {formatMessage({ id: "app.hypercerts.mint.retry" })}
              </AdminButton>
            )}
          </>
        ) : null
      }
    >
      <MintProgress state={mintingState} chainId={chainId} />
    </AdminDialog>
  );
}
