import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type {
  ProtocolFundingOperationsController,
  ProtocolFundingRow,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { formatGdollar, shortAddress } from "@/views/Garden/Pool/poolFundingPresentation";

function rowVariant(state: ProtocolFundingRow["state"]) {
  if (state === "confirmed") return "success" as const;
  if (state === "failed" || state === "cancelled") return "error" as const;
  if (state === "acknowledgement-pending") return "warning" as const;
  return "neutral" as const;
}

export function ProtocolFundingRows({
  operations,
  onSubmit,
  onCancel,
}: {
  operations: ProtocolFundingOperationsController;
  onSubmit: (act: () => Promise<string>) => Promise<void>;
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
          {operations.rows.map((row) => (
            <li key={row.id} className="space-y-2 py-3" data-funding-id={row.disbursementId}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-text-strong">
                    {formatGdollar(row.amount, locale)} → {shortAddress(row.recipient)}
                  </p>
                  <p className="text-xs text-text-soft">
                    {formatMessage(
                      {
                        id: "cockpit.community.protocolFunding.row.identity",
                        defaultMessage:
                          "Funding / ProtocolToGarden · settlement {id} · no commitment ID",
                      },
                      { id: row.disbursementId.toString() }
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
                    onClick={() =>
                      void onSubmit(() => operations.dispatch(row.disbursementId)).catch(
                        () => undefined
                      )
                    }
                  >
                    {formatMessage({
                      id: "cockpit.community.protocolFunding.dispatch",
                      defaultMessage: "Dispatch",
                    })}
                  </AdminButton>
                ) : null}
                {row.canRetry ? (
                  <AdminButton
                    variant="outlined"
                    size="sm"
                    onClick={() =>
                      void onSubmit(() => operations.retry(row.disbursementId)).catch(
                        () => undefined
                      )
                    }
                  >
                    {formatMessage({
                      id: "cockpit.community.protocolFunding.retry",
                      defaultMessage: "Retry command",
                    })}
                  </AdminButton>
                ) : null}
                {row.canRequeue ? (
                  <AdminButton
                    variant="outlined"
                    size="sm"
                    onClick={() =>
                      void onSubmit(() => operations.requeue(row.disbursementId)).catch(
                        () => undefined
                      )
                    }
                  >
                    {formatMessage({
                      id: "cockpit.community.protocolFunding.requeue",
                      defaultMessage: "Requeue",
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
          ))}
        </ul>
      )}
    </section>
  );
}
