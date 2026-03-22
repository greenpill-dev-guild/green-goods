import {
  DEFAULT_SPLIT_CONFIG,
  formatDate,
  formatTokenAmount,
  MIN_YIELD_THRESHOLD_USD,
} from "@green-goods/shared";
import { RiPieChart2Line } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/ui/Button";

interface YieldAllocation {
  txHash: string;
  cookieJarAmount: bigint;
  fractionsAmount: bigint;
  juiceboxAmount: bigint;
  totalAmount?: bigint;
  timestamp: number;
}

interface GardenYieldCardProps {
  allocations: YieldAllocation[];
  allocationsLoading: boolean;
}

const INITIAL_ALLOCATION_COUNT = 5;

export const GardenYieldCard: React.FC<GardenYieldCardProps> = ({
  allocations,
  allocationsLoading,
}) => {
  const { formatMessage } = useIntl();
  const [showAllAllocations, setShowAllAllocations] = useState(false);

  const splitConfig = DEFAULT_SPLIT_CONFIG;
  const cookieJarPct = (splitConfig.cookieJarBps / 100).toFixed(1);
  const fractionsPct = (splitConfig.fractionsBps / 100).toFixed(1);
  const juiceboxPct = (splitConfig.juiceboxBps / 100).toFixed(1);

  const cumulative = useMemo(() => {
    let totalYield = 0n;
    let totalCookieJar = 0n;
    let totalFractions = 0n;
    let totalJuicebox = 0n;
    for (const a of allocations) {
      totalYield += a.totalAmount ?? a.cookieJarAmount + a.fractionsAmount + a.juiceboxAmount;
      totalCookieJar += a.cookieJarAmount;
      totalFractions += a.fractionsAmount;
      totalJuicebox += a.juiceboxAmount;
    }
    return { totalYield, totalCookieJar, totalFractions, totalJuicebox };
  }, [allocations]);

  const visibleAllocations = showAllAllocations
    ? allocations
    : allocations.slice(0, INITIAL_ALLOCATION_COUNT);

  return (
    <div className="mb-4 rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-lighter">
            <RiPieChart2Line className="h-5 w-5 text-primary-dark" />
          </div>
          <div>
            <h3 className="label-md text-text-strong sm:text-lg">
              {formatMessage({ id: "app.yield.title" })}
            </h3>
            <p className="mt-0.5 text-sm text-text-sub">
              {formatMessage({ id: "app.yield.splitConfig" })}
            </p>
          </div>
        </div>
      </div>

      {allocations.length > 0 && (
        <div className="mt-4 rounded-lg border border-success-light bg-success-lighter p-4">
          <p className="label-xs text-success-dark">
            {formatMessage({ id: "app.yield.gardenCumulativeTotal" })}
          </p>
          <p className="mt-1 font-heading text-xl font-semibold tabular-nums text-success-dark">
            {formatTokenAmount(cumulative.totalYield)}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-text-sub">
            <span>
              {formatMessage({ id: "app.yield.cookieJar" })}:{" "}
              {formatTokenAmount(cumulative.totalCookieJar)}
            </span>
            <span>
              {formatMessage({ id: "app.yield.fractions" })}:{" "}
              {formatTokenAmount(cumulative.totalFractions)}
            </span>
            <span>
              {formatMessage({ id: "app.yield.juicebox" })}:{" "}
              {formatTokenAmount(cumulative.totalJuicebox)}
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-bg-weak p-3 text-center">
          <p className="label-xs text-text-soft">{formatMessage({ id: "app.yield.cookieJar" })}</p>
          <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-text-strong">
            {cookieJarPct}%
          </p>
          <p className="mt-0.5 text-xs text-text-sub">
            {formatMessage({ id: "app.yield.cookieJarDescription" })}
          </p>
        </div>
        <div className="rounded-lg bg-bg-weak p-3 text-center">
          <p className="label-xs text-text-soft">{formatMessage({ id: "app.yield.fractions" })}</p>
          <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-text-strong">
            {fractionsPct}%
          </p>
          <p className="mt-0.5 text-xs text-text-sub">
            {formatMessage({ id: "app.yield.fractionsDescription" })}
          </p>
        </div>
        <div className="rounded-lg bg-bg-weak p-3 text-center">
          <p className="label-xs text-text-soft">{formatMessage({ id: "app.yield.juicebox" })}</p>
          <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-text-strong">
            {juiceboxPct}%
          </p>
          <p className="mt-0.5 text-xs text-text-sub">
            {formatMessage({ id: "app.yield.juiceboxDescription" })}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-information-light bg-information-lighter px-3 py-2">
        <p className="text-xs text-information-dark">
          {formatMessage({ id: "app.yield.threshold" }, { amount: `$${MIN_YIELD_THRESHOLD_USD}` })}
        </p>
      </div>

      <div className="mt-4 border-t border-stroke-soft pt-4">
        <h4 className="label-sm text-text-strong">{formatMessage({ id: "app.yield.history" })}</h4>
        {allocationsLoading ? (
          <div className="mt-2 space-y-2" role="status" aria-live="polite">
            <span className="sr-only">{formatMessage({ id: "app.yield.history" })}</span>
            {[1, 2].map((i) => (
              <div key={i} className="rounded-lg bg-bg-weak p-3">
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
            {visibleAllocations.map((allocation) => (
              <div
                key={allocation.txHash}
                className="flex items-center justify-between rounded-lg bg-bg-weak p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-strong">
                    {formatTokenAmount(
                      allocation.totalAmount ??
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
            {allocations.length > INITIAL_ALLOCATION_COUNT && !showAllAllocations && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-1 w-full"
                onClick={() => setShowAllAllocations(true)}
              >
                {formatMessage(
                  { id: "app.yield.showAll", defaultMessage: "Show all {count} allocations" },
                  { count: allocations.length }
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
