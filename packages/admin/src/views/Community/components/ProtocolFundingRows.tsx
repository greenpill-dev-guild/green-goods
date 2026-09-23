import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type {
  ProtocolFundingOperationsController,
  ProtocolFundingRow,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { Address } from "@green-goods/shared/types/domain";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { formatGdollar, shortAddress } from "@/views/Garden/Pool/poolFundingPresentation";
import type { TransferAct } from "@/views/Garden/Pool/TransferReviewDialog";

function rowVariant(state: ProtocolFundingRow["state"]) {
  if (state === "confirmed") return "success" as const;
  if (state === "failed" || state === "cancelled") return "error" as const;
  if (state === "acknowledgement-pending") return "warning" as const;
  return "neutral" as const;
}

/**
 * The protocol's transfers to gardens, newest first. Each names the garden
 * receiving it, not only the Celo account it lands in, and each send (Dispatch,
 * Retry, Requeue) opens the same review a commitment's disbursements use before
 * the wallet is asked (hub decision 30).
 */
export function ProtocolFundingRows({
  operations,
  gardenName,
  onReview,
  onCancel,
}: {
  operations: ProtocolFundingOperationsController;
  /** A garden's name from the gardens list, or null when it is not listed. */
  gardenName: (garden: Address | null | undefined) => string | null;
  onReview: (act: TransferAct, row: ProtocolFundingRow) => void;
  onCancel: (disbursementId: bigint) => void;
}) {
  const { formatMessage, locale } = useIntl();
  const statusLabel = (state: ProtocolFundingRow["state"]) => {
    const labels: Record<ProtocolFundingRow["state"], string> = {
      queued: formatMessage({
        id: "cockpit.community.protocolFunding.row.queued",
        defaultMessage: "Queued",
      }),
      dispatched: formatMessage({
        id: "cockpit.community.protocolFunding.row.dispatched",
        defaultMessage: "Dispatched",
      }),
      "acknowledgement-pending": formatMessage({
        id: "cockpit.community.protocolFunding.row.acknowledgementPending",
        defaultMessage: "Acknowledgment pending",
      }),
      confirmed: formatMessage({
        id: "cockpit.community.protocolFunding.row.confirmed",
        defaultMessage: "Confirmed",
      }),
      failed: formatMessage({
        id: "cockpit.community.protocolFunding.row.failed",
        defaultMessage: "Failed",
      }),
      cancelled: formatMessage({
        id: "cockpit.community.protocolFunding.row.cancelled",
        defaultMessage: "Cancelled",
      }),
      unknown: formatMessage({
        id: "cockpit.community.protocolFunding.row.unknown",
        defaultMessage: "Unknown",
      }),
    };
    return labels[state];
  };

  return (
    <section className="space-y-2" aria-labelledby="protocol-funding-rows-title">
      <h4 id="protocol-funding-rows-title" className="label-md text-text-strong">
        {formatMessage({
          id: "cockpit.community.protocolFunding.rows",
          defaultMessage: "Protocol-to-garden transfers",
        })}
      </h4>
      {operations.rows.length === 0 ? (
        <p className="text-xs text-text-soft">
          {formatMessage({
            id: "cockpit.community.protocolFunding.rows.empty",
            defaultMessage: "No indexed protocol funding transfers yet.",
          })}
        </p>
      ) : (
        <ul className="divide-y divide-stroke-soft rounded-[var(--m3-shape-sm)] bg-[rgb(var(--m3-surface-container))] px-3">
          {operations.rows.map((row) => {
            const to = gardenName(row.garden) ?? shortAddress(row.recipient);
            return (
              <li key={row.id} className="space-y-2 py-3" data-funding-id={row.disbursementId}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-strong" title={to}>
                      {formatMessage(
                        {
                          id: "cockpit.community.protocolFunding.row.transfer",
                          defaultMessage: "{amount} to {garden}",
                        },
                        { amount: formatGdollar(row.amount, locale), garden: to }
                      )}
                    </p>
                    <p className="text-xs text-text-soft" title={row.recipient}>
                      {formatMessage(
                        {
                          id: "cockpit.community.protocolFunding.row.identity",
                          defaultMessage: "Transfer #{id} · Celo account {account}",
                        },
                        { id: row.disbursementId.toString(), account: shortAddress(row.recipient) }
                      )}
                    </p>
                  </div>
                  <StatusBadge variant={rowVariant(row.state)} size="sm">
                    {statusLabel(row.state)}
                  </StatusBadge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.canDispatch ? (
                    <AdminButton
                      variant="filled"
                      size="sm"
                      disabled={operations.isActing}
                      onClick={() => onReview("dispatch", row)}
                    >
                      {formatMessage({
                        id: "cockpit.community.protocolFunding.dispatch",
                        defaultMessage: "Dispatch…",
                      })}
                    </AdminButton>
                  ) : null}
                  {row.canRetry ? (
                    <AdminButton
                      variant="outlined"
                      size="sm"
                      disabled={operations.isActing}
                      onClick={() => onReview("retry", row)}
                    >
                      {formatMessage({
                        id: "cockpit.community.protocolFunding.retry",
                        defaultMessage: "Retry Command…",
                      })}
                    </AdminButton>
                  ) : null}
                  {row.canRequeue ? (
                    <AdminButton
                      variant="outlined"
                      size="sm"
                      disabled={operations.isActing}
                      onClick={() => onReview("requeue", row)}
                    >
                      {formatMessage({
                        id: "cockpit.community.protocolFunding.requeue",
                        defaultMessage: "Requeue…",
                      })}
                    </AdminButton>
                  ) : null}
                  {row.canCancel ? (
                    <AdminButton
                      variant="text"
                      size="sm"
                      onClick={() => onCancel(row.disbursementId)}
                    >
                      {formatMessage({
                        id: "cockpit.community.protocolFunding.cancel",
                        defaultMessage: "Cancel…",
                      })}
                    </AdminButton>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
