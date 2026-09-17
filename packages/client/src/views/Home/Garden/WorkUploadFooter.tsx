import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { ConfirmDialog } from "@green-goods/shared/components/Dialog/ConfirmDialog";
import type { Work } from "@green-goods/shared/types/domain";
import { RiRefreshLine, RiUploadCloudLine } from "@remixicon/react";
import { type FC, useState } from "react";
import { type MessageDescriptor, useIntl } from "react-intl";
import {
  queuedWorkDetailMessage,
  readQueuedWorkState,
} from "@/components/Cards/Work/queuedWorkCopy";

export interface WorkUploadFooterProps {
  work: Work;
  isOnline: boolean;
  /** Send Now, or a check on a work that was already sent. */
  onRetry: () => void;
  isRetrying: boolean;
  onOpenUploads: () => void;
  onTryAgain: () => void;
  isTryingAgain: boolean;
  onDiscard: () => Promise<void>;
  isDiscarding: boolean;
}

type FooterGroup = "waiting" | "attention" | "failed" | "sent";

function footerGroup(submissionState: string | undefined): FooterGroup {
  switch (submissionState) {
    case "blocked":
    case "photo-needs-attention":
      return "attention";
    case "retry-required":
    case "reverted":
      return "failed";
    case "awaiting-confirmation":
    case "checking-submission":
    case "sending":
      return "sent";
    default:
      return "waiting";
  }
}

const SENT_LINES: Record<string, MessageDescriptor> = {
  "awaiting-confirmation": { id: "app.work.confirmationExplanation" },
  "checking-submission": { id: "app.work.checkingSubmissionInfo" },
  sending: { id: "app.home.work.syncingInfo" },
};

/**
 * The work detail footer for the gardener's own queued work. Waiting work
 * points to Your Work, where Upload all sends it. Work that needs attention
 * can be prepared again or discarded. Work whose send failed keeps Send Now,
 * and work already sent can be checked again.
 */
export const WorkUploadFooter: FC<WorkUploadFooterProps> = ({
  work,
  isOnline,
  onRetry,
  isRetrying,
  onOpenUploads,
  onTryAgain,
  isTryingAgain,
  onDiscard,
  isDiscarding,
}) => {
  const intl = useIntl();
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const state = readQueuedWorkState(work.metadata);
  const group = footerGroup(state.submissionState);
  // A reverted send left a transaction behind, so only an unsent failure can be discarded.
  const canDiscard =
    group === "attention" || (group === "failed" && state.submissionState !== "reverted");

  const line = (() => {
    switch (group) {
      case "attention":
        return queuedWorkDetailMessage(state);
      case "failed":
        return state.submissionState === "reverted"
          ? { id: "app.work.confirmationFailed" }
          : { id: "app.work.retryRequiredInfo" };
      case "sent":
        return SENT_LINES[state.submissionState ?? ""];
      default:
        return (
          queuedWorkDetailMessage(state) ?? {
            id: "app.home.work.offlineInfo",
            defaultMessage: "Saved on your device. Upload it from Your Work.",
          }
        );
    }
  })();

  const primary = (() => {
    switch (group) {
      case "attention":
        return (
          <Button
            onClick={onTryAgain}
            size="lg"
            loading={isTryingAgain}
            className="w-full"
            leadingIcon={<RiRefreshLine className="h-5 w-5" aria-hidden="true" />}
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
            leadingIcon={
              group === "failed" ? (
                <RiUploadCloudLine className="h-5 w-5" aria-hidden="true" />
              ) : (
                <RiRefreshLine className="h-5 w-5" aria-hidden="true" />
              )
            }
            data-testid="work-send-now"
          >
            {group === "sent"
              ? intl.formatMessage({ id: "app.uploads.checkAgain", defaultMessage: "Check again" })
              : isRetrying
                ? intl.formatMessage({
                    id: "app.home.work.uploading",
                    defaultMessage: "Sending...",
                  })
                : intl.formatMessage({ id: "app.home.work.uploadNow", defaultMessage: "Send Now" })}
          </Button>
        );
      default:
        return (
          <Button
            onClick={onOpenUploads}
            size="lg"
            className="w-full"
            leadingIcon={<RiUploadCloudLine className="h-5 w-5" aria-hidden="true" />}
            data-testid="work-open-uploads"
          >
            {intl.formatMessage({ id: "app.uploads.openUploads", defaultMessage: "Open uploads" })}
          </Button>
        );
    }
  })();

  return (
    <>
      <Alert
        variant={group === "attention" || group === "failed" ? "warning" : "info"}
        className="fixed left-0 right-0 bottom-0 z-sticky overflow-hidden rounded-t-[var(--radius-lg)] border-t p-4 pb-6"
      >
        <div
          className="mx-auto flex max-w-screen-sm flex-col gap-3"
          data-testid="work-upload-footer"
        >
          {line && <p>{intl.formatMessage(line)}</p>}
          <div className="flex flex-col gap-2">
            {primary}
            {canDiscard && (
              <Button
                emphasis="secondary"
                tone="danger"
                size="lg"
                className="w-full"
                onClick={() => setConfirmingDiscard(true)}
                data-testid="work-discard"
              >
                {intl.formatMessage({ id: "app.uploads.discard", defaultMessage: "Discard" })}
              </Button>
            )}
          </div>
          {!isOnline && group === "waiting" && (
            <p className="text-center text-xs">
              {intl.formatMessage({
                id: "app.home.work.offlineNotice",
                defaultMessage: "You're offline. Upload it from Your Work once you're connected.",
              })}
            </p>
          )}
        </div>
      </Alert>
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
