import { Button } from "@green-goods/shared/components/Button";
import { RiRefreshLine } from "@remixicon/react";
import { useIntl } from "react-intl";
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
  /** Why the way on is off, said the way the app composer's bar does. */
  blockedReason?: string | null;
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
  blockedReason = null,
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
        {submitting ? (
          <AdminLinearProgress ariaLabel={title} value={progress} />
        ) : !complete && !canContinue && blockedReason ? (
          <p role="status" className="type-meta text-text-soft">
            {blockedReason}
          </p>
        ) : null}
      </div>
      {complete ? (
        <Button
          type="button"
          emphasis="primary"
          size="sm"
          onClick={onDone}
          className="w-full sm:w-auto"
        >
          {formatMessage({ id: "cockpit.garden.pool.setup.done.close", defaultMessage: "Done" })}
        </Button>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            emphasis={stepIndex === 0 ? "tertiary" : "secondary"}
            size="sm"
            onClick={onBack}
            disabled={submitting}
            className="self-start sm:self-auto"
          >
            {stepIndex === 0
              ? formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })
              : formatMessage({ id: "app.common.back", defaultMessage: "Back" })}
          </Button>
          {isLast ? (
            retryable ? (
              <Button
                type="button"
                emphasis="primary"
                size="sm"
                leadingIcon={<RiRefreshLine className="h-[18px] w-[18px]" aria-hidden="true" />}
                onClick={onRetry}
                disabled={submitting || !isOnline}
                loading={submitting}
                className="w-full sm:w-auto"
              >
                {formatMessage({
                  id: "cockpit.garden.pool.setup.retry",
                  defaultMessage: "Try Again",
                })}
              </Button>
            ) : (
              <Button
                type="button"
                emphasis="primary"
                size="sm"
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
              </Button>
            )
          ) : (
            <Button
              type="button"
              emphasis="primary"
              size="sm"
              onClick={onNext}
              disabled={!canContinue}
              className="w-full sm:w-auto"
            >
              {formatMessage({ id: "app.common.next", defaultMessage: "Next" })}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
