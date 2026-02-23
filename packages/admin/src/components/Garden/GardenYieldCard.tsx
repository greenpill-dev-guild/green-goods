import {
  DEFAULT_SPLIT_CONFIG,
  formatDate,
  formatTokenAmount,
  MIN_YIELD_THRESHOLD_USD,
} from "@green-goods/shared";
import { RiPieChart2Line } from "@remixicon/react";
import { useIntl } from "react-intl";

interface YieldAllocation {
  txHash: string;
  cookieJarAmount: bigint;
  fractionsAmount: bigint;
  juiceboxAmount: bigint;
  timestamp: number;
}

interface GardenYieldCardProps {
  allocations: YieldAllocation[];
  allocationsLoading: boolean;
}

export const GardenYieldCard: React.FC<GardenYieldCardProps> = ({
  allocations,
  allocationsLoading,
}) => {
  const { formatMessage } = useIntl();

  const splitConfig = DEFAULT_SPLIT_CONFIG;
  const cookieJarPct = (splitConfig.cookieJarBps / 100).toFixed(1);
  const fractionsPct = (splitConfig.fractionsBps / 100).toFixed(1);
  const juiceboxPct = (splitConfig.juiceboxBps / 100).toFixed(1);

  return (
    <div className="mb-4 rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-lighter">
            <RiPieChart2Line className="h-5 w-5 text-primary-dark" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-strong sm:text-lg">
              {formatMessage({ id: "app.yield.title" })}
            </h3>
            <p className="mt-0.5 text-sm text-text-sub">
              {formatMessage({ id: "app.yield.splitConfig" })}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-md bg-bg-weak p-3 text-center">
          <p className="text-xs font-medium text-text-soft">
            {formatMessage({ id: "app.yield.cookieJar" })}
          </p>
          <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-text-strong">
            {cookieJarPct}%
          </p>
          <p className="mt-0.5 text-xs text-text-sub">
            {formatMessage({ id: "app.yield.cookieJarDescription" })}
          </p>
        </div>
        <div className="rounded-md bg-bg-weak p-3 text-center">
          <p className="text-xs font-medium text-text-soft">
            {formatMessage({ id: "app.yield.fractions" })}
          </p>
          <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-text-strong">
            {fractionsPct}%
          </p>
          <p className="mt-0.5 text-xs text-text-sub">
            {formatMessage({ id: "app.yield.fractionsDescription" })}
          </p>
        </div>
        <div className="rounded-md bg-bg-weak p-3 text-center">
          <p className="text-xs font-medium text-text-soft">
            {formatMessage({ id: "app.yield.juicebox" })}
          </p>
          <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-text-strong">
            {juiceboxPct}%
          </p>
          <p className="mt-0.5 text-xs text-text-sub">
            {formatMessage({ id: "app.yield.juiceboxDescription" })}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-information-light bg-information-lighter px-3 py-2">
        <p className="text-xs text-information-dark">
          {formatMessage({ id: "app.yield.threshold" }, { amount: `$${MIN_YIELD_THRESHOLD_USD}` })}
        </p>
      </div>

      <div className="mt-4 border-t border-stroke-soft pt-4">
        <h4 className="text-sm font-medium text-text-strong">
          {formatMessage({ id: "app.yield.history" })}
        </h4>
        {allocationsLoading ? (
          <div className="mt-2 space-y-2" role="status" aria-live="polite">
            <span className="sr-only">{formatMessage({ id: "app.yield.history" })}</span>
            {[1, 2].map((i) => (
              <div key={i} className="rounded-md bg-bg-weak p-3">
                <div
                  className="h-4 w-24 rounded skeleton-shimmer"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
                <div
                  className="mt-1 h-3 w-16 rounded skeleton-shimmer"
                  style={{ animationDelay: `${i * 0.1 + 0.05}s` }}
                />
              </div>
            ))}
          </div>
        ) : allocations.length === 0 ? (
          <p className="mt-2 text-center text-sm text-text-soft">
            {formatMessage({ id: "app.yield.noAllocations" })}
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {allocations.map((allocation) => (
              <div
                key={allocation.txHash}
                className="flex items-center justify-between rounded-md bg-bg-weak p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-strong">
                    {formatTokenAmount(
                      allocation.cookieJarAmount +
                        allocation.fractionsAmount +
                        allocation.juiceboxAmount
                    )}
                  </p>
                  <p className="text-xs text-text-sub">{formatDate(allocation.timestamp)}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-text-sub">
                  <span>
                    {formatMessage({ id: "app.yield.cookieJar" })}:{" "}
                    {formatTokenAmount(allocation.cookieJarAmount)}
                  </span>
                  <span>
                    {formatMessage({ id: "app.yield.fractions" })}:{" "}
                    {formatTokenAmount(allocation.fractionsAmount)}
                  </span>
                  <span>
                    {formatMessage({ id: "app.yield.juicebox" })}:{" "}
                    {formatTokenAmount(allocation.juiceboxAmount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
