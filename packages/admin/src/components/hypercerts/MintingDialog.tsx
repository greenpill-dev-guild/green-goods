import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { type MintingState, DEFAULT_CHAIN_ID } from "@green-goods/shared";
import { MintProgress } from "./steps/MintProgress";

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

/**
 * Dialog overlay for minting progress.
 * Shows the minting steps in a modal while keeping the preview visible behind.
 * This provides a less jarring UX than replacing the entire preview.
 */
export function MintingDialog({
  mintingState,
  chainId = DEFAULT_CHAIN_ID,
  onCancel,
  onRetry,
}: MintingDialogProps) {
  const { formatMessage } = useIntl();

  // Determine if dialog should be open based on minting state
  const isActive =
    mintingState.status !== "idle" && mintingState.status !== "confirmed";
  const isFailed = mintingState.status === "failed";
  const isInProgress =
    isActive &&
    !isFailed &&
    mintingState.status !== "confirmed";

  return (
    <Dialog.Root open={isActive}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200"
          data-testid="minting-dialog-overlay"
        />
        <Dialog.Content
          className="fixed z-50 w-full max-w-lg overflow-hidden bg-bg-white shadow-2xl focus:outline-none bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 duration-300"
          data-testid="minting-dialog"
          // Prevent closing during active minting
          onPointerDownOutside={(e) => {
            if (isInProgress) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (isInProgress) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (isInProgress) e.preventDefault();
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stroke-soft p-4">
            <Dialog.Title className="text-lg font-semibold text-text-strong">
              {formatMessage({ id: "app.hypercerts.mint.dialog.title" })}
            </Dialog.Title>
            {isFailed && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-text-soft transition hover:bg-bg-soft active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-light"
                aria-label={formatMessage({ id: "app.common.close" })}
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6">
            <MintProgress state={mintingState} chainId={chainId} />
          </div>

          {/* Actions - only show when failed */}
          {isFailed && (
            <div className="flex gap-3 border-t border-stroke-soft p-4">
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
                  className="flex-1 rounded-full bg-primary-base px-4 py-3 text-sm font-medium text-white transition hover:bg-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-light"
                >
                  {formatMessage({ id: "app.hypercerts.mint.retry" })}
                </button>
              )}
            </div>
          )}

          {/* Mobile drag indicator */}
          <div className="flex justify-center pb-2 pt-1 sm:hidden">
            <div className="h-1 w-12 rounded-full bg-stroke-sub" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
