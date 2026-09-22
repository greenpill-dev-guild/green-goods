import type {
  PoolSetupStepState,
  PoolSetupStepStatus,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPoolSetupSequence";
import { getBlockExplorerTxUrl } from "@green-goods/shared/utils/eas/explorers";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { useIntl } from "react-intl";
import { TxStepMarker, type TxStepMarkerState } from "@/components/TxStepMarker";
import { writeDone, writeStatus, writeTitle, writeWhy } from "./setupWrites";

export interface SetupProgressListProps {
  rows: readonly PoolSetupStepState[];
  /** The wallet prompt each row rides in; rows sharing a number are approved together. */
  numbers: readonly (number | null)[];
  isCampaign: boolean;
  chainId: number;
  /** Every row's reason before the run; only the current one while it runs; none once done. */
  showWhy: "all" | "current" | "none";
}

function markerState(status: PoolSetupStepStatus): TxStepMarkerState {
  switch (status) {
    case "signing":
    case "confirming":
      return "active";
    case "landed":
    case "already":
      return "complete";
    case "failed":
      return "failed";
    case "pending":
      return "pending";
  }
}

const STATUS_TONE: Record<PoolSetupStepStatus, string> = {
  pending: "text-text-soft",
  signing: "text-primary-dark",
  confirming: "text-primary-dark",
  landed: "text-success-dark",
  already: "text-text-soft",
  failed: "text-error-dark",
};

/**
 * Every write the flow sends, in order, with where each one stands. The list
 * is the same before, during and after the run, so a steward watches the rows
 * they read beforehand fill in rather than a spinner with no words.
 */
export function SetupProgressList({
  rows,
  numbers,
  isCampaign,
  chainId,
  showWhy,
}: SetupProgressListProps) {
  const { formatMessage } = useIntl();
  return (
    <ol
      className="space-y-1"
      data-testid="pool-setup-writes"
      aria-label={formatMessage({
        id: "cockpit.garden.pool.setup.writes",
        defaultMessage: "What your wallet will sign",
      })}
    >
      {rows.map((row, index) => {
        const current = row.status === "signing" || row.status === "confirming";
        const done = row.status === "landed" || row.status === "already";
        const status = writeStatus(row.status, formatMessage);
        const title = done
          ? writeDone(row.action, isCampaign, formatMessage)
          : writeTitle(row.action, isCampaign, formatMessage);
        return (
          <li
            key={row.action}
            data-status={row.status}
            aria-current={current ? "step" : undefined}
            className={cn(
              "flex items-start gap-3 rounded-lg px-3 py-2 transition-colors",
              current && "bg-primary-alpha-10"
            )}
          >
            <TxStepMarker size="sm" state={markerState(row.status)} label={numbers[index] ?? ""} />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-body-md font-medium",
                  done ? "text-text-sub" : "text-text-strong"
                )}
              >
                {title}
              </p>
              {showWhy === "all" || (showWhy === "current" && current) ? (
                <p className="mt-0.5 text-xs text-text-soft">
                  {writeWhy(row.action, formatMessage)}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-0.5 text-xs">
              {status ? <span className={STATUS_TONE[row.status]}>{status}</span> : null}
              {row.status === "landed" && row.hash ? (
                <a
                  href={getBlockExplorerTxUrl(chainId, row.hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary-dark underline"
                  aria-label={formatMessage(
                    {
                      id: "cockpit.garden.pool.setup.viewTxFor",
                      defaultMessage: "View the transaction for “{step}”",
                    },
                    { step: title }
                  )}
                >
                  {formatMessage({
                    id: "cockpit.garden.pool.setup.viewTx",
                    defaultMessage: "View",
                  })}
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
