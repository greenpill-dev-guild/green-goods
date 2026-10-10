import { Button } from "@green-goods/shared/components/Button";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import type { WorkUploads } from "@green-goods/shared/hooks/work/useWorkUploads";
import { RiUploadCloud2Line } from "@remixicon/react";
import type { FC } from "react";
import { useIntl } from "react-intl";

export interface WorkDecisionUploadFooterProps {
  decision: NonNullable<ReturnType<WorkUploads["decisionFor"]>>;
  isOnline: boolean;
  uploads: Pick<
    WorkUploads,
    "isUploading" | "pausedForDataSaver" | "checkOne" | "uploadOne" | "retryOne" | "prepareNow"
  >;
}

/**
 * The steward's decision on this work while it waits on this device: where it stands, and the
 * one upload action that moves it on. A sent decision can be checked again, a ready one uploaded,
 * a preparing one prepared now while Data Saver holds it, and anything else tried again.
 */
export const WorkDecisionUploadFooter: FC<WorkDecisionUploadFooterProps> = ({
  decision,
  isOnline,
  uploads,
}) => {
  const intl = useIntl();

  return (
    <div className="fixed left-0 right-0 bottom-0 z-sticky rounded-t-[var(--radius-lg)] border-t border-stroke-soft-200 bg-bg-white-0 p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-screen-sm flex-col gap-2">
        <p className="text-sm text-text-sub-600" role="status">
          {decision.status.state === "sent"
            ? intl.formatMessage({ id: "app.uploads.sendUnconfirmedTitle" })
            : decision.status.state === "ready"
              ? intl.formatMessage({ id: "app.uploads.state.waiting" })
              : decision.status.state === "preparing"
                ? intl.formatMessage({ id: "app.uploads.state.preparing" })
                : intl.formatMessage({ id: "app.uploads.notUploadedTitle" })}
        </p>
        <Button
          type="button"
          size="lg"
          className="w-full"
          leadingIcon={<RiUploadCloud2Line className="h-5 w-5" aria-hidden="true" />}
          disabled={
            !isOnline ||
            uploads.isUploading ||
            (decision.status.state === "preparing" && !uploads.pausedForDataSaver)
          }
          loading={uploads.isUploading}
          onClick={() => {
            const { jobId, status } = decision;
            const action =
              status.state === "sent"
                ? uploads.checkOne(jobId)
                : status.state === "ready"
                  ? uploads.uploadOne(jobId)
                  : status.state === "preparing" && uploads.pausedForDataSaver
                    ? Promise.resolve(uploads.prepareNow())
                    : uploads.retryOne(jobId);
            void action.catch((error) => {
              // uploadOne already reports its mutation error with a toast.
              if (status.state === "ready") return;
              toastService.error({
                title: intl.formatMessage({ id: "app.uploads.failedTitle" }),
                message: intl.formatMessage({ id: "app.uploads.failedMessage" }),
                context: "work decision upload",
                error,
              });
            });
          }}
          data-testid="decision-upload-now"
        >
          {decision.status.state === "sent"
            ? intl.formatMessage({ id: "app.uploads.checkAgain" })
            : decision.status.state === "ready"
              ? intl.formatMessage({ id: "app.home.work.uploadNow" })
              : decision.status.state === "preparing"
                ? intl.formatMessage({
                    id: uploads.pausedForDataSaver
                      ? "app.uploads.prepareNow"
                      : "app.uploads.state.preparing",
                  })
                : intl.formatMessage({ id: "app.common.tryAgain" })}
        </Button>
      </div>
    </div>
  );
};
