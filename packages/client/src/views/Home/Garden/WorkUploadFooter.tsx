import { Button } from "@green-goods/shared/components/Button";
import { ConfirmDialog } from "@green-goods/shared/components/Dialog/ConfirmDialog";
import type { Work } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type FC, useState } from "react";
import { useIntl } from "react-intl";
import { readQueuedWorkState } from "@/components/Cards/Work/queuedWorkCopy";
import { canDiscardQueuedWork, workUploadGroup } from "@/components/Cards/Work/workUploadGroup";

export interface WorkUploadFooterProps {
  work: Work;
  isOnline: boolean;
  pausedForDataSaver: boolean;
  onPrepareNow: () => void;
  /** Upload now, or a check on a work that was already sent. */
  onRetry: () => void;
  isRetrying: boolean;
  onTryAgain: () => void;
  isTryingAgain: boolean;
  onDiscard: () => Promise<void>;
  isDiscarding: boolean;
}

/**
 * The acts for the gardener's own queued work, fixed under its page (D24): two
 * equal halves on one row, Discard on the left and the primary on the right,
 * or one full-width act when discarding isn't safe. Waiting work uploads here;
 * work that needs attention is tried again; failed work uploads again; work
 * already sent is checked again. The notice in the page says why (D30), so
 * nothing here repeats it.
 */
export const WorkUploadFooter: FC<WorkUploadFooterProps> = ({
  work,
  isOnline,
  pausedForDataSaver,
  onPrepareNow,
  onRetry,
  isRetrying,
  onTryAgain,
  isTryingAgain,
  onDiscard,
  isDiscarding,
}) => {
  const intl = useIntl();
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const state = readQueuedWorkState(work.metadata);
  const group = workUploadGroup(state.submissionState);
  const canDiscard = canDiscardQueuedWork(state.submissionState, { isOnline, pausedForDataSaver });

  const primary = (() => {
    switch (group) {
      case "preparing":
        return (
          <Button
            onClick={onPrepareNow}
            size="lg"
            loading={isOnline && !pausedForDataSaver}
            disabled={!isOnline}
            className="w-full"
            data-testid="work-prepare-now"
          >
            {!isOnline
              ? intl.formatMessage({ id: "app.home.work.uploadNow", defaultMessage: "Upload now" })
              : pausedForDataSaver
                ? intl.formatMessage({
                    id: "app.uploads.prepareNow",
                    defaultMessage: "Prepare now",
                  })
                : intl.formatMessage({
                    id: "app.uploads.preparing",
                    defaultMessage: "Preparing uploads…",
                  })}
          </Button>
        );
      case "attention":
        return (
          <Button
            onClick={onTryAgain}
            size="lg"
            loading={isTryingAgain}
            className="w-full"
            data-testid="work-try-again"
          >
            {intl.formatMessage({ id: "app.common.tryAgain", defaultMessage: "Try Again" })}
          </Button>
        );
      case "failed":
      case "sent":
        return (
          <Button
            onClick={onRetry}
            size="lg"
            loading={isRetrying}
            disabled={!isOnline && !isRetrying}
            className="w-full"
            data-testid="work-send-now"
          >
            {group === "sent"
              ? intl.formatMessage({ id: "app.uploads.checkAgain", defaultMessage: "Check again" })
              : isRetrying
                ? intl.formatMessage({
                    id: "app.home.work.uploading",
                    defaultMessage: "Uploading...",
                  })
                : intl.formatMessage({
                    id: "app.home.work.uploadNow",
                    defaultMessage: "Upload now",
                  })}
          </Button>
        );
      default:
        return (
          <Button
            onClick={onRetry}
            size="lg"
            loading={isRetrying}
            disabled={!isOnline && !isRetrying}
            className="w-full"
            data-testid="work-send-now"
          >
            {intl.formatMessage({ id: "app.home.work.uploadNow", defaultMessage: "Upload now" })}
          </Button>
        );
    }
  })();

  return (
    <>
      <div
        data-component="FixedBar"
        className="fixed bottom-0 left-0 right-0 z-sticky border-t border-stroke-soft-200 bg-bg-white-0 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div
          className={cn(
            "mx-auto grid max-w-screen-sm gap-2",
            canDiscard ? "grid-cols-2" : "grid-cols-1"
          )}
          data-testid="work-upload-footer"
        >
          {canDiscard && (
            <Button
              emphasis="secondary"
              tone="danger"
              size="lg"
              className="w-full"
              disabled={isRetrying || isTryingAgain || isDiscarding}
              onClick={() => setConfirmingDiscard(true)}
              data-testid="work-discard"
            >
              {intl.formatMessage({ id: "app.uploads.discard", defaultMessage: "Discard" })}
            </Button>
          )}
          {primary}
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmingDiscard}
        onClose={() => setConfirmingDiscard(false)}
        onConfirm={async () => {
          await onDiscard();
          setConfirmingDiscard(false);
        }}
        variant="danger"
        isLoading={isDiscarding}
        title={intl.formatMessage({
          id: "app.uploads.discardConfirmTitle",
          defaultMessage: "Discard this work?",
        })}
        description={intl.formatMessage({
          id: "app.uploads.discardConfirmDescription",
          defaultMessage:
            "It hasn't been uploaded. Its photos and notes will be removed from this device.",
        })}
        confirmLabel={intl.formatMessage({ id: "app.uploads.discard", defaultMessage: "Discard" })}
        cancelLabel={intl.formatMessage({ id: "app.uploads.keep", defaultMessage: "Keep" })}
      />
    </>
  );
};
