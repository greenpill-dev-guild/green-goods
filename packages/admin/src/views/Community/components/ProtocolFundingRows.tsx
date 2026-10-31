import { Button } from "@green-goods/shared/components/Button";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type {
  ProtocolFundingOperationsController,
  ProtocolFundingRow,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { PoolFundingTransferLimit } from "@green-goods/shared/modules/commitment-pooling/pool-funding";
import type { Address } from "@green-goods/shared/types/domain";
import { RiRefreshLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminCardTitle } from "@/components/AdminCard";
import { formatGdollar, shortAddress } from "@/views/Garden/Pool/poolFundingPresentation";
import type { TransferAct } from "@/views/Garden/Pool/TransferReviewDialog";

/** What the amount field and a held transfer say for each limit, in the words of the facts listed. */
export const OVER_LIMIT_MESSAGES: Record<
  PoolFundingTransferLimit,
  { id: string; defaultMessage: string }
> = {
  transfer_cap: {
    id: "cockpit.community.protocolFunding.amount.overTransferCap",
    defaultMessage: "More than the per-transfer cap.",
  },
  period_allowance: {
    id: "cockpit.community.protocolFunding.amount.overPeriodAllowance",
    defaultMessage: "More than the period allowance left.",
  },
  roles_allowance: {
    id: "cockpit.community.protocolFunding.amount.overSafeAllowance",
    defaultMessage: "More than the Safe allowance left.",
  },
  balance: {
    id: "cockpit.community.protocolFunding.amount.overBalance",
    defaultMessage: "More than the protocol Safe holds.",
  },
};

const LIMITS_UNREAD_ROW = {
  id: "cockpit.community.protocolFunding.row.limitsUnread",
  defaultMessage: "Can't be sent until the protocol Safe's limits are read.",
};

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
  onRefresh,
}: {
  operations: ProtocolFundingOperationsController;
  /** A garden's name from the gardens list, or null when it is not listed. */
  gardenName: (garden: Address | null | undefined) => string | null;
  onReview: (act: TransferAct, row: ProtocolFundingRow) => void;
  onCancel: (disbursementId: bigint) => void;
  onRefresh?: () => void;
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
        defaultMessage: "Canceled",
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AdminCardTitle as="h3" id="protocol-funding-rows-title">
          {formatMessage({
            id: "cockpit.community.protocolFunding.rows",
            defaultMessage: "Protocol-to-Garden Transfers",
          })}
        </AdminCardTitle>
        {onRefresh ? (
          <Button
            type="button"
            emphasis="secondary"
            size="compact"
            leadingIcon={<RiRefreshLine className="h-4 w-4" aria-hidden="true" />}
            onClick={onRefresh}
          >
            {formatMessage({
              id: "cockpit.community.protocolFunding.refresh",
              defaultMessage: "Refresh Funding",
            })}
          </Button>
        ) : null}
      </div>
      {operations.rows.length === 0 ? (
        <p className="type-meta text-text-soft">
          {formatMessage({
            id: "cockpit.community.protocolFunding.rows.empty",
            defaultMessage: "No indexed protocol funding transfers yet.",
          })}
        </p>
      ) : (
        <ul className="divide-y divide-stroke-soft rounded-[var(--m3-shape-sm)] bg-bg-soft px-3">
          {operations.rows.map((row) => {
            const to = gardenName(row.garden) ?? shortAddress(row.recipient);
            return (
              <li key={row.id} className="space-y-2 py-3" data-funding-id={row.disbursementId}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate type-body font-medium text-text-strong" title={to}>
                      {formatMessage(
                        {
                          id: "cockpit.community.protocolFunding.row.transfer",
                          defaultMessage: "{amount} to {garden}",
                        },
                        { amount: formatGdollar(row.amount, locale), garden: to }
                      )}
                    </p>
                    <p className="type-meta text-text-soft" title={row.recipient}>
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
                {row.sendBlock ? (
                  <p className="type-meta text-text-soft" data-testid="protocol-funding-send-block">
                    {formatMessage(
                      row.sendBlock === "limits_unread"
                        ? LIMITS_UNREAD_ROW
                        : OVER_LIMIT_MESSAGES[row.sendBlock]
                    )}
                  </p>
                ) : null}
                {/* End-aligned, two weights, the affirmative act rightmost: a queued
                    transfer's Cancel… and Dispatch… are the row's paired decision. */}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {row.canCancel ? (
                    <Button
                      type="button"
                      emphasis="secondary"
                      size="compact"
                      onClick={() => onCancel(row.disbursementId)}
                    >
                      {formatMessage({
                        id: "cockpit.community.protocolFunding.cancel",
                        defaultMessage: "Cancel…",
                      })}
                    </Button>
                  ) : null}
                  {row.canRequeue ? (
                    <Button
                      type="button"
                      emphasis="secondary"
                      size="compact"
                      disabled={operations.isActing}
                      onClick={() => onReview("requeue", row)}
                    >
                      {formatMessage({
                        id: "cockpit.community.protocolFunding.requeue",
                        defaultMessage: "Requeue…",
                      })}
                    </Button>
                  ) : null}
                  {row.canRetry ? (
                    <Button
                      type="button"
                      emphasis="secondary"
                      size="compact"
                      disabled={operations.isActing}
                      onClick={() => onReview("retry", row)}
                    >
                      {formatMessage({
                        id: "cockpit.community.protocolFunding.retry",
                        defaultMessage: "Resend…",
                      })}
                    </Button>
                  ) : null}
                  {row.canDispatch ? (
                    <Button
                      type="button"
                      emphasis="primary"
                      size="compact"
                      disabled={operations.isActing}
                      onClick={() => onReview("dispatch", row)}
                    >
                      {formatMessage({
                        id: "cockpit.community.protocolFunding.dispatch",
                        defaultMessage: "Dispatch…",
                      })}
                    </Button>
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
