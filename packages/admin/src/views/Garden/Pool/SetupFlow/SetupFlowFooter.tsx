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
  retryable: boolean;
  isOnline: boolean;
  /** Cancel on the first step, back on any later one. */
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onRetry: () => void;
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
  retryable,
  isOnline,
  onBack,
  onNext,
  onSubmit,
  onRetry,
}: SetupFlowFooterProps) {
  const { formatMessage } = useIntl();
  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <div className="min-w-0 sm:flex-1" aria-live="polite">
        {submitting ? <AdminLinearProgress ariaLabel={title} /> : null}
      </div>
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
                defaultMessage: "Try again",
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
                    defaultMessage: "Open season",
                  })
                : isCampaign
                  ? formatMessage({
                      id: "cockpit.garden.pool.setup.openCampaign",
                      defaultMessage: "Open campaign",
                    })
                  : formatMessage({
                      id: "cockpit.garden.pool.setup.openSeason",
                      defaultMessage: "Open to the garden",
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
    </div>
  );
}
