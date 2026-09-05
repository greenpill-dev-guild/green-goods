import type { useCeloWallet } from "@green-goods/shared/hooks/commitment-pooling/useSettlementQueries";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { RiArrowDownLine, RiCheckLine, RiErrorWarningLine, RiTimeLine } from "@remixicon/react";
import { useIntl } from "react-intl";

type CeloWallet = ReturnType<typeof useCeloWallet>;

const buttonClass =
  "min-h-11 rounded-md border border-stroke-sub-300 px-3 py-2 text-sm font-medium text-text-sub-600 hover:bg-bg-weak-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base disabled:cursor-not-allowed disabled:opacity-60";

const progressMessageIds: Record<string, string> = {
  queued: "app.celoWallet.receipts.queued",
  dispatched: "app.celoWallet.receipts.dispatched",
  "delivery-delayed": "app.celoWallet.receipts.delayed",
  "executed-acknowledgment-pending": "app.celoWallet.receipts.confirmationPending",
  "not-started": "app.celoWallet.receipts.notStarted",
  unknown: "app.celoWallet.receipts.unknown",
};

function walletNeedsRetry(wallet: CeloWallet): boolean {
  return Boolean(
    (!wallet.deliveryEnabled && !wallet.deliveryLoading) ||
      wallet.deliveryError ||
      wallet.balanceError ||
      wallet.historyError ||
      wallet.readiness === "unavailable" ||
      wallet.readiness === "policy-unavailable"
  );
}

export function CeloWalletStatus({
  wallet,
  showRetry = false,
}: {
  wallet: CeloWallet;
  showRetry?: boolean;
}) {
  const { formatMessage } = useIntl();
  const statusId = wallet.isOffline
    ? "app.celoWallet.offline"
    : wallet.deliveryLoading || wallet.readiness === "loading"
      ? "app.celoWallet.loading"
      : wallet.deliveryError
        ? "app.celoWallet.gateError"
        : !wallet.deliveryEnabled
          ? "app.celoWallet.blocked"
          : wallet.readiness === "address-mismatch"
            ? "app.celoWallet.addressMismatch"
            : wallet.readiness === "policy-unavailable"
              ? "app.celoWallet.policyUnavailable"
              : wallet.readiness === "unavailable"
                ? "app.celoWallet.accountUnavailable"
                : wallet.token.balance === 0n
                  ? "app.send.token.zeroBalance"
                  : null;
  return (
    <div className="space-y-2 text-xs text-text-sub-600" role="status" aria-live="polite">
      {statusId ? (
        <p className="flex items-start gap-1.5">
          <RiErrorWarningLine className="h-4 w-4 shrink-0" aria-hidden />
          {formatMessage({ id: statusId })}
        </p>
      ) : null}
      {wallet.balanceError ? <p>{formatMessage({ id: "app.celoWallet.balanceError" })}</p> : null}
      {showRetry && walletNeedsRetry(wallet) && !wallet.isOffline ? (
        <button type="button" className={buttonClass} onClick={() => void wallet.refetch()}>
          {formatMessage({ id: "app.celoWallet.retry" })}
        </button>
      ) : null}
    </div>
  );
}

export function CeloWalletCard({
  wallet,
  sponsored,
  onSend,
  onReceive,
}: {
  wallet: CeloWallet;
  sponsored: boolean;
  onSend: () => void;
  onReceive: () => void;
}) {
  const { formatMessage, formatDate } = useIntl();
  const retryable = walletNeedsRetry(wallet);

  return (
    <section className="m-4 mb-0 space-y-4 rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-strong-950">
          {formatMessage({ id: "app.celoWallet.asset" })}
        </h3>
        <p className="text-sm font-medium text-text-strong-950" aria-live="polite">
          {wallet.balanceLoading
            ? formatMessage({ id: "app.celoWallet.loading" })
            : wallet.token.balance === null
              ? formatMessage({ id: "app.balance.unavailable" })
              : `${formatTokenAmount(wallet.token.balance, wallet.token.decimals)} G$`}
        </p>
      </div>

      <CeloWalletStatus wallet={wallet} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          onClick={onSend}
          disabled={!wallet.canSend || !wallet.token.balance}
        >
          {formatMessage({ id: "app.celoWallet.send" })}
        </button>
        <button type="button" className={buttonClass} onClick={onReceive}>
          {formatMessage({ id: "app.celoWallet.receive" })}
        </button>
      </div>
      <p className="text-xs text-text-sub-600">
        {formatMessage({
          id: sponsored ? "app.celoWallet.sponsored" : "app.celoWallet.walletPays",
        })}
      </p>

      <div className="space-y-2 border-t border-stroke-soft-200 pt-3">
        <h4 className="text-xs font-medium text-text-sub-600">
          {formatMessage({ id: "app.celoWallet.receipts.title" })}
        </h4>
        {wallet.historyLoading ? (
          <p role="status" className="text-xs text-text-sub-600">
            {formatMessage({ id: "app.celoWallet.receipts.loading" })}
          </p>
        ) : null}
        {wallet.historyError ? (
          <p role="status" className="text-xs text-warning-dark">
            {formatMessage({ id: "app.celoWallet.receipts.error" })}
          </p>
        ) : null}
        {!wallet.historyLoading && !wallet.historyError && wallet.receipts.length === 0 ? (
          <p className="text-xs text-text-sub-600">
            {formatMessage({ id: "app.celoWallet.receipts.empty" })}
          </p>
        ) : null}
        <ul className="divide-y divide-stroke-soft-200">
          {wallet.receipts.map((receipt) => {
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
                    {formatTokenAmount(receipt.amount, wallet.token.decimals)} G$
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
      </div>
      {retryable && !wallet.isOffline ? (
        <button type="button" className={buttonClass} onClick={() => void wallet.refetch()}>
          {formatMessage({ id: "app.celoWallet.retry" })}
        </button>
      ) : null}
    </section>
  );
}
