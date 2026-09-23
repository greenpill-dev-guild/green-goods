import { RiRefreshLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminLinearProgress } from "@/components/AdminLinearProgress";
import type { PoolSetupIntent } from "./setupFlowModel";

export interface SetupFlowFooterProps {
  title: string;
  intent: PoolSetupIntent;
  isCampaign: boolean;
  stepIndex: number;
  isLast: boolean;
  submitting: boolean;
  canContinue: boolean;
  failed: boolean;
  /** The run finished: the only way on is Done. */
  complete: boolean;
  /** How much of the run has landed, 0–100, while it runs. */
  progress?: number;
  retryable: boolean;
  isOnline: boolean;
  /** Cancel on the first step, back on any later one. */
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onRetry: () => void;
  onDone: () => void;
}

/** The flow's one action row: progress, the way back, and the way on. */
export function SetupFlowFooter({
  title,
  intent,
  isCampaign,
  stepIndex,
  isLast,
  submitting,
  canContinue,
  failed,
  complete,
  progress,
  retryable,
  isOnline,
  onBack,
  onNext,
  onSubmit,
  onRetry,
  onDone,
}: SetupFlowFooterProps) {
  const { formatMessage } = useIntl();
  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <div className="min-w-0 sm:flex-1" aria-live="polite">
        {submitting ? <AdminLinearProgress ariaLabel={title} value={progress} /> : null}
      </div>
      {complete ? (
        <AdminButton type="button" variant="filled" onClick={onDone} className="w-full sm:w-auto">
          {formatMessage({ id: "cockpit.garden.pool.setup.done.close", defaultMessage: "Done" })}
        </AdminButton>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <AdminButton
            type="button"
            variant={stepIndex === 0 ? "text" : "outlined"}
            onClick={onBack}
            disabled={submitting}
            className="self-start sm:self-auto"
          >
            {stepIndex === 0
              ? formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })
              : formatMessage({ id: "app.common.back", defaultMessage: "Back" })}
          </AdminButton>
          {isLast ? (
            retryable ? (
              <AdminButton
                type="button"
                variant="filled"
                leadingIcon={<RiRefreshLine className="h-4 w-4" />}
                onClick={onRetry}
                disabled={submitting || !isOnline}
                loading={submitting}
                className="w-full sm:w-auto"
              >
                {formatMessage({
                  id: "cockpit.garden.pool.setup.retry",
                  defaultMessage: "Try Again",
                })}
              </AdminButton>
            ) : (
              <AdminButton
                type="button"
                variant="filled"
                onClick={onSubmit}
                disabled={!canContinue || (failed && !retryable)}
                loading={submitting}
                className="w-full sm:w-auto"
              >
                {intent === "first-run"
                  ? formatMessage({
                      id: "cockpit.garden.pool.setup.openAll",
                      defaultMessage: "Set Up and Open",
                    })
                  : isCampaign
                    ? formatMessage({
                        id: "cockpit.garden.pool.setup.openCampaign",
                        defaultMessage: "Open Campaign",
                      })
                    : formatMessage({
                        id: "cockpit.garden.pool.setup.openSeason",
                        defaultMessage: "Open to the Garden",
                      })}
              </AdminButton>
            )
          ) : (
            <AdminButton
              type="button"
              variant="filled"
              onClick={onNext}
              disabled={!canContinue}
              className="w-full sm:w-auto"
            >
              {formatMessage({ id: "app.common.next", defaultMessage: "Next" })}
            </AdminButton>
          )}
        </div>
      )}
    </div>
  );
}
