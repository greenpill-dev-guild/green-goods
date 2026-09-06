import type { GardenerSettlementReceipt } from "@green-goods/shared/hooks/commitment-pooling/useSettlementQueries";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { RiArrowDownLine, RiCheckLine, RiErrorWarningLine, RiTimeLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions/Button";

const progressMessageIds: Record<string, string> = {
  queued: "app.celoWallet.receipts.queued",
  dispatched: "app.celoWallet.receipts.dispatched",
  "delivery-delayed": "app.celoWallet.receipts.delayed",
  "executed-acknowledgment-pending": "app.celoWallet.receipts.confirmationPending",
  "not-started": "app.celoWallet.receipts.notStarted",
  unknown: "app.celoWallet.receipts.unknown",
};

export function WalletSupportHistory({
  receipts,
  decimals,
  isLoading,
  isError,
  isOffline,
  onRetry,
}: {
  receipts: GardenerSettlementReceipt[];
  decimals: number;
  isLoading: boolean;
  isError: boolean;
  isOffline: boolean;
  onRetry: () => void;
}) {
  const { formatMessage, formatDate } = useIntl();
  return (
    <section className="mx-4 mb-4 space-y-2 border-t border-stroke-soft-200 pt-4">
      <h3 className="text-xs font-medium text-text-sub-600">
        {formatMessage({ id: "app.celoWallet.receipts.title" })}
      </h3>
      {isLoading ? (
        <p role="status" className="text-xs text-text-sub-600">
          {formatMessage({ id: "app.celoWallet.receipts.loading" })}
        </p>
      ) : null}
      {isError ? (
        <p role="status" className="text-xs text-warning-dark">
          {formatMessage({ id: "app.celoWallet.receipts.error" })}
        </p>
      ) : null}
      {!isLoading && !isError && receipts.length === 0 ? (
        <p className="text-xs text-text-sub-600">
          {formatMessage({ id: "app.celoWallet.receipts.empty" })}
        </p>
      ) : null}
      <ul className="divide-y divide-stroke-soft-200">
        {receipts.map((receipt) => {
          const status = receipt.delivery.status;
          const complete = status === "confirmed";
          const interrupted = status === "failed" || status === "cancelled";
          const Icon = complete ? RiCheckLine : interrupted ? RiErrorWarningLine : RiTimeLine;
          const labelId = complete
            ? "app.celoWallet.receipts.confirmed"
            : status === "failed"
              ? "app.celoWallet.receipts.failed"
              : status === "cancelled"
                ? "app.celoWallet.receipts.cancelled"
                : "app.celoWallet.receipts.onTheWay";
          return (
            <li key={receipt.id} className="space-y-1 py-3 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 break-words font-medium text-text-strong-950">
                  {receipt.title ||
                    formatMessage(
                      { id: "app.celoWallet.receipts.fallback" },
                      { id: receipt.commitmentId.toString() }
                    )}
                </p>
                <span className="inline-flex shrink-0 items-center gap-1 text-text-sub-600">
                  <RiArrowDownLine className="h-3.5 w-3.5" aria-hidden />
                  {formatTokenAmount(receipt.amount, decimals)} G$
                </span>
              </div>
              <p className="flex items-start gap-1.5 text-text-sub-600">
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span>
                  {formatMessage({ id: labelId })}
                  {!complete && !interrupted ? (
                    <>
                      {" "}
                      ·{" "}
                      {formatMessage({
                        id: progressMessageIds[status] ?? "app.celoWallet.receipts.unknown",
                      })}
                    </>
                  ) : null}
                </span>
              </p>
              <time
                dateTime={new Date(receipt.createdAt * 1000).toISOString()}
                className="block text-text-soft-400"
              >
                {formatDate(receipt.createdAt * 1000, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </li>
          );
        })}
      </ul>
      {isError && !isOffline ? (
        <Button
          type="button"
          variant="neutral"
          mode="stroke"
          onClick={onRetry}
          label={formatMessage({ id: "app.common.retry" })}
        />
      ) : null}
    </section>
  );
}
