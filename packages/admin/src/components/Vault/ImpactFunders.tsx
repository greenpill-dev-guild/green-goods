import { formatTokenAmount, useFunderLeaderboard } from "@green-goods/shared";
import { RiArrowDownSLine, RiArrowUpSLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { FunderRow } from "./FunderRow";

const DEFAULT_VISIBLE = 3;

export function ImpactFunders() {
  const { formatMessage } = useIntl();
  const { funders, totalProtocolYield, isLoading } = useFunderLeaderboard();
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <section className="rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-5">
        <div className="h-5 w-40 rounded skeleton-shimmer" />
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 rounded-lg skeleton-shimmer"
              style={{ animationDelay: `${i * 0.08}s` }}
            />
          ))}
        </div>
      </section>
    );
  }

  if (funders.length === 0) {
    return null;
  }

  const visibleFunders = expanded ? funders : funders.slice(0, DEFAULT_VISIBLE);
  const hasMore = funders.length > DEFAULT_VISIBLE;
  const maxYield = funders[0]?.totalYieldGenerated ?? 0n;

  return (
    <section className="rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-text-strong">
            {formatMessage({ id: "app.funders.impactFundersTitle" })}
          </h2>
          <p className="text-sm text-text-sub">
            {formatMessage({ id: "app.funders.impactFundersSubtitle" })}
          </p>
        </div>
        {totalProtocolYield > 0n && (
          <span className="shrink-0 rounded-full bg-success-lighter px-2.5 py-1 text-xs font-semibold text-success-dark">
            {formatMessage(
              { id: "app.funders.yieldGenerated" },
              { amount: formatTokenAmount(totalProtocolYield) }
            )}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {visibleFunders.map((funder) => (
          <FunderRow key={funder.address} funder={funder} maxYield={maxYield} />
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-md border border-stroke-soft py-2 text-xs font-medium text-text-sub transition-colors hover:bg-bg-weak"
        >
          {expanded
            ? formatMessage({ id: "app.funders.collapse" })
            : formatMessage({ id: "app.funders.viewAll" }, { count: funders.length })}
          {expanded ? (
            <RiArrowUpSLine className="h-3.5 w-3.5" />
          ) : (
            <RiArrowDownSLine className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      <p className="mt-3 text-xs text-text-sub">
        {formatMessage({ id: "app.funders.contextExplainer" })}
      </p>
    </section>
  );
}
