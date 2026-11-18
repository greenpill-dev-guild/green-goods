import { SheetActions } from "@green-goods/shared/components/Dialog/SheetActions";
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
  // While it sends, the bar's note is the progress; otherwise why Next is held.
  const note = submitting ? (
    <AdminLinearProgress ariaLabel={title} value={progress} />
  ) : !complete && !canContinue && blockedReason ? (
    <span role="status">{blockedReason}</span>
  ) : undefined;

  if (complete) {
    return (
      <SheetActions
        note={note}
        primary={{
          label: formatMessage({ id: "hub.garden.pool.setup.done.close", defaultMessage: "Done" }),
          onClick: onDone,
        }}
      />
    );
  }

  return (
    <SheetActions
      layout="steps"
      note={note}
      primary={
        !isLast
          ? {
              label: formatMessage({ id: "app.common.next", defaultMessage: "Next" }),
              onClick: onNext,
              disabled: !canContinue,
            }
          : retryable
            ? {
                label: formatMessage({
                  id: "hub.garden.pool.setup.retry",
                  defaultMessage: "Try Again",
                }),
                icon: <RiRefreshLine className="h-[18px] w-[18px]" aria-hidden="true" />,
                onClick: onRetry,
                disabled: submitting || !isOnline,
                loading: submitting,
              }
            : {
                label:
                  intent === "first-run"
                    ? formatMessage({
                        id: "hub.garden.pool.setup.openAll",
                        defaultMessage: "Set Up and Open",
                      })
                    : isCampaign
                      ? formatMessage({
                          id: "hub.garden.pool.setup.openCampaign",
                          defaultMessage: "Open Campaign",
                        })
                      : formatMessage({
                          id: "hub.garden.pool.setup.openSeason",
                          defaultMessage: "Open to the Garden",
                        }),
                onClick: onSubmit,
                disabled: !canContinue || (failed && !retryable),
                loading: submitting,
              }
      }
      secondary={{
        label:
          stepIndex === 0
            ? formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })
            : formatMessage({ id: "app.common.back", defaultMessage: "Back" }),
        onClick: onBack,
        disabled: submitting,
      }}
    />
  );
}
