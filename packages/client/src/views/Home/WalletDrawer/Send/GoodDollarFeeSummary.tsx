import type { GoodDollarFeeQuote } from "@green-goods/shared/modules/wallet/good-dollar-fees";
import { Button } from "@/components/Actions/Button";
import { formatUnits } from "viem";
import { RiErrorWarningLine } from "@remixicon/react";
import { useIntl } from "react-intl";

export function GoodDollarFeeSummary({
  quote,
  decimals,
  loading,
  error,
  insufficient,
  changed,
  sponsored,
  onRetry,
  isOnline,
}: {
  quote: GoodDollarFeeQuote | undefined;
  decimals: number;
  loading: boolean;
  error: boolean;
  insufficient: boolean;
  changed: boolean;
  sponsored: boolean;
  onRetry: () => void;
  isOnline: boolean;
}) {
  const { formatMessage } = useIntl();
  const amounts = quote
    ? ([
        ["app.celoWallet.fee.amount", quote.amount],
        ["app.celoWallet.fee.tokenFee", quote.fee],
        [
          quote.senderPays ? "app.celoWallet.fee.totalDebit" : "app.celoWallet.fee.recipientAmount",
          quote.senderPays ? quote.totalDebit : quote.recipientAmount,
        ],
      ] as const)
    : [];
  return (
    <section className="mx-4 mb-4 space-y-3 rounded-lg border border-stroke-soft-200 p-3 text-xs">
      <h4 className="font-medium text-text-strong-950">
        {formatMessage({ id: "app.celoWallet.fee.title" })}
      </h4>
      <div role="status" aria-live="polite" className="space-y-2 text-text-sub-600">
        {changed ? <p>{formatMessage({ id: "app.celoWallet.fee.changed" })}</p> : null}
        {loading ? <p>{formatMessage({ id: "app.celoWallet.fee.loading" })}</p> : null}
        {error ? (
          <p className="flex items-start gap-1.5 text-error-dark">
            <RiErrorWarningLine className="h-4 w-4 shrink-0" aria-hidden />
            {formatMessage({ id: "app.celoWallet.fee.error" })}
          </p>
        ) : null}
        {!loading && !error && quote ? (
          <dl className="space-y-2">
            {amounts.map(([id, amount]) => (
              <div key={id} className="flex flex-wrap justify-between gap-2">
                <dt>{formatMessage({ id })}</dt>
                <dd className="font-medium text-text-strong-950">
                  {formatUnits(amount, decimals)} G$
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {insufficient ? (
          <p className="text-error-dark">
            {formatMessage({ id: "app.celoWallet.fee.insufficient" })}
          </p>
        ) : null}
      </div>
      {error ? (
        <Button
          type="button"
          variant="neutral"
          mode="stroke"
          onClick={onRetry}
          disabled={!isOnline}
          label={formatMessage({ id: "app.celoWallet.fee.retry" })}
        />
      ) : null}
      <p className="text-text-sub-600">
        {formatMessage({
          id: sponsored ? "app.celoWallet.sponsored" : "app.celoWallet.walletPays",
        })}
      </p>
    </section>
  );
}
