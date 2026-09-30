import type {
  PoolSetupStepState,
  PoolSetupStepStatus,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPoolSetupSequence";
import { useIntl } from "react-intl";
import { type TxProgressTone, TxProgressList } from "@/components/TxProgressList";
import type { TxStepMarkerState } from "@/components/TxStepMarker";
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

const STATUS_TONE: Record<PoolSetupStepStatus, TxProgressTone> = {
  pending: "soft",
  signing: "active",
  confirming: "active",
  landed: "success",
  already: "soft",
  failed: "error",
};

/**
 * Every write a pool setup (or a settings save) sends, in order, with where
 * each one stands, in the words `setupWrites` gives each write. The layout is
 * the shared `TxProgressList`.
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
    <TxProgressList
      testId="pool-setup-writes"
      chainId={chainId}
      label={formatMessage({
        id: "cockpit.garden.pool.setup.writes",
        defaultMessage: "What your wallet will sign",
      })}
      rows={rows.map((row, index) => {
        const current = row.status === "signing" || row.status === "confirming";
        const done = row.status === "landed" || row.status === "already";
        return {
          id: row.action,
          title: done
            ? writeDone(row.action, isCampaign, formatMessage)
            : writeTitle(row.action, isCampaign, formatMessage),
          why:
            showWhy === "all" || (showWhy === "current" && current)
              ? writeWhy(row.action, formatMessage)
              : undefined,
          status: row.status,
          marker: markerState(row.status),
          label: writeStatus(row.status, formatMessage),
          tone: STATUS_TONE[row.status],
          current,
          prompt: numbers[index] ?? null,
          // Only what this run wrote links to its transaction.
          hash: row.status === "landed" ? row.hash : null,
        };
      })}
    />
  );
}
