import { Alert } from "@green-goods/shared/components/Alert";
import type { PoolSetupStepState } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPoolSetupSequence";
import {
  isRetriablePoolSetupFailure,
  type PoolSetupFailure,
} from "@green-goods/shared/modules/commitment-pooling/pool-setup";
import { RiShieldCheckLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { SetupProgressList } from "./SetupFlow/SetupProgressList";
import { retryPromptCount, runningStatus } from "./SetupFlow/setupWrites";

type FormatMessage = ReturnType<typeof useIntl>["formatMessage"];

export interface PoolSettingsProgressProps {
  status: "running" | "failed" | "complete";
  rows: readonly PoolSetupStepState[];
  /** The wallet prompt each row rides in. */
  numbers: readonly (number | null)[];
  /** Prompts in this run; once stopped, how many more a retry will ask. */
  total: number;
  failure: PoolSetupFailure | null;
  chainId: number;
}

/** What a stopped save left behind, read from the rows the chain reports. */
function stoppedSummary(rows: readonly PoolSetupStepState[], formatMessage: FormatMessage) {
  const planned = (action: PoolSetupStepState["action"]) =>
    rows.some((row) => row.action === action);
  const saved = (action: PoolSetupStepState["action"]) =>
    rows.some(
      (row) => row.action === action && (row.status === "landed" || row.status === "already")
    );
  if (saved("setPoolCharter") && planned("setProviderOpenCommitmentCap")) {
    return formatMessage({
      id: "cockpit.garden.pool.settings.stopped.agreementOnly",
      defaultMessage: "The new agreement is saved. The commitment limit is not.",
    });
  }
  if (saved("setProviderOpenCommitmentCap") && planned("setPoolCharter")) {
    return formatMessage({
      id: "cockpit.garden.pool.settings.stopped.limitOnly",
      defaultMessage: "The new commitment limit is saved. The agreement is not.",
    });
  }
  return formatMessage({
    id: "cockpit.garden.pool.settings.stopped.nothing",
    defaultMessage: "Nothing was saved. The pool keeps the settings it had.",
  });
}

/**
 * A settings save once it has started: one line saying where it stands (the
 * prompt the wallet is showing, what a stop left saved, or done), the writes
 * row by row, why a stop cannot be retried where that is so, and how many more
 * prompts a retry takes where it can.
 */
export function PoolSettingsProgress({
  status,
  rows,
  numbers,
  total,
  failure,
  chainId,
}: PoolSettingsProgressProps) {
  const { formatMessage } = useIntl();
  const stopped = status === "failed";
  const line =
    status === "running"
      ? runningStatus(rows, numbers, total, chainId, formatMessage)
      : status === "complete"
        ? formatMessage({
            id: "cockpit.garden.pool.settings.saved",
            defaultMessage: "Settings saved.",
          })
        : stoppedSummary(rows, formatMessage);

  return (
    <div className="space-y-2" data-testid="pool-settings-progress" data-status={status}>
      <p className="text-body-md font-medium text-text-strong" aria-live="polite">
        {line}
      </p>
      <SetupProgressList
        rows={rows}
        numbers={numbers}
        isCampaign={false}
        chainId={chainId}
        showWhy={status === "running" ? "current" : "none"}
      />
      {stopped && failure === "no-sender" ? (
        <Alert variant="warning">
          {formatMessage({
            id: "cockpit.garden.pool.setup.failure.noSender",
            defaultMessage:
              "No wallet is ready to sign. Connect one and try again; nothing was written.",
          })}
        </Alert>
      ) : null}
      {stopped && failure === "unavailable" ? (
        <Alert variant="warning">
          {formatMessage({
            id: "cockpit.garden.pool.setup.failure.unavailable",
            defaultMessage:
              "Commitment pooling isn't switched on in this app yet, so nothing was written.",
          })}
        </Alert>
      ) : null}
      {stopped && isRetriablePoolSetupFailure(failure) ? (
        <p className="flex items-center gap-1.5 body-xs text-text-soft">
          <RiShieldCheckLine className="h-3.5 w-3.5" aria-hidden />
          {retryPromptCount(total, formatMessage)}
        </p>
      ) : null}
    </div>
  );
}
